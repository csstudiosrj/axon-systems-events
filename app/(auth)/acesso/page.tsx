"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Loader2, CheckCircle } from "lucide-react";

export default function ClientLoginPage() {
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

        // TOLERÂNCIA ZERO: Só entra se for 'client'
        if (role !== 'client') {
          await supabase.auth.signOut();
          setError(role === 'student' ? "Acesso negado. Alunos devem acessar pela página da Academy." : "Acesso negado. Equipe interna deve usar o portal corporativo.");
          setLoading(false);
          return;
        }

        router.push("/portal");
      }
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-text-primary">
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540039155733-d7696d54af58?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-luminosity"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent"></div>
        
        <div className="relative z-10 p-12 max-w-2xl">
          <div className="mb-8">
            <h1 className="text-5xl font-extrabold text-white tracking-tighter mb-2">CS <span className="text-cs-green">com</span></h1>
            <p className="text-cs-gold font-medium tracking-widest uppercase text-sm">Portal do Cliente</p>
          </div>
          <h2 className="text-3xl font-bold text-white mb-6 leading-tight">Sua central de gestão de eventos.</h2>
          <ul className="space-y-4 text-text-secondary">
            <li className="flex items-center gap-3"><CheckCircle className="text-cs-green" size={20} /> Acompanhe seus eventos e faturas.</li>
            <li className="flex items-center gap-3"><CheckCircle className="text-cs-green" size={20} /> Abra chamados de suporte em tempo real.</li>
          </ul>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 bg-background relative">
        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-white">Acesse sua conta</h2>
            <p className="mt-2 text-sm text-text-secondary">Bem-vindo de volta ao portal exclusivo.</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">E-mail</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-md border border-surface bg-surface px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="seu@email.com" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-text-secondary">Senha</label>
                </div>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full rounded-md border border-surface bg-surface px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="••••••••" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input id="remember-me-client" type="checkbox" className="h-4 w-4 rounded border-surface bg-surface text-cs-green focus:ring-cs-green" />
                <label htmlFor="remember-me-client" className="ml-2 block text-sm text-text-secondary">Lembrar de mim</label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-cs-gold hover:text-white transition-colors">Esqueceu a senha?</a>
              </div>
            </div>

            {error && <div className="text-red-400 text-sm font-medium bg-red-500/10 p-3 rounded-md border border-red-500/20 text-center">{error}</div>}

            <button type="submit" disabled={loading} className="flex w-full justify-center items-center gap-2 rounded-md bg-cs-green py-3 px-4 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Entrar no Portal"}
            </button>
          </form>
        </div>

        <div className="absolute bottom-6 w-full text-center px-4">
          <p className="text-xs text-text-secondary">&copy; {new Date().getFullYear()} AXON Group. Todos os direitos reservados.</p>
          <p className="text-xs text-text-secondary mt-1">Desenvolvido por <a href="https://www.csstudios.site" target="_blank" className="text-cs-green hover:underline font-medium">CS studios</a></p>
        </div>
      </div>
    </div>
  );
}