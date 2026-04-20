import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Usamos a Service Role Key para ter poderes administrativos de disparar e-mails de convite
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, role, inviterId, inviterRole } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "E-mail e cargo são obrigatórios." }, { status: 400 });
    }

    // Regra de Negócio: Comercial só pode convidar clientes/alunos
    if (inviterRole === 'commercial' && !['client', 'student', 'subscriber'].includes(role)) {
      return NextResponse.json({ error: "Você não tem permissão para convidar membros da equipe interna." }, { status: 403 });
    }

    // 1. Dispara o e-mail de convite oficial do Supabase
    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    // 2. Atualiza o cargo real do usuário recém-convidado (pois o trigger padrão o define como 'client')
    if (data.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ role: role })
        .eq("id", data.user.id);
    }

    return NextResponse.json({ success: true, message: "Convite enviado com sucesso!" }, { status: 200 });

  } catch (error: any) {
    console.error("Erro na API de Convites:", error.message);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}