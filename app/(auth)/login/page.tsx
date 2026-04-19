"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;

      if (authData.session) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.session.user.id)
          .single();

        // Se não achar o perfil, assume que é cliente por segurança máxima
        const role = profile?.role || 'client';

        if (['client', 'student', 'subscriber'].includes(role)) {
          router.push("/portal");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-text-primary">
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-left">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              AXON <span className="text-cs-green">systems</span>
            </h1>
            <p className="mt-2 text-sm text-text-secondary">Acesso restrito à equipe interna.</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">E-mail corporativo</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border border-surface bg-surface px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green sm:text-sm transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Senha</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-md border border-surface bg-surface px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green sm:text-sm transition-colors" />
              </div>
            </div>

            {error && <div className="text-cs-gold text-sm font-medium bg-cs-gold/10 p-3 rounded-md border border-cs-gold/20 text-center">{error}</div>}

            <button type="submit" disabled={loading} className="flex w-full justify-center rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Entrar no Sistema"}
            </button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative bg-surface border-l border-surface/50 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-luminosity"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
        <div className="relative z-10 p-12 text-center max-w-2xl">
          <h2 className="text-4xl font-bold text-white mb-4">Excelência em Produção Técnica</h2>
        </div>
      </div>
    </div>
  );
}