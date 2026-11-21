import { NextResponse } from 'next/server';
import {
  getChamador,
  getSupabaseAdmin,
  ehPapelInterno,
  TODOS_OS_PAPEIS,
} from '../../lib/authServer';

// Quem chama, o papel dele, a empresa e o cliente vêm SEMPRE do banco,
// a partir da sessão. O corpo da requisição só diz quem convidar e com qual papel.

const PAPEIS_QUE_ADMIN_PODE_CRIAR = TODOS_OS_PAPEIS.filter(
  (r) => r !== 'super_admin' && r !== 'admin'
);

export async function POST(request: Request) {
  try {
    const chamador = await getChamador(request);
    if (!chamador) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { action, email, fullName, password, role } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 });
    }
    if (!role || !TODOS_OS_PAPEIS.includes(role)) {
      return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 });
    }

    const interno = ehPapelInterno(chamador.role);
    const ehSuper = chamador.role === 'super_admin';
    const ehAdmin = chamador.role === 'admin';

    // Empresa sempre a do chamador. Sem empresa vinculada, não há tenant para convidar.
    if (!chamador.company_id) {
      return NextResponse.json({ error: 'Seu usuário não está vinculado a uma empresa.' }, { status: 403 });
    }

    let clientId: string | null = null;

    if (interno) {
      // Equipe interna: só super admin e admin convidam.
      if (!ehSuper && !ehAdmin) {
        return NextResponse.json({ error: 'Ação não permitida para seu nível de acesso.' }, { status: 403 });
      }
      // Só super admin cria admin ou super admin.
      if (!ehSuper && !PAPEIS_QUE_ADMIN_PODE_CRIAR.includes(role)) {
        return NextResponse.json({ error: 'Ação não permitida para seu nível de acesso.' }, { status: 403 });
      }
    } else if (chamador.role === 'client') {
      // Cliente do portal: só convida operadores (student) da própria empresa-cliente.
      if (role !== 'student' || !chamador.client_id) {
        return NextResponse.json({ error: 'Ação não permitida para seu nível de acesso.' }, { status: 403 });
      }
      clientId = chamador.client_id;
    } else {
      return NextResponse.json({ error: 'Ação não permitida para seu nível de acesso.' }, { status: 403 });
    }

    // Criação direta com senha: só equipe interna (admin/super admin).
    if (action === 'add' && !interno) {
      return NextResponse.json({ error: 'Ação não permitida para seu nível de acesso.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (action === 'add') {
      if (!password || typeof password !== 'string' || password.length < 8) {
        return NextResponse.json({ error: 'A senha precisa ter ao menos 8 caracteres.' }, { status: 400 });
      }

      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
      if (authError) throw authError;

      const { error: profileError } = await supabaseAdmin.from('profiles').insert([
        {
          id: authUser.user.id,
          email,
          full_name: fullName,
          role,
          company_id: chamador.company_id,
          client_id: clientId,
        },
      ]);
      if (profileError) throw profileError;

      return NextResponse.json({ success: true });
    }

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        role_pending: role,
        company_id: chamador.company_id,
        client_id: clientId,
      },
    });
    if (inviteError) throw inviteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('ERRO_API_INVITE:', error?.message);
    return NextResponse.json({ error: 'Não foi possível concluir a operação.' }, { status: 500 });
  }
}
