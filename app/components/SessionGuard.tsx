"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

/**
 * SessionGuard — envolve o layout raiz e monitora o estado da sessão globalmente.
 *
 * Comportamento:
 * - TOKEN_REFRESHED: silencioso, o auto-refresh já tratou
 * - SIGNED_OUT: redireciona para /login
 * - USER_UPDATED: silencioso
 * - Se a aba ficar em background e o refresh falhar (sem internet, por exemplo),
 *   o próximo evento de SIGNED_OUT vai capturar e redirecionar.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Sessão expirou ou usuário saiu — redireciona para login
        router.replace("/login");
      }

      if (event === "TOKEN_REFRESHED") {
        // Token renovado com sucesso — não precisa fazer nada
        console.debug("[SessionGuard] Token renovado automaticamente.");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}

export default SessionGuard;