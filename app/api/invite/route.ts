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

    // Captura a URL base dinamicamente para o redirecionamento (Vercel ou Localhost)
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (action === 'add') {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });
      if (error) throw error;
      userId = data.user.id;
    } else {
      // Fluxo Zero Trust: Dispara o e-mail instruindo o Supabase a redirecionar para a tela de Setup
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/setup`
      });
      if (error) throw error;
      userId = data.user.id;
    }

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