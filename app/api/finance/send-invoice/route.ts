import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Inicialização do cliente administrativo com as chaves exatas da Vercel
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Inicialização do Resend utilizando o padrão de nomenclatura seguro
const resend = new Resend(process.env.RESEND_API);

export async function POST(request: Request) {
  try {
    const { transactionId, companyName } = await request.json();

    if (!process.env.RESEND_API) {
      throw new Error('Configuracao de envio de e-mail ausente no servidor.');
    }

    // Busca os dados da transação e do cliente para compor o corpo do e-mail
    const { data: t, error } = await supabaseAdmin
      .from('financial_transactions')
      .select('*, clients(*)')
      .eq('id', transactionId)
      .single();

    if (error || !t) {
      throw new Error('Lancamento financeiro nao localizado para processamento.');
    }

    if (!t.clients?.email) {
      throw new Error('O destinatario nao possui um endereco de e-mail vinculado.');
    }

    // Link público para visualização da fatura (deve ser implementado no portal do cliente)
    const publicLink = `${process.env.NEXT_PUBLIC_SITE_URL}/fatura/v/${t.invoice_hash}`;

    const { error: mailError } = await resend.emails.send({
      from: `${companyName} <financeiro@arxum.com.br>`,
      to: [t.clients.email],
      subject: `Cobranca: ${t.description}`,
      html: `
        <div style="font-family: sans-serif; color: #0d0807; max-width: 600px; margin: 0 auto; border: 1px solid #1a1413; padding: 40px; border-radius: 12px;">
          <h2 style="text-transform: uppercase; letter-spacing: 2px;">Ola, ${t.clients.company_name}</h2>
          <p style="font-size: 16px; line-height: 1.6;">Informamos que ha um lancamento pendente em nosso sistema ARXUM referente aos servicos prestados.</p>
          
          <div style="background: #1a1413; color: #ffffff; padding: 25px; border-radius: 8px; margin: 30px 0;">
            <p style="margin: 5px 0; font-size: 12px; text-transform: uppercase; color: #a19d9c;">Descricao</p>
            <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 18px;">${t.description}</p>
            
            <p style="margin: 5px 0; font-size: 12px; text-transform: uppercase; color: #a19d9c;">Valor Total</p>
            <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 24px; color: #138946;">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            
            <p style="margin: 5px 0; font-size: 12px; text-transform: uppercase; color: #a19d9c;">Vencimento</p>
            <p style="margin: 0; font-weight: bold; font-size: 18px;">${new Date(t.due_date).toLocaleDateString('pt-BR')}</p>
          </div>
          
          <p style="font-size: 14px; color: #a19d9c; margin-bottom: 30px;">Para visualizar o documento detalhado e acessar os dados de pagamento, utilize o botao abaixo:</p>
          
          <a href="${publicLink}" style="display: block; text-align: center; padding: 15px 30px; background: #138946; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Visualizar Fatura Completa</a>
          
          <hr style="margin: 40px 0; border: 0; border-top: 1px solid #1a1413;" />
          
          <p style="font-size: 10px; color: #a19d9c; text-align: center; text-transform: uppercase;">Este e um e-mail automatico gerado pelo ecossistema ARXUM. Nao responda a este endereco.</p>
        </div>
      `,
    });

    if (mailError) throw mailError;

    // Registra a data da última notificação para evitar cobranças duplicadas no mesmo dia
    await supabaseAdmin
      .from('financial_transactions')
      .update({ last_notified_at: new Date().toISOString() })
      .eq('id', transactionId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("ERRO_ENVIO_COBRANCA:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}