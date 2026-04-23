"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { Lock, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

export default function SetupPasswordPage() {
  const router = useRouter();
  const[password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const[loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [user, setUser] = useState<any>(null);
  const[verifying, setVerifying] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // O Supabase processa o hash na URL do e-mail e cria a sessão automaticamente
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Se não tem sessão, o link é inválido ou expirou
        router.push("/acesso");
      } else {
        setUser(session.user);
      }
      setVerifying(false);
    };
    
    // Pequeno delay para garantir que o client do Supabase processou a URL
    const timer = setTimeout(() => checkSession(), 1000);
    return () => clearTimeout(timer);
  }, [router]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setMessage({ type: "error", text: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setMessage({ type: "error", text: "Erro ao definir senha: " + error.message });
      setLoading(false);
    } else {
      setMessage({ type: "success", text: "Senha definida com sucesso! Redirecionando..." });
      
      // Busca o perfil para redirecionar para a porta correta
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      
      setTimeout(() => {
        if (profile && ['student', 'subscriber'].includes(profile.role)) {
          router.push("/academy");
        } else if (profile && profile.role === 'client') {
          router.push("/portal");
        } else {
          router.push("/dashboard");
        }
      }, 2000);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-cs-green mb-4" size={48} />
        <p className="text-text-secondary font-medium">Validando convite seguro...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-surface/50 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-cs-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-cs-green" size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Defina sua Senha</h1>
          <p className="text-sm text-text-secondary mt-2">
            Bem-vindo(a)! Para ativar sua conta e acessar a plataforma, crie uma senha segura.
          </p>
        </div>

        {message.text && (
          <div className={`p-4 rounded-md mb-6 text-sm font-bold flex items-center gap-2 ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-cs-green/10 text-cs-green border border-cs-green/20'}`}>
            {message.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Nova Senha</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="block w-full rounded-md border border-surface bg-background px-4 py-3 text-white focus:border-cs-green focus:outline-none transition-colors" 
              placeholder="Mínimo 6 caracteres" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Confirmar Senha</label>
            <input 
              type="password" 
              required 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className="block w-full rounded-md border border-surface bg-background px-4 py-3 text-white focus:border-cs-green focus:outline-none transition-colors" 
              placeholder="Digite a senha novamente" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full flex justify-center items-center gap-2 rounded-md bg-cs-green py-3 px-4 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
            Salvar e Acessar
          </button>
        </form>
      </div>
    </div>
  );
}