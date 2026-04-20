"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Loader2, PlayCircle } from "lucide-react";

export default function AcademyLoginPage() {
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
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.session.user.id).single();
        const role = profile?.role || 'client';

        // TOLERÂNCIA ZERO: Só entra se for aluno ou assinante
        if (!['student', 'subscriber'].includes(role)) {
          await supabase.auth.signOut();
          setError("Acesso negado. Esta área é exclusiva para alunos e operadores.");
          setLoading(false);
          return;
        }

        // Joga o aluno DIRETO para o catálogo, pulando a home do cliente
        router.push("/portal/treinamentos");
      }
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-text-primary relative overflow-hidden">
      {/* Fundo Cinematográfico Escuro */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/40"></div>

      <div className="w-full max-w-md p-8 sm:p-12 bg-surface/80 backdrop-blur-xl border border-surface/50 rounded-2xl relative z-10 shadow-2xl">
        <div className="text-center mb-10">
          <PlayCircle size={48} className="text-cs-green mx-auto mb-4" />
          <h1 className="text-3xl font-extrabold text-white tracking-tighter">
            LOC FIX <span className="text-cs-green">Academy</span>
          </h1>
          <p className="mt-2 text-sm text-text-secondary">Acesse seus treinamentos técnicos.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-md border border-surface bg-background/50 px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="E-mail do Aluno" />
            </div>
            <div>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full rounded-md border border-surface bg-background/50 px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Senha" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input id="remember-me-academy" type="checkbox" className="h-4 w-4 rounded border-surface bg-background text-cs-green focus:ring-cs-green" />
              <label htmlFor="remember-me-academy" className="ml-2 block text-sm text-text-secondary">Lembrar de mim</label>
            </div>
            <div className="text-sm">
              <a href="#" className="font-medium text-text-secondary hover:text-white transition-colors">Esqueceu a senha?</a>
            </div>
          </div>

          {error && <div className="text-red-400 text-sm font-medium bg-red-500/10 p-3 rounded-md border border-red-500/20 text-center">{error}</div>}

          <button type="submit" disabled={loading} className="flex w-full justify-center items-center gap-2 rounded-md bg-cs-green py-3 px-4 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Entrar na Academy"}
          </button>
        </form>
      </div>
    </div>
  );
}