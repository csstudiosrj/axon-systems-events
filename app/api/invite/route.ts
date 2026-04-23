import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, role, inviterId, inviterRole, action, password, fullName, clientId } = body;

    if (!email || !role) return NextResponse.json({ error: "E-mail e cargo são obrigatórios." }, { status: 400 });

    if (inviterRole === 'commercial' && !['client', 'student', 'subscriber'].includes(role)) {
      return NextResponse.json({ error: "Você não tem permissão para adicionar membros da equipe interna." }, { status: 403 });
    }

    let userId = null;

    if (action === 'add') {
      // Criação forçada (Usado pelo Super Admin interno)
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });
      if (error) throw error;
      userId = data.user.id;
    } else {
      // Fluxo Zero Trust: Dispara o e-mail de convite seguro
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      userId = data.user.id;
    }

    // Atualiza o cargo, nome e o vínculo com a empresa (client_id) na tabela profiles
    if (userId) {
      const updatePayload: any = { role: role, full_name: fullName };
      if (clientId) {
        updatePayload.client_id = clientId;
      }
      await supabaseAdmin.from("profiles").update(updatePayload).eq("id", userId);
    }

    return NextResponse.json({ success: true, message: "Operação realizada com sucesso!" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}