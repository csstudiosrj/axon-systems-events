import { supabase } from './supabase';

/**
 * fetch que envia o token de sessão do usuário logado para as rotas /api,
 * que validam quem está chamando no servidor.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
