"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const[password, setPassword] = useState("");
  const [error, setError] = useState("");
  const[loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("E-mail ou senha incorretos. Verifique seus dados.");
      setLoading(false);
    } else {
      router.push("/dashboard");
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
            <p className="mt-2 text-sm text-text-secondary">
              Acesse o painel de controle do ecossistema CS com.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
                  E-mail corporativo
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-surface bg-surface px-3 py-2 text-white placeholder-text-secondary focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green sm:text-sm transition-colors"
                  placeholder="seu.nome@cscomeventos.com.br"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-surface bg-surface px-3 py-2 text-white placeholder-text-secondary focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Bloco restaurado: Lembrar de mim e Esqueceu a senha */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface bg-surface text-cs-green focus:ring-cs-green"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-text-secondary">
                  Lembrar de mim
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-cs-gold hover:text-white transition-colors">
                  Esqueceu a senha?
                </a>
              </div>
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="text-cs-gold text-sm font-medium bg-cs-gold/10 p-3 rounded-md border border-cs-gold/20">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md border border-transparent bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-cs-green transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Autenticando..." : "Entrar no Sistema"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative bg-surface border-l border-surface/50 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-luminosity"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
        
        <div className="relative z-10 p-12 text-center max-w-2xl">
          <h2 className="text-4xl font-bold text-white mb-4">
            Excelência em Produção Técnica
          </h2>
          <p className="text-lg text-text-secondary">
            Plataforma unificada para gestão de orçamentos, ordens de serviço, logística, treinamentos e suporte técnico de alto padrão.
          </p>
        </div>
      </div>
    </div>
  );
}