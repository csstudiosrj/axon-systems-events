"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  Shield,
  Upload,
  User2,
  X,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

interface AuthUserData {
  id: string;
  email: string;
}

interface ProfileRow {
  id?: string;
  user_id?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role?: string | null;
}

interface ProfileFormData {
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  role: string;
}

interface PasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

const DEFAULT_PROFILE_FORM: ProfileFormData = {
  full_name: "",
  email: "",
  phone: "",
  avatar_url: "",
  role: "admin",
};

const DEFAULT_PASSWORD_FORM: PasswordFormData = {
  newPassword: "",
  confirmPassword: "",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function getRoleLabel(role: string): string {
  const normalized = role.trim().toLowerCase();

  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Administrador",
    commercial: "Comercial",
    financial: "Financeiro",
    logistics: "Logística",
    training: "Treinamentos",
    support: "Suporte",
    client: "Cliente",
    student: "Aluno",
    subscriber: "Assinante",
  };

  return labels[normalized] ?? role;
}

export default function PerfilAdminPage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUserData | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>(DEFAULT_PROFILE_FORM);
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>(DEFAULT_PASSWORD_FORM);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast: ToastItem = { id, type, title, message };

    setToasts((current) => [...current, toast]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Usuário não autenticado.");

      const authData: AuthUserData = {
        id: user.id,
        email: user.email ?? "",
      };

      setAuthUser(authData);

      let profile: ProfileRow | null = null;

      const byUserId = await supabase
        .from("profiles")
        .select("id, user_id, full_name, phone, avatar_url, role")
        .eq("user_id", user.id)
        .maybeSingle<ProfileRow>();

      if (byUserId.error && byUserId.error.code !== "PGRST116") {
        throw byUserId.error;
      }

      profile = byUserId.data ?? null;

      if (!profile) {
        const byId = await supabase
          .from("profiles")
          .select("id, user_id, full_name, phone, avatar_url, role")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();

        if (byId.error && byId.error.code !== "PGRST116") {
          throw byId.error;
        }

        profile = byId.data ?? null;
      }

      setProfileId(profile?.id ?? null);
      setFormData({
        full_name: profile?.full_name ?? "",
        email: authData.email,
        phone: profile?.phone ?? "",
        avatar_url: profile?.avatar_url ?? "",
        role: profile?.role ?? "admin",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível carregar o perfil.";
      addToast("error", "Erro ao carregar", message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const updateField = useCallback(
    <K extends keyof ProfileFormData>(field: K, value: ProfileFormData[K]) => {
      setFormData((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const updatePasswordField = useCallback(
    <K extends keyof PasswordFormData>(field: K, value: PasswordFormData[K]) => {
      setPasswordForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const handleAvatarUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) return;

      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        addToast("error", "Arquivo inválido", "Selecione uma imagem válida para o avatar.");
        event.target.value = "";
        return;
      }

      if (!authUser?.id) {
        addToast("error", "Sessão inválida", "Não foi possível identificar o usuário atual.");
        event.target.value = "";
        return;
      }

      setUploadingAvatar(true);

      try {
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
        const filePath = `avatars/admin-${authUser.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("axon-assets")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);
        const publicUrl = data.publicUrl;

        if (!publicUrl) {
          throw new Error("Não foi possível gerar a URL pública do avatar.");
        }

        setFormData((current) => ({
          ...current,
          avatar_url: publicUrl,
        }));

        addToast("success", "Avatar enviado", "A nova foto foi carregada com sucesso.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha no upload da imagem.";
        addToast("error", "Erro no upload", message);
      } finally {
        setUploadingAvatar(false);
        event.target.value = "";
      }
    },
    [addToast, authUser?.id]
  );

  const handleSaveProfile = useCallback(async () => {
    if (!authUser?.id) {
      addToast("error", "Sessão inválida", "Não foi possível identificar o usuário atual.");
      return;
    }

    setSavingProfile(true);

    try {
      const payload = {
        user_id: authUser.id,
        full_name: formData.full_name.trim() || null,
        phone: formData.phone.trim() || null,
        avatar_url: formData.avatar_url.trim() || null,
      };

      let updated = false;

      if (profileId) {
        const updateById = await supabase.from("profiles").update(payload).eq("id", profileId);
        if (!updateById.error) {
          updated = true;
        }
      }

      if (!updated) {
        const updateByUserId = await supabase
          .from("profiles")
          .update(payload)
          .eq("user_id", authUser.id);

        if (!updateByUserId.error) {
          updated = true;
        }
      }

      if (!updated) {
        const insertResult = await supabase
          .from("profiles")
          .insert({
            ...payload,
            role: formData.role || "admin",
          })
          .select("id, user_id, role")
          .single<ProfileRow>();

        if (insertResult.error) throw insertResult.error;
        setProfileId(insertResult.data?.id ?? null);
      }

      addToast("success", "Perfil salvo", "Seus dados de perfil foram atualizados.");
      await fetchProfile();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar o perfil.";
      addToast("error", "Erro ao salvar", message);
    } finally {
      setSavingProfile(false);
    }
  }, [addToast, authUser?.id, fetchProfile, formData, profileId]);

  const handleChangePassword = useCallback(async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      addToast("error", "Campos obrigatórios", "Preencha e confirme a nova senha.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      addToast("error", "Senha fraca", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast("error", "Senhas diferentes", "A confirmação da senha não confere.");
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      setPasswordForm(DEFAULT_PASSWORD_FORM);
      addToast("success", "Senha atualizada", "Sua senha foi alterada com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível atualizar a senha.";
      addToast("error", "Erro ao atualizar senha", message);
    } finally {
      setSavingPassword(false);
    }
  }, [addToast, passwordForm]);

  const initials = useMemo(() => {
    const name = formData.full_name.trim();
    if (!name) return "AD";

    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [formData.full_name]);

  return (
    <main className="min-h-screen bg-[#0d0807] text-zinc-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-[#1a1413] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                <User2 className="h-3.5 w-3.5" />
                Perfil Admin
              </span>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Meu Perfil
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                  Atualize seus dados de acesso, contato e segurança da conta administrativa.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={savingProfile || loading}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium transition-all",
                "bg-[#138946] text-white shadow-lg shadow-[#138946]/20 hover:bg-[#0f723b]",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {savingProfile ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </header>

        {loading ? (
          <section className="rounded-3xl border border-white/10 bg-[#1a1413] p-6">
            <div className="flex min-h-[420px] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                <Loader2 className="h-4 w-4 animate-spin text-[#138946]" />
                Carregando perfil...
              </div>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <section className="rounded-3xl border border-white/10 bg-[#1a1413] p-5">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#120e0d] text-2xl font-semibold text-white">
                      {formData.avatar_url ? (
                        <img
                          src={formData.avatar_url}
                          alt="Avatar do administrador"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>

                    <label className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-[#138946] text-white shadow-lg shadow-[#138946]/20 transition hover:bg-[#0f723b]">
                      {uploadingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleAvatarUpload(e)}
                        disabled={uploadingAvatar}
                      />
                    </label>
                  </div>

                  <h2 className="mt-5 text-lg font-semibold text-white">
                    {formData.full_name || "Administrador"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">{formData.email || "Sem e-mail"}</p>

                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
                    <Shield className="h-3.5 w-3.5 text-sky-300" />
                    {getRoleLabel(formData.role)}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-[#1a1413] p-5">
                <h3 className="text-sm font-semibold text-white">Resumo da conta</h3>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-[#120e0d] p-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      E-mail de acesso
                    </span>
                    <p className="mt-2 text-sm text-zinc-200">{formData.email || "Não informado"}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#120e0d] p-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Telefone</span>
                    <p className="mt-2 text-sm text-zinc-200">{formData.phone || "Não informado"}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#120e0d] p-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Perfil</span>
                    <p className="mt-2 text-sm text-zinc-200">{getRoleLabel(formData.role)}</p>
                  </div>
                </div>
              </section>
            </aside>

            <section className="space-y-6">
              <section className="rounded-3xl border border-white/10 bg-[#1a1413] p-5 sm:p-6">
                <div className="border-b border-white/10 pb-5">
                  <h2 className="text-xl font-semibold text-white">Dados do administrador</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Atualize seus dados principais. O e-mail é exibido a partir da conta autenticada.
                  </p>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <User2 className="h-4 w-4 text-[#72d39c]" />
                      Nome completo
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => updateField("full_name", e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <Mail className="h-4 w-4 text-[#72d39c]" />
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-[#120e0d] px-4 py-3 text-sm text-zinc-400 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <Shield className="h-4 w-4 text-[#72d39c]" />
                      Perfil de acesso
                    </label>
                    <input
                      type="text"
                      value={getRoleLabel(formData.role)}
                      disabled
                      className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-[#120e0d] px-4 py-3 text-sm text-zinc-400 outline-none"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <Phone className="h-4 w-4 text-[#72d39c]" />
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                      placeholder="(21) 99999-9999"
                      className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <ImageIcon className="h-4 w-4 text-[#72d39c]" />
                      URL do avatar
                    </label>
                    <input
                      type="url"
                      value={formData.avatar_url}
                      onChange={(e) => updateField("avatar_url", e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-[#1a1413] p-5 sm:p-6">
                <div className="border-b border-white/10 pb-5">
                  <h2 className="text-xl font-semibold text-white">Segurança</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Defina uma nova senha para sua conta administrativa.
                  </p>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <Lock className="h-4 w-4 text-[#72d39c]" />
                      Nova senha
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => updatePasswordField("newPassword", e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                      className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <Lock className="h-4 w-4 text-[#72d39c]" />
                      Confirmar senha
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => updatePasswordField("confirmPassword", e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleChangePassword()}
                    disabled={savingPassword}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium transition-all",
                      "bg-sky-600 text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500",
                      "disabled:cursor-not-allowed disabled:opacity-60"
                    )}
                  >
                    {savingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {savingPassword ? "Atualizando..." : "Atualizar senha"}
                  </button>

                  <p className="text-sm text-zinc-500">
                    A troca é aplicada diretamente à conta autenticada.
                  </p>
                </div>
              </section>
            </section>
          </div>
        )}
      </section>

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";

          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto overflow-hidden rounded-2xl border backdrop-blur-xl",
                "bg-[#1a1413]/95 shadow-2xl",
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
                    <User2 className="h-5 w-5" />
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
                  toast.type === "info" && "bg-sky-500/80"
                )}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
}