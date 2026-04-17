import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

// Configuração de CORS para permitir que o seu site externo envie dados para este sistema
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // No futuro, podemos travar isso apenas para "https://cscomeventos.com.br"
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Rota OPTIONS necessária para o "Preflight" dos navegadores (Segurança)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Rota POST que recebe os dados do formulário do site
export async function POST(request: Request) {
  try {
    // Lê os dados em formato JSON enviados pelo site
    const body = await request.json();
    
    const { 
      client_name, 
      company_name, 
      email, 
      phone, 
      event_type, 
      event_date, 
      estimated_budget 
    } = body;

    // Validação mínima de segurança
    if (!client_name) {
      return NextResponse.json(
        { error: "O nome do contato é obrigatório." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Insere o Lead diretamente no banco de dados do CRM na coluna "Novos Leads" (status: 'new')
    const { error } = await supabase
      .from("leads")
      .insert([{
        client_name,
        company_name: company_name || null,
        email: email || null,
        phone: phone || null,
        event_type: event_type || null,
        event_date: event_date ? new Date(event_date).toISOString() : null,
        estimated_budget: estimated_budget ? Number(estimated_budget) : 0,
        status: "new"
      }]);

    if (error) throw error;

    // Responde ao site que deu tudo certo
    return NextResponse.json(
      { success: true, message: "Orçamento solicitado com sucesso. Nossa equipe entrará em contato." },
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