import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persiste a sessão no localStorage entre recargas de página
    persistSession: true,
    // Renova o token automaticamente antes de expirar
    autoRefreshToken: true,
    // Detecta sessão na URL (necessário para magic links e OAuth)
    detectSessionInUrl: true,
  },
});