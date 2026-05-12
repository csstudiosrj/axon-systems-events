import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Validação de env vars ANTES de qualquer instanciação
    const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey    = process.env.RESEND_API;
    const defaultFromEmail = process.env.RESEND_FROM_EMAIL; // ex: "financeiro@seudominio.com.br"

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Configuração Supabase ausente no servidor.');
    }
    if (!resendApiKey) {
      throw new Error('Configuração de API de e-mail ausente no servidor.');
    }
    if (!defaultFromEmail) {
      throw new Error('RESEND_FROM_EMAIL não configurado no servidor.');
    }

    // Instanciação lazy — dentro do handler, nunca no escopo do módulo
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const resend        = new Resend(resendApiKey);

    const body = await request.json() as {
      transactionId?: string;
      company_id?: string;
    };

    const { transactionId, company_id } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId é obrigatório.' }, { status: 400 });
    }
    if (!company_id) {
      return NextResponse.json({ error: 'company_id é obrigatório.' }, { status: 400 });
    }

    // ── Dados da empresa (remetente dinâmico) ────────────────────────────────
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('name, sender_email')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('Empresa não encontrada.');
    }

    // sender_email configurado pela empresa no painel; fallback para env var
    const fromEmail   = company.sender_email || defaultFromEmail;
    const fromName    = company.name         || 'Financeiro';
    const fromAddress = `${fromName} <${fromEmail}>`;

    // ── Dados da transação e do cliente ─────────────────────────────────────
    const { data: t, error } = await supabaseAdmin
      .from('financial_transactions')
      .select('*, clients(*)')
      .eq('id', transactionId)
      .eq('company_id', company_id)    // ← garante que a transação pertence ao tenant
      .single();

    if (error || !t) {
      throw new Error('Lançamento financeiro não localizado.');
    }

    if (!t.clients?.email) {
      throw new Error('Cliente sem e-mail cadastrado.');
    }

    const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL || '';
    const publicLink = `${siteUrl}/financeiro/fatura/${t.id}`;
    const amount     = Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const dueDate    = new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR');

    // ── Envio do e-mail ──────────────────────────────────────────────────────
    const { error: mailError } = await resend.emails.send({
      from:    fromAddress,                   // ← dinâmico, sem hardcode de marca
      to:      [t.clients.email as string],
      subject: `Cobrança: ${t.description}`,
      html: `
        <div style="font-family: sans-serif; color: #0d0807; max-width: 600px; margin: 0 auto; border: 1px solid #1a1413; padding: 40px; border-radius: 12px;">
          <h2 style="text-transform: uppercase; letter-spacing: 2px;">Olá, ${t.clients.company_name}</h2>
          <p style="font-size: 16px; line-height: 1.6;">Há um lançamento pendente referente aos serviços prestados.</p>

          <div style="background: #1a1413; color: #ffffff; padding: 25px; border-radius: 8px; margin: 30px 0;">
            <p style="margin: 5px 0; font-size: 12px; text-transform: uppercase; color: #a19d9c;">Descrição</p>
            <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 18px;">${t.description}</p>

            <p style="margin: 5px 0; font-size: 12px; text-transform: uppercase; color: #a19d9c;">Valor</p>
            <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 24px; color: #138946;">R$ ${amount}</p>

            <p style="margin: 5px 0; font-size: 12px; text-transform: uppercase; color: #a19d9c;">Vencimento</p>
            <p style="margin: 0; font-weight: bold; font-size: 18px;">${dueDate}</p>
          </div>

          <a href="${publicLink}" style="display: block; text-align: center; padding: 15px 30px; background: #138946; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; text-transform: uppercase;">Visualizar Fatura</a>

          <p style="font-size: 10px; color: #a19d9c; text-align: center; margin-top: 40px;">E-mail automático gerado por ${fromName}.</p>
        </div>
      `,
    });

    if (mailError) throw new Error(mailError.message);

    // Atualiza rastreio de notificação
    await supabaseAdmin
      .from('financial_transactions')
      .update({ last_notified_at: new Date().toISOString() })
      .eq('id', transactionId);

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno no servidor.';
    console.error('ERRO_API_COBRANCA:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}