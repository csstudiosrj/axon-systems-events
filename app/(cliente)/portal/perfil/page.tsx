"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  Shield,
  Upload,
  UserCircle2,
  Users,
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
  phone?: string | null;
  avatar_url?: string | null;
  client_id?: string | null;
}

interface ClientData {
  id: string;
  company_name?: string | null;
  legal_name?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const INPUT_CLASS =
  "w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20 placeholder:text-zinc-600";

const INPUT_DISABLED_CLASS =
  "w-full cursor-not-allowed rounded-2xl border border-white/10 bg-[#0d0807]/70 px-4 py-3 text-sm text-zinc-500 outline-none";

type Tab = "perfil" | "empresa" | "equipe" | "seguranca";

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("perfil");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [client, setClient] = useState<ClientData | null>(null);
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientState, setClientState] = useState("");
  const [clientZip, setClientZip] = useState("");

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const initials = useMemo(() => {
    const name = profile?.full_name?.trim();
    if (name) {
      const parts = name.split(" ").filter(Boolean);
      return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
    }
    if (profile?.email) return profile.email.substring(0, 2).toUpperCase();
    return "US";
  }, [profile]);

  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((c) => [...c, { id, type, title, message }]);
    window.setTimeout(() => {
      setToasts((c) => c.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((c) => c.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Não autenticado.");

        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, role, phone, avatar_url, client_id")
          .eq("id", session.user.id)
          .single();

        if (pErr) throw pErr;

        const profileData: UserProfile = {
          ...p,
          email: session.user.email ?? null,
        };

        setProfile(profileData);
        setFullName(p.full_name ?? "");
        setPhone(p.phone ?? "");

        if (p.client_id) {
          const { data: c } = await supabase
            .from("clients")
            .select("id, company_name, legal_name, cnpj, phone, email, address, city, state, zip_code")
            .eq("id", p.client_id)
            .single();

          if (c) {
            setClient(c);
            setClientPhone(c.phone ?? "");
            setClientEmail(c.email ?? "");
            setClientAddress(c.address ?? "");
            setClientCity(c.city ?? "");
            setClientState(c.state ?? "");
            setClientZip(c.zip_code ?? "");
          }

          const { data: team } = await supabase
            .from("profiles")
            .select("id, full_name, email, role, phone, avatar_url")
            .eq("client_id", p.client_id)
            .neq("id", session.user.id);

          setTeamMembers((team ?? []) as TeamMember[]);
        }
      } catch (err) {
        addToast("error", "Erro ao carregar", err instanceof Error ? err.message : "Tente novamente.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [addToast]);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast("error", "Arquivo muito grande", "A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${profile.id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;

      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);
      setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      addToast("success", "Foto atualizada", "Sua foto de perfil foi atualizada.");
    } catch (err) {
      addToast("error", "Erro no upload", err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setUploadingAvatar(false);
    }
  }, [profile, addToast]);

  const handleSaveProfile = useCallback(async () => {
    if (!profile?.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile((prev) => prev ? { ...prev, full_name: fullName.trim(), phone: phone.trim() } : prev);
      addToast("success", "Perfil atualizado", "Seus dados foram salvos com sucesso.");
    } catch (err) {
      addToast("error", "Erro ao salvar", err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  }, [profile, fullName, phone, addToast]);

  const handleSaveCompany = useCallback(async () => {
    if (!client?.id) return;
    setSavingCompany(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          phone: clientPhone.trim(),
          email: clientEmail.trim(),
          address: clientAddress.trim(),
          city: clientCity.trim(),
          state: clientState.trim(),
          zip_code: clientZip.trim(),
        })
        .eq("id", client.id);
      if (error) throw error;
      addToast("success", "Empresa atualizada", "Os dados da empresa foram salvos.");
    } catch (err) {
      addToast("error", "Erro ao salvar empresa", err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setSavingCompany(false);
    }
  }, [client, clientPhone, clientEmail, clientAddress, clientCity, clientState, clientZip, addToast]);

  const handleUpdatePassword = useCallback(async () => {
    if (!password || !confirmPassword) {
      addToast("error", "Campos obrigatórios", "Preencha e confirme a nova senha.");
      return;
    }
    if (password.length < 6) {
      addToast("error", "Senha inválida", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      addToast("error", "Senhas diferentes", "A confirmação não confere.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      addToast("success", "Senha atualizada", "Sua senha foi redefinida com sucesso.");
    } catch (err) {
      addToast("error", "Erro ao atualizar senha", err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setSavingPassword(false);
    }
  }, [password, confirmPassword, addToast]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "perfil", label: "Meus Dados", icon: <UserCircle2 className="h-4 w-4" /> },
    { key: "empresa", label: "Empresa", icon: <Building2 className="h-4 w-4" /> },
    { key: "equipe", label: "Equipe no Portal", icon: <Users className="h-4 w-4" /> },
    { key: "seguranca", label: "Segurança", icon: <KeyRound className="h-4 w-4" /> },
  ];

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
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
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
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                    Gerencie seus dados pessoais, dados da empresa e acesso da sua equipe ao portal.
                  </p>
                </div>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="h-14 w-14 rounded-2xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#120e0d] text-sm font-bold text-[#79d89f]">
                      {initials}
                    </div>
                  )}
                  <label
                    htmlFor="avatar-upload"
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[#138946] text-white shadow transition hover:bg-[#0f723b]"
                    title="Trocar foto"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleAvatarUpload(e)}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{profile?.full_name || "Usuário"}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{profile?.email || ""}</p>
                  {client && (
                    <p className="mt-1 text-xs text-[#79d89f]">{client.company_name || client.legal_name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#1a1413] p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-[#138946] text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Meus Dados */}
        {activeTab === "perfil" && (
          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Dados pessoais</h2>
                <p className="mt-1 text-sm text-zinc-400">Nome e telefone do seu usuário de acesso.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Nome completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className={cn(INPUT_CLASS, "pl-11")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="email"
                    value={profile?.email ?? ""}
                    disabled
                    className={cn(INPUT_DISABLED_CLASS, "pl-11")}
                  />
                </div>
                <p className="text-xs text-zinc-600">E-mail não pode ser alterado por aqui.</p>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f723b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingProfile ? "Salvando..." : "Salvar dados"}
              </button>
            </div>
          </section>
        )}

        {/* Tab: Empresa */}
        {activeTab === "empresa" && (
          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Dados da empresa</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  CNPJ e razão social são somente leitura. Telefone, e-mail e endereço podem ser editados.
                </p>
              </div>
            </div>

            {!client ? (
              <p className="mt-6 text-sm text-zinc-500">Nenhuma empresa vinculada a este perfil.</p>
            ) : (
              <>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Razão social</label>
                    <input type="text" value={client.legal_name ?? client.company_name ?? ""} disabled className={INPUT_DISABLED_CLASS} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Nome fantasia</label>
                    <input type="text" value={client.company_name ?? ""} disabled className={INPUT_DISABLED_CLASS} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">CNPJ</label>
                    <input type="text" value={client.cnpj ?? ""} disabled className={INPUT_DISABLED_CLASS} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Telefone da empresa</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className={cn(INPUT_CLASS, "pl-11")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">E-mail da empresa</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="contato@empresa.com.br"
                        className={cn(INPUT_CLASS, "pl-11")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-zinc-200">Endereço</label>
                    <input
                      type="text"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      placeholder="Rua, número, complemento"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Cidade</label>
                    <input
                      type="text"
                      value={clientCity}
                      onChange={(e) => setClientCity(e.target.value)}
                      placeholder="Cidade"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-200">Estado</label>
                      <input
                        type="text"
                        value={clientState}
                        onChange={(e) => setClientState(e.target.value)}
                        placeholder="UF"
                        maxLength={2}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-200">CEP</label>
                      <input
                        type="text"
                        value={clientZip}
                        onChange={(e) => setClientZip(e.target.value)}
                        placeholder="00000-000"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => void handleSaveCompany()}
                    disabled={savingCompany}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f723b] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingCompany ? "Salvando..." : "Salvar dados da empresa"}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* Tab: Equipe no Portal */}
        {activeTab === "equipe" && (
          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Equipe com acesso ao portal</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Usuários da sua empresa com acesso a este portal. Para adicionar ou remover, entre em contato com o suporte.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {teamMembers.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-8 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                  <p className="text-sm text-zinc-500">Nenhum outro usuário vinculado à sua empresa.</p>
                </div>
              ) : (
                teamMembers.map((member) => {
                  const memberInitials = member.full_name
                    ? member.full_name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()
                    : member.email?.substring(0, 2).toUpperCase() ?? "??";

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4"
                    >
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#120e0d] text-xs font-bold text-[#79d89f]">
                          {memberInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{member.full_name || "—"}</p>
                        <p className="truncate text-xs text-zinc-500">{member.email}</p>
                      </div>
                      {member.phone && (
                        <p className="hidden shrink-0 text-xs text-zinc-600 sm:block">{member.phone}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* Tab: Segurança */}
        {activeTab === "seguranca" && (
          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Segurança</h2>
                <p className="mt-1 text-sm text-zinc-400">Redefina sua senha de acesso.</p>
              </div>
            </div>

            <div className="mt-6 grid max-w-md gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={INPUT_CLASS}
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
        )}

      </section>

      {/* Toasts */}
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
                <div className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  isSuccess && "bg-emerald-500/15 text-emerald-400",
                  isError && "bg-rose-500/15 text-rose-400",
                  toast.type === "info" && "bg-white/10 text-zinc-200"
                )}>
                  {isSuccess ? <CheckCircle2 className="h-5 w-5" /> : isError ? <AlertCircle className="h-5 w-5" /> : <UserCircle2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{toast.title}</p>
                  <p className="mt-1 text-sm leading-5 text-zinc-400">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className={cn(
                "h-1 w-full",
                isSuccess && "bg-emerald-500/80",
                isError && "bg-rose-500/80",
                toast.type === "info" && "bg-[#138946]/80"
              )} />
            </div>
          );
        })}
      </div>
    </main>
  );
}