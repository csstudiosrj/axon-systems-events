import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

// CORS aberto — necessário para formulários externos de qualquer tenant.
// Restringir por domínio deve ser feito via configuração por empresa, não hardcode.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Preflight CORS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      token,            // ← preferencial: token público da empresa (gerado no painel)
      company_id,       // ← alternativa: UUID direto, útil para integrações internas
      client_name,
      company_name,
      email,
      phone,
      event_type,
      event_date,
      estimated_budget,
    } = body;

    // ── Resolução do tenant ──────────────────────────────────────────────────

    let resolvedCompanyId: string | null = null;

    if (token) {
      // Formulários externos enviam um token público; fazemos lookup seguro
      const { data: company, error: tokenError } = await supabase
        .from("companies")
        .select("id")
        .eq("public_token", token)
        .single();

      if (tokenError || !company) {
        return NextResponse.json(
          { error: "Token inválido ou empresa não encontrada." },
          { status: 401, headers: corsHeaders }
        );
      }

      resolvedCompanyId = company.id;
    } else if (company_id) {
      // Integrações internas podem enviar company_id diretamente
      resolvedCompanyId = company_id;
    }

    if (!resolvedCompanyId) {
      return NextResponse.json(
        { error: "Identificação da empresa é obrigatória (token ou company_id)." },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Validação mínima ─────────────────────────────────────────────────────

    if (!client_name) {
      return NextResponse.json(
        { error: "O nome do contato é obrigatório." },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Inserção do lead vinculado ao tenant correto ──────────────────────────

    const { error } = await supabase
      .from("leads")
      .insert([{
        company_id: resolvedCompanyId,   // ← isolamento garantido
        client_name,
        company_name:     company_name  || null,
        email:            email         || null,
        phone:            phone         || null,
        event_type:       event_type    || null,
        event_date:       event_date ? new Date(event_date).toISOString() : null,
        estimated_budget: estimated_budget ? Number(estimated_budget) : 0,
        status:           "new",
      }]);

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        message: "Solicitação recebida com sucesso. Nossa equipe entrará em contato.",
      },
      { status: 201, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error("Erro na API de Leads:", error.message);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar o lead." },
      { status: 500, headers: corsHeaders }
    );
  }
}