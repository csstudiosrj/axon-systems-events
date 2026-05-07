"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  Trash2,
  Upload,
  UserCircle2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";
interface ToastItem { id: number; type: ToastType; title: string; message: string; }

interface UserProfile {
  id: string;
  full_name: string | null;
  email?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  client_id?: string | null;
}

interface ClientData {
  id: string;
  company_name: string | null;
  legal_name: string | null;
  document: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  number: string | null;
  complement: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface ConfirmDialog { isOpen: boolean; userId: string; userName: string; }

interface IbgeState { id: number; sigla: string; nome: string; }
interface IbgeCity  { id: number; nome: string; }

// ─── Roles do portal do cliente ──────────────────────────────────────────────

const ACCESS_ROLES = [
  { value: "client_gestor",     label: "Gestor",     desc: "Acesso completo a todos os módulos" },
  { value: "client_comercial",  label: "Comercial",  desc: "Orçamentos e suporte" },
  { value: "client_financeiro", label: "Financeiro", desc: "Faturas, pagamentos e suporte" },
  { value: "client_operador",   label: "Operador",   desc: "Academy — treinamentos da equipe" },
];

// ─── Masks ────────────────────────────────────────────────────────────────────

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, (_: string, a: string, b: string, c: string) => `(${a}) ${b}${c ? `-${c}` : ""}`).trim();
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, (_: string, a: string, b: string, c: string) => `(${a}) ${b}${c ? `-${c}` : ""}`).trim();
}

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskCEP(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cn(...c: Array<string | false | null | undefined>) { return c.filter(Boolean).join(" "); }

const BASE_INPUT =
  "w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20 placeholder:text-zinc-600";

const DISABLED_INPUT =
  "w-full cursor-not-allowed rounded-2xl border border-white/10 bg-[#0d0807]/70 px-4 py-3 text-sm text-zinc-500 outline-none";

type Tab = "perfil" | "empresa" | "equipe" | "seguranca";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const [loading, setLoading]               = useState(true);
  const [savingProfile, setSavingProfile]   = useState(false);
  const [savingCompany, setSavingCompany]   = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [fetchingCep, setFetchingCep]       = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("perfil");

  // perfil
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [fullName, setFullName]         = useState("");
  const [userEmail, setUserEmail]       = useState("");
  const [userPhone, setUserPhone]       = useState("");
  const [userJobTitle, setUserJobTitle] = useState("");

  // senha
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  // empresa — campos separados mapeados para as colunas reais do banco
  const [client, setClient]               = useState<ClientData | null>(null);
  const [companyName, setCompanyName]     = useState("");
  const [legalName, setLegalName]         = useState("");
  const [cnpj, setCnpj]                   = useState("");
  const [contactName, setContactName]     = useState("");
  const [clientPhone, setClientPhone]     = useState("");
  const [clientEmail, setClientEmail]     = useState("");
  const [clientSite, setClientSite]       = useState("");
  const [cep, setCep]                     = useState("");
  const [street, setStreet]               = useState("");
  const [number, setNumber]               = useState("");
  const [complement, setComplement]       = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity]   = useState("");
  const [states, setStates]               = useState<IbgeState[]>([]);
  const [cities, setCities]               = useState<IbgeCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // equipe
  const [teamMembers, setTeamMembers]             = useState<TeamMember[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail]             = useState("");
  const [inviteName, setInviteName]               = useState("");
  const [inviteAccessRole, setInviteAccessRole]   = useState("client_operador");
  const [confirmModal, setConfirmModal]           = useState<ConfirmDialog>({ isOpen: false, userId: "", userName: "" });

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const initials = useMemo(() => {
    const name = profile?.full_name?.trim();
    if (name) {
      const p = name.split(" ").filter(Boolean);
      return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
    }
    return profile?.email?.substring(0, 2).toUpperCase() ?? "US";
  }, [profile]);

  // ─── Toasts ───────────────────────────────────────────────────────────────

  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((c) => [...c, { id, type, title, message }]);
    window.setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), 4500);
  }, []);

  const removeToast = useCallback((id: number) => setToasts((c) => c.filter((t) => t.id !== id)), []);

  // ─── IBGE: estados ────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((r) => r.json())
      .then((data: IbgeState[]) => setStates(data))
      .catch(() => {});
  }, []);

  // ─── IBGE: cidades ao trocar estado ──────────────────────────────────────

  useEffect(() => {
    if (!selectedState) { setCities([]); setSelectedCity(""); return; }
    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedState}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((data: IbgeCity[]) => setCities(data))
      .catch(() => {})
      .finally(() => setLoadingCities(false));
  }, [selectedState]);

  // ─── CEP lookup ───────────────────────────────────────────────────────────

  const pendingCityRef = useRef<string | null>(null);

  const handleCepBlur = useCallback(async () => {
    const raw = cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setFetchingCep(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (data.erro) { addToast("error", "CEP não encontrado", "Verifique o CEP e tente novamente."); return; }
      setStreet(data.logradouro ?? "");
      setComplement(data.complemento ?? "");
      setSelectedState(data.uf ?? "");
      pendingCityRef.current = data.localidade ?? null;
    } catch {
      addToast("error", "Erro ao buscar CEP", "Tente novamente.");
    } finally {
      setFetchingCep(false);
    }
  }, [cep, addToast]);

  useEffect(() => {
    if (!pendingCityRef.current || cities.length === 0) return;
    const target = pendingCityRef.current.toLowerCase();
    const match  = cities.find((c) => c.nome.toLowerCase() === target);
    if (match) setSelectedCity(match.nome);
    pendingCityRef.current = null;
  }, [cities]);

  // ─── Load team ────────────────────────────────────────────────────────────

  const loadTeam = useCallback(async (clientId: string, selfId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, avatar_url, created_at")
      .eq("client_id", clientId)
      .neq("id", selfId)
      .order("created_at", { ascending: false });
    setTeamMembers((data ?? []) as TeamMember[]);
  }, []);

  // ─── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Não autenticado.");

        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, role, avatar_url, client_id")
          .eq("id", session.user.id)
          .single();
        if (pErr) throw pErr;

        setProfile({ ...p, email: session.user.email ?? null });
        setFullName(p.full_name ?? "");

        if (p.client_id) {
          const { data: c, error: cErr } = await supabase
            .from("clients")
            .select("id, company_name, legal_name, document, contact_name, email, phone, address, website, number, complement, city, state, zip_code")
            .eq("id", p.client_id)
            .single();
          if (cErr) throw cErr;
          if (c) {
            setClient(c as ClientData);
            setCompanyName(c.company_name ?? "");
            setLegalName(c.legal_name ?? "");
            setCnpj(c.document ? maskCNPJ(c.document) : "");
            setContactName(c.contact_name ?? "");
            setClientPhone(c.phone ? maskPhone(c.phone) : "");
            setClientEmail(c.email ?? "");
            setClientSite(c.website ?? "");
            setStreet(c.address ?? "");
            setNumber(c.number ?? "");
            setComplement(c.complement ?? "");
            setSelectedCity(c.city ?? "");
            setSelectedState(c.state ?? "");
            setCep(c.zip_code ? maskCEP(c.zip_code) : "");
          }
          await loadTeam(p.client_id, session.user.id);
        }
      } catch (err) {
        addToast("error", "Erro ao carregar", err instanceof Error ? err.message : "Tente novamente.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [addToast, loadTeam]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  // Avatar — path sem prefixo de pasta pois o bucket já se chama "avatars"
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    if (file.size > 2 * 1024 * 1024) { addToast("error", "Arquivo muito grande", "Máximo 2MB."); return; }
    setUploadingAvatar(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `avatars/${profile.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("files-main")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("files-main").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", profile.id);
      setProfile((prev) => prev ? { ...prev, avatar_url: urlData.publicUrl } : prev);
      addToast("success", "Foto atualizada", "Sua foto foi atualizada com sucesso.");
    } catch (err) {
      addToast("error", "Erro no upload", err instanceof Error ? err.message : "Tente novamente.");
    } finally { setUploadingAvatar(false); }
  }, [profile, addToast]);

  const handleSaveProfile = useCallback(async () => {
    if (!profile?.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile((prev) => prev ? { ...prev, full_name: fullName.trim() } : prev);
      addToast("success", "Perfil atualizado", "Seus dados foram salvos.");
    } catch (err) {
      addToast("error", "Erro ao salvar", err instanceof Error ? err.message : "Tente novamente.");
    } finally { setSavingProfile(false); }
  }, [profile, fullName, addToast]);

  const handleSaveCompany = useCallback(async () => {
    if (!client?.id) return;
    setSavingCompany(true);
    try {
      const { error } = await supabase.from("clients").update({
        company_name: companyName.trim(),
        legal_name:   legalName.trim(),
        document:     cnpj.replace(/\D/g, ""),
        contact_name: contactName.trim(),
        phone:        clientPhone.replace(/\D/g, ""),
        email:        clientEmail.trim(),
        website:      clientSite.trim(),
        address:      street.trim(),
        number:       number.trim(),
        complement:   complement.trim(),
        city:         selectedCity,
        state:        selectedState,
        zip_code:     cep.replace(/\D/g, ""),
      }).eq("id", client.id);
      if (error) throw error;
      addToast("success", "Empresa atualizada", "Os dados foram salvos.");
    } catch (err) {
      addToast("error", "Erro ao salvar", err instanceof Error ? err.message : "Tente novamente.");
    } finally { setSavingCompany(false); }
  }, [client, companyName, legalName, cnpj, contactName, clientPhone, clientEmail, clientSite, street, number, complement, selectedCity, selectedState, cep, addToast]);

  const handleInviteUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) { addToast("error", "Campo obrigatório", "Informe o e-mail."); return; }
    setIsProcessing(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:      "invite",
          email:       inviteEmail,
          fullName:    inviteName,
          role:        inviteAccessRole,
          clientId:    profile?.client_id,
          inviterId:   profile?.id,
          inviterRole: profile?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar convite.");
      addToast("success", "Convite enviado!", "O usuário receberá um e-mail para definir a senha.");
      setIsInviteModalOpen(false);
      setInviteEmail(""); setInviteName(""); setInviteAccessRole("client_operador");
      if (profile?.client_id && profile?.id) await loadTeam(profile.client_id, profile.id);
    } catch (err) {
      addToast("error", "Erro ao convidar", err instanceof Error ? err.message : "Tente novamente.");
    } finally { setIsProcessing(false); }
  }, [inviteEmail, inviteName, inviteAccessRole, profile, loadTeam, addToast]);

  const handleRevokeAccess = useCallback(async () => {
    if (!confirmModal.userId) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from("profiles")
        .update({ client_id: null, role: "subscriber" })
        .eq("id", confirmModal.userId);
      if (error) throw error;
      setConfirmModal({ isOpen: false, userId: "", userName: "" });
      addToast("success", "Acesso revogado", "Usuário removido do portal.");
      if (profile?.client_id && profile?.id) await loadTeam(profile.client_id, profile.id);
    } catch (err) {
      addToast("error", "Erro ao revogar", err instanceof Error ? err.message : "Tente novamente.");
    } finally { setIsProcessing(false); }
  }, [confirmModal, profile, loadTeam, addToast]);

  const handleUpdatePassword = useCallback(async () => {
    if (!password || !confirmPassword) { addToast("error", "Campos obrigatórios", "Preencha ambos os campos."); return; }
    if (password.length < 6)           { addToast("error", "Senha inválida",       "Mínimo 6 caracteres.");     return; }
    if (password !== confirmPassword)  { addToast("error", "Senhas diferentes",    "A confirmação não confere."); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirmPassword("");
      addToast("success", "Senha atualizada", "Sua senha foi redefinida.");
    } catch (err) {
      addToast("error", "Erro ao atualizar", err instanceof Error ? err.message : "Tente novamente.");
    } finally { setSavingPassword(false); }
  }, [password, confirmPassword, addToast]);

  // ─── Tabs config ──────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "perfil",    label: "Meus Dados",      icon: <UserCircle2 className="h-4 w-4" /> },
    { key: "empresa",   label: "Empresa",          icon: <Building2   className="h-4 w-4" /> },
    { key: "equipe",    label: "Equipe no Portal", icon: <Users       className="h-4 w-4" /> },
    { key: "seguranca", label: "Segurança",        icon: <KeyRound    className="h-4 w-4" /> },
  ];

  const roleLabelMap = Object.fromEntries(ACCESS_ROLES.map((r) => [r.value, r.label]));

  if (loading) return (
    <main className="min-h-screen bg-[#0d0807] text-white">
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1413] px-5 py-4 text-sm text-zinc-300">
          <Loader2 className="h-5 w-5 animate-spin text-[#138946]" />
          Carregando...
        </div>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#0d0807] text-white">

      {/* ── Modal: Revogar acesso ──────────────────────────────────────────── */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1413] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <Trash2 size={28} />
            </div>
            <h3 className="mb-2 text-xl font-bold text-white">Revogar Acesso?</h3>
            <p className="mb-6 text-sm text-zinc-400">
              <strong className="text-white">{confirmModal.userName}</strong> perderá imediatamente o acesso ao portal.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, userId: "", userName: "" })}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => void handleRevokeAccess()}
                disabled={isProcessing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, Revogar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Convidar ───────────────────────────────────────────────── */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#1a1413] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-6 py-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-white">
                <Mail className="h-5 w-5 text-[#138946]" /> Convidar para o Portal
              </h2>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="mb-5 text-sm text-zinc-400">
                O usuário receberá um e-mail com link seguro para definir a senha e acessar o portal.
              </p>
              <form onSubmit={(e) => void handleInviteUser(e)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-200">Nome completo</label>
                  <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Ex: Maria Silva" className={BASE_INPUT} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-200">E-mail *</label>
                  <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="maria@suaempresa.com.br" className={BASE_INPUT} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-200">Nível de acesso *</label>
                  <select value={inviteAccessRole} onChange={(e) => setInviteAccessRole(e.target.value)} className={cn(BASE_INPUT, "cursor-pointer")}>
                    {ACCESS_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end border-t border-white/10 pt-4">
                  <button type="submit" disabled={isProcessing}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f723b] disabled:opacity-50">
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Enviar Convite
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1413]">
          <div className="relative p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(19,137,70,0.18),transparent_30%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#138946]/30 bg-[#138946]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#79d89f]">
                  <Shield className="h-3.5 w-3.5" /> Configurações
                </span>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Configurações da Conta</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Gerencie seus dados, dados da empresa e a equipe com acesso ao portal.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                <div className="relative">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="Avatar" className="h-14 w-14 rounded-2xl border border-white/10 object-cover" />
                    : <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#120e0d] text-sm font-bold text-[#79d89f]">{initials}</div>
                  }
                  <label htmlFor="avatar-upload" className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[#138946] text-white shadow transition hover:bg-[#0f723b]" title="Trocar foto">
                    {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  </label>
                  <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={(e) => void handleAvatarUpload(e)} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{profile?.full_name || "Usuário"}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{profile?.email || ""}</p>
                  {client && <p className="mt-1 text-xs text-[#79d89f]">{client.company_name}</p>}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#1a1413] p-1.5">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.key ? "bg-[#138946] text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* ── Aba: Meus Dados ─────────────────────────────────────────────── */}
        {activeTab === "perfil" && (
          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Dados pessoais</h2>
                <p className="mt-1 text-sm text-zinc-400">Seus dados de contato e cargo.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Nome completo</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className={BASE_INPUT} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Cargo / Função</label>
                <input type="text" value={userJobTitle} onChange={(e) => setUserJobTitle(e.target.value)} placeholder="Ex: Gerente Financeiro" className={BASE_INPUT} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">E-mail de contato</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="seuemail@empresa.com.br" className={cn(BASE_INPUT, "pl-11")} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input type="tel" value={userPhone} onChange={(e) => setUserPhone(maskPhone(e.target.value))} maxLength={15} placeholder="(00) 00000-0000" className={cn(BASE_INPUT, "pl-11")} />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-zinc-200">E-mail de login</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <input type="email" value={profile?.email ?? ""} disabled className={cn(DISABLED_INPUT, "pl-11")} />
                </div>
                <p className="text-xs text-zinc-600">E-mail de login não pode ser alterado por aqui.</p>
              </div>
            </div>
            <div className="mt-6">
              <button type="button" onClick={() => void handleSaveProfile()} disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f723b] disabled:opacity-60">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingProfile ? "Salvando..." : "Salvar dados"}
              </button>
            </div>
          </section>
        )}

        {/* ── Aba: Empresa ────────────────────────────────────────────────── */}
        {activeTab === "empresa" && (
          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Dados da empresa</h2>
                <p className="mt-1 text-sm text-zinc-400">Razão social, nome fantasia, endereço e contato.</p>
              </div>
            </div>

            {!client ? (
              <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-8 text-center">
                <Building2 className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">Nenhuma empresa vinculada a este perfil.</p>
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Razão social</label>
                    <input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Razão social" className={BASE_INPUT} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Nome fantasia</label>
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome fantasia" className={BASE_INPUT} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">CNPJ</label>
                    <input type="text" value={cnpj} onChange={(e) => setCnpj(maskCNPJ(e.target.value))} maxLength={18} placeholder="00.000.000/0000-00" className={BASE_INPUT} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Pessoa de contato</label>
                    <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome do responsável" className={BASE_INPUT} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(maskPhone(e.target.value))} maxLength={15} placeholder="(00) 00000-0000" className={cn(BASE_INPUT, "pl-11")} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">E-mail da empresa</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="contato@empresa.com.br" className={cn(BASE_INPUT, "pl-11")} />
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-zinc-200">Site</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input type="url" value={clientSite} onChange={(e) => setClientSite(e.target.value)} placeholder="https://www.suaempresa.com.br" className={cn(BASE_INPUT, "pl-11")} />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 shrink-0 text-[#79d89f]" />
                      <span className="text-sm font-semibold text-zinc-300">Endereço</span>
                      <div className="flex-1 border-t border-white/10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">CEP</label>
                    <div className="relative">
                      <input type="text" value={cep} onChange={(e) => setCep(maskCEP(e.target.value))} onBlur={() => void handleCepBlur()} maxLength={9} placeholder="00000-000" className={BASE_INPUT} />
                      {fetchingCep && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />}
                    </div>
                    <p className="text-xs text-zinc-600">Ao sair do campo, o endereço é preenchido automaticamente.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Rua / Logradouro</label>
                    <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua, Av., Alameda..." className={BASE_INPUT} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Número</label>
                    <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" className={BASE_INPUT} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Complemento</label>
                    <input type="text" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Sala, andar, bloco..." className={BASE_INPUT} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Estado</label>
                    <select value={selectedState} onChange={(e) => { setSelectedState(e.target.value); setSelectedCity(""); }} className={cn(BASE_INPUT, "cursor-pointer")}>
                      <option value="">Selecione o estado</option>
                      {states.map((s) => <option key={s.id} value={s.sigla}>{s.sigla} — {s.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-200">Cidade</label>
                    <div className="relative">
                      <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} disabled={!selectedState || loadingCities} className={cn(BASE_INPUT, "cursor-pointer disabled:opacity-50")}>
                        <option value="">{loadingCities ? "Carregando..." : "Selecione a cidade"}</option>
                        {cities.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                      </select>
                      {loadingCities && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <button type="button" onClick={() => void handleSaveCompany()} disabled={savingCompany}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f723b] disabled:opacity-60">
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingCompany ? "Salvando..." : "Salvar dados da empresa"}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* ── Aba: Equipe ─────────────────────────────────────────────────── */}
        {activeTab === "equipe" && (
          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Equipe no portal</h2>
                  <p className="mt-1 text-sm text-zinc-400">Usuários da sua empresa com acesso.</p>
                </div>
              </div>
              <button onClick={() => setIsInviteModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f723b]">
                <UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Convidar</span>
              </button>
            </div>
            <div className="mt-6">
              {teamMembers.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-10 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                  <p className="text-sm font-medium text-white">Nenhum outro usuário no portal</p>
                  <p className="mt-1 text-xs text-zinc-500">Use o botão "Convidar" para adicionar membros.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/5">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/5 bg-white/[0.02] text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Usuário</th>
                        <th className="px-5 py-3 font-medium">Acesso</th>
                        <th className="px-5 py-3 font-medium">Desde</th>
                        <th className="px-5 py-3 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {teamMembers.map((member) => {
                        const mi = member.full_name
                          ? member.full_name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()
                          : (member.email?.substring(0, 2).toUpperCase() ?? "??");
                        return (
                          <tr key={member.id} className="transition-colors hover:bg-white/[0.02]">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                {member.avatar_url
                                  ? <img src={member.avatar_url} alt="" className="h-8 w-8 rounded-xl object-cover" />
                                  : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#120e0d] text-xs font-bold text-[#79d89f]">{mi}</div>
                                }
                                <div>
                                  <p className="font-medium text-white">{member.full_name || "Convite pendente"}</p>
                                  <p className="text-xs text-zinc-500">{member.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center rounded-full border border-[#138946]/20 bg-[#138946]/10 px-2.5 py-0.5 text-xs font-medium text-[#79d89f]">
                                {roleLabelMap[member.role ?? ""] ?? member.role ?? "—"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs text-zinc-500">
                              {new Date(member.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => setConfirmModal({ isOpen: true, userId: member.id, userName: member.full_name || member.email || "" })}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-red-500 transition hover:border-red-500/30 hover:bg-red-500/10">
                                <Trash2 className="h-3.5 w-3.5" /> Revogar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Aba: Segurança ──────────────────────────────────────────────── */}
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
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={cn(BASE_INPUT, "pr-11")} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200">Confirmar nova senha</label>
                <div className="relative">
                  <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" className={cn(BASE_INPUT, "pr-11")} />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {password && confirmPassword && (
                <div className={cn("flex items-center gap-2 text-xs font-medium", password === confirmPassword ? "text-emerald-400" : "text-red-400")}>
                  {password === confirmPassword
                    ? <><CheckCircle2 className="h-4 w-4" /> Senhas conferem</>
                    : <><AlertCircle  className="h-4 w-4" /> Senhas não conferem</>}
                </div>
              )}
              <button type="button" onClick={() => void handleUpdatePassword()} disabled={savingPassword}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#138946]/40 hover:bg-[#138946]/10 disabled:opacity-60">
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {savingPassword ? "Atualizando..." : "Atualizar senha"}
              </button>
            </div>
          </section>
        )}

      </section>

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError   = toast.type === "error";
          return (
            <div key={toast.id} className={cn(
              "pointer-events-auto overflow-hidden rounded-2xl border bg-[#1a1413]/95 shadow-2xl backdrop-blur-xl",
              isSuccess && "border-emerald-500/30",
              isError   && "border-rose-500/30",
              toast.type === "info" && "border-white/10"
            )}>
              <div className="flex items-start gap-3 p-4">
                <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  isSuccess && "bg-emerald-500/15 text-emerald-400",
                  isError   && "bg-rose-500/15 text-rose-400",
                  toast.type === "info" && "bg-white/10 text-zinc-200")}>
                  {isSuccess ? <CheckCircle2 className="h-5 w-5" /> : isError ? <AlertCircle className="h-5 w-5" /> : <UserCircle2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{toast.title}</p>
                  <p className="mt-1 text-sm leading-5 text-zinc-400">{toast.message}</p>
                </div>
                <button type="button" onClick={() => removeToast(toast.id)} className="rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className={cn("h-1 w-full",
                isSuccess && "bg-emerald-500/80",
                isError   && "bg-rose-500/80",
                toast.type === "info" && "bg-[#138946]/80")} />
            </div>
          );
        })}
      </div>

    </main>
  );
}