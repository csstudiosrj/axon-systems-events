"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";

function formatCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/(\d{3})-?(\d{2})$/, "$1-$2");
}

export default function ColaboradorLoginPage() {
  const router = useRouter();
  const [cpf, setCpf]             = useState("");
  const [password, setPassword]   = useState("");
  const [newPassword, setNew]     = useState("");
  const [confirmPass, setConfirm] = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [firstAccess, setFirstAccess] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [company, setCompany]     = useState<{ company_name?: string; logo_url?: string; primary_color?: string }>({});

  useEffect(() => {
    fetch("/api/portal/company")
      .then(r => r.json())
      .then(d => setCompany(d ?? {}))
      .catch(() => {});
  }, []);

  const primaryColor = company.primary_color || "#138946";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (firstAccess) {
      if (newPassword.length < 6) { setError("Senha mínima de 6 caracteres."); return; }
      if (newPassword !== confirmPass) { setError("As senhas não coincidem."); return; }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf,
          password,
          newPassword: firstAccess ? newPassword : undefined,
          isFirstAccess: firstAccess,
        }),
      });

      const data = await res.json() as { ok?: boolean; firstAccess?: boolean; error?: string };

      if (data.firstAccess) { setFirstAccess(true); setLoading(false); return; }
      if (!res.ok || data.error) { setError(data.error ?? "Erro ao entrar."); setLoading(false); return; }
      if (data.ok) router.push("/colaborador");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d0807] px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo / nome da empresa */}
        <div className="flex flex-col items-center gap-3">
          {company.logo_url
            ? <img src={company.logo_url} alt={company.company_name} className="h-14 w-auto object-contain" />
            : <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-white text-2xl font-black" style={{ backgroundColor: primaryColor }}>
                {(company.company_name ?? "A").charAt(0)}
              </div>}
          <div className="text-center">
            <p className="text-lg font-bold text-white">{company.company_name ?? "Portal"}</p>
            <p className="text-xs text-[#a19d9c]">Portal do Colaborador</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-[#1a1413] p-8 shadow-2xl">
          <h2 className="mb-1 text-base font-bold text-white">
            {firstAccess ? "Crie sua senha" : "Entrar"}
          </h2>
          <p className="mb-6 text-xs text-[#a19d9c]">
            {firstAccess
              ? "Primeiro acesso detectado. Crie uma senha para continuar."
              : "Digite seu CPF e senha para acessar."}
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
            {/* CPF */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">CPF</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a19d9c]" size={15} />
                <input
                  type="text"
                  required
                  value={cpf}
                  onChange={e => setCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-4 py-2.5 text-sm text-white outline-none placeholder:text-[#a19d9c] focus:border-[var(--color-cs-green,#138946)]"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
              </div>
            </div>

            {/* Senha atual (sempre visível) */}
            {!firstAccess && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a19d9c]" size={15} />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-10 py-2.5 text-sm text-white outline-none placeholder:text-[#a19d9c]"
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a19d9c] hover:text-white">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Primeiro acesso: nova senha */}
            {firstAccess && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a19d9c]" size={15} />
                    <input type={showPass ? "text" : "password"} required value={newPassword} onChange={e => setNew(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-10 py-2.5 text-sm text-white outline-none placeholder:text-[#a19d9c]" />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a19d9c] hover:text-white">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a19d9c]" size={15} />
                    <input type="password" required value={confirmPass} onChange={e => setConfirm(e.target.value)}
                      placeholder="Repita a senha"
                      className="w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-4 py-2.5 text-sm text-white outline-none placeholder:text-[#a19d9c]" />
                  </div>
                </div>
              </>
            )}

            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}>
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              {loading ? "Aguarde…" : firstAccess ? "Criar senha e entrar" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#a19d9c]">
          Problemas para acessar? Fale com o RH da sua empresa.
        </p>
      </div>
    </div>
  );
}