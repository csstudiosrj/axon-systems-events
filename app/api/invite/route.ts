import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Usamos a SERVICE_ROLE_KEY apenas no Server-side para gerenciar usuários sem confirmação forçada
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { action, email, fullName, password, role, inviterRole } = await request.json();

    // Validação de Hierarquia: Apenas Super Admin cria outros Admins/Super Admins
    if (role === 'super_admin' && inviterRole !== 'super_admin') {
      return NextResponse.json({ error: 'Ação não permitida para seu nível de acesso.' }, { status: 403 });
    }

    if (action === 'add') {
      // Criação Direta (Manual)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });

      if (authError) throw authError;

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert([{ id: authUser.user.id, email, full_name: fullName, role }]);

      if (profileError) throw profileError;

      return NextResponse.json({ success: true });
    } else {
      // Convite por E-mail
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, role_pending: role }
      });

      if (inviteError) throw inviteError;

      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}