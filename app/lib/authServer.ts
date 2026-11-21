import { createClient } from '@supabase/supabase-js';

// Só para uso no servidor (rotas /api). Nunca importar em componentes do cliente.

export const PAPEIS_INTERNOS = [
  'super_admin', 'admin', 'commercial', 'financial',
  'logistics', 'marketing', 'training', 'support',
] as const;

export const PAPEIS_EXTERNOS = ['client', 'student', 'subscriber'] as const;

export const TODOS_OS_PAPEIS: string[] = [...PAPEIS_INTERNOS, ...PAPEIS_EXTERNOS];

export interface Chamador {
  id: string;
  role: string;
  company_id: string | null;
  client_id: string | null;
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuração Supabase ausente no servidor.');
  return createClient(url, key);
}

/**
 * Identifica quem está chamando a rota a partir do token de sessão
 * (header Authorization: Bearer ...). Papel, empresa e cliente vêm do
 * banco, nunca do corpo da requisição. Retorna null se não houver sessão válida.
 */
export async function getChamador(request: Request): Promise<Chamador | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData?.user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, company_id, client_id')
    .eq('id', userData.user.id)
    .single();

  if (!profile) return null;
  return profile as Chamador;
}

export function ehPapelInterno(role: string): boolean {
  return (PAPEIS_INTERNOS as readonly string[]).includes(role);
}
