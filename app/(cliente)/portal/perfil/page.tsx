"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Save,
  Shield,
  UserCircle2,
  X,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email?: string | null;
  role?: string | null;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const initials = useMemo(() => {
    if (!profile?.email) return "US";
    return profile.email.substring(0, 2).toUpperCase();
  }, [profile]);

  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, type, title, message }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session?.user) throw new Error("Usuário não autenticado.");

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", session.user.id)
          .single<UserProfile>();

        if (error) throw error;

        setProfile({
          id: data.id,
          full_name: data.full_name,
          role: data.role ?? null,
          email: session.user.email ?? null,
        });

        setFullName(data.full_name ?? "");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível carregar o perfil.";
        addToast("error", "Erro ao carregar", message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [addToast]);

  const handleSaveProfile = useCallback(async () => {
    if (!profile?.id) {
      addToast("error", "Usuário inválido", "Não foi possível identificar o usuário logado.");
      return;
    }

    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile((current) =>
        current
          ? {
              ...current,
              full_name: fullName.trim(),
            }
          : current
      );

      addToast("success", "Perfil atualizado", "Seu nome foi atualizado com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível atualizar o perfil.";
      addToast("error", "Erro ao salvar", message);
    } finally {
      setSavingProfile(false);
    }
  }, [addToast, fullName, profile]);

  const handleUpdatePassword = useCallback(async () => {
    if (!password || !confirmPassword) {
      addToast("error", "Campos obrigatórios", "Preencha e confirme a nova senha.");
      return;
    }

    if (password.length < 6) {
      addToast("error", "Senha inválida", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      addToast("error", "Senhas diferentes", "A confirmação da senha não confere.");
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setPassword("");
      setConfirmPassword("");

      addToast("success", "Senha atualizada", "Sua senha foi redefinida com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível atualizar a senha.";
      addToast("error", "Erro ao atualizar senha", message);
    } finally {
      setSavingPassword(false);
    }
  }, [addToast, confirmPassword, password]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d0807] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1413] px-5 py-4 text-sm text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin text-[#138946]" />
            Carregando perfil...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0807] text-white">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1413] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="relative p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(19,137,70,0.18),transparent_30%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#138946]/30 bg-[#138946]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#79d89f]">
                  <Shield className="h-3.5 w-3.5" />
                  Meu Perfil
                </span>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Configurações da Conta
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                    Atualize seus dados pessoais e redefina sua senha com segurança.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#120e0d] text-sm font-bold text-[#79d89f]">
                    {initials}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {profile?.full_name || "Usuário"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{profile?.email || ""}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Dados do perfil</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Você só pode editar seus próprios dados.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Nome completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">E-mail</label>
                <input
                  type="email"
                  value={profile?.email ?? ""}
                  disabled
                  className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-[#0d0807]/70 px-4 py-3 text-sm text-zinc-500 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f723b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingProfile ? "Salvando..." : "Salvar perfil"}
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Segurança</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Redefina sua senha de acesso com segurança.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleUpdatePassword()}
                disabled={savingPassword}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#138946]/40 hover:bg-[#138946]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {savingPassword ? "Atualizando..." : "Atualizar senha"}
              </button>
            </div>
          </section>
        </div>
      </section>

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";

          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto overflow-hidden rounded-2xl border bg-[#1a1413]/95 shadow-2xl backdrop-blur-xl",
                isSuccess && "border-emerald-500/30",
                isError && "border-rose-500/30",
                toast.type === "info" && "border-white/10"
              )}
            >
              <div className="flex items-start gap-3 p-4">
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    isSuccess && "bg-emerald-500/15 text-emerald-400",
                    isError && "bg-rose-500/15 text-rose-400",
                    toast.type === "info" && "bg-white/10 text-zinc-200"
                  )}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isError ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <UserCircle2 className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{toast.title}</p>
                  <p className="mt-1 text-sm leading-5 text-zinc-400">{toast.message}</p>
                </div>

                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                  aria-label="Fechar notificação"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                className={cn(
                  "h-1 w-full",
                  isSuccess && "bg-emerald-500/80",
                  isError && "bg-rose-500/80",
                  toast.type === "info" && "bg-[#138946]/80"
                )}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
}