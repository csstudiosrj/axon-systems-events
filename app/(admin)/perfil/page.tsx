"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  Upload,
  User2,
  X,
  Info
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
type ToastType = "success" | "error" | "info";

interface Toast {
  message: string;
  type: ToastType;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  created_at?: string | null;
  client_id?: string | null;
}

interface ProfileFormData {
  full_name: string;
  email: string;
  role: string;
  avatar_url: string;
}

interface PasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

const DEFAULT_PROFILE_FORM: ProfileFormData = {
  full_name: "",
  email: "",
  role: "admin",
  avatar_url: "",
};

const DEFAULT_PASSWORD_FORM: PasswordFormData = {
  newPassword: "",
  confirmPassword: "",
};

const STORAGE_BUCKET_NAME = "axon-assets";

// --- FUNÇÕES UTILITÁRIAS ---
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
  return (labels[normalized] ?? role) || "Administrador";
}

function translateSupabaseError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("new password should be different from the old password")) return "A nova senha deve ser diferente da senha atual.";
  if (normalized.includes("same as the old password")) return "A nova senha deve ser diferente da senha atual.";
  if (normalized.includes("password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (normalized.includes("unable to validate email address")) return "Não foi possível validar o endereço de e-mail da conta.";
  if (normalized.includes("user not found")) return "Usuário não encontrado.";
  if (normalized.includes("jwt")) return "Sua sessão expirou. Faça login novamente.";
  if (normalized.includes("row-level security")) return "A política de acesso do banco bloqueou esta operação.";
  if (normalized.includes("mime type")) return "O tipo de arquivo não é permitido pelo bucket.";
  if (normalized.includes("duplicate")) return "Já existe um arquivo com esse nome no bucket.";
  if (normalized.includes("bucket")) return "Não foi possível acessar o bucket configurado.";
  if (normalized.includes("storage")) return "Houve um problema ao acessar o storage.";
  return message;
}

function buildInitials(fullName: string): string {
  const name = fullName.trim();
  if (!name) return "AD";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ? part[0].toUpperCase() : ""))
    .join("");
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export default function PerfilAdminPage() {
  const[profileId, setProfileId] = useState<string | null>(null);
  const[authUserId, setAuthUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>(DEFAULT_PROFILE_FORM);
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>(DEFAULT_PASSWORD_FORM);

  const [loading, setLoading] = useState<boolean>(true);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const[savingPassword, setSavingPassword] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [avatarPreviewError, setAvatarPreviewError] = useState<boolean>(false);

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  },[]);

  const updateProfileField = useCallback((field: keyof ProfileFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  },[]);

  const updatePasswordField = useCallback((field: keyof PasswordFormData, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  },[]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const authResponse = await supabase.auth.getUser();
      const user = authResponse.data.user;
      const authError = authResponse.error;

      if (authError) throw authError;
      if (!user || !user.id) throw new Error("Usuário não autenticado.");

      setAuthUserId(user.id);

      const profileResponse = await supabase
        .from("profiles")
        .select("id, email, full_name, role, avatar_url, created_at, client_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileResponse.error) throw profileResponse.error;

      const profile = (profileResponse.data as ProfileRow | null) ?? null;

      setProfileId(profile?.id ?? user.id);
      setAvatarPreviewError(false);

      setFormData({
        full_name: profile?.full_name ?? "",
        email: profile?.email ?? user.email ?? "",
        role: profile?.role ?? "admin",
        avatar_url: profile?.avatar_url ?? "",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? translateSupabaseError(error.message) : "Não foi possível carregar o perfil.";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleAvatarUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0] ?? null;

      if (!file) return;

      if (!authUserId) {
        showToast("Não foi possível identificar o usuário atual.", "error");
        input.value = "";
        return;
      }

      if (!file.type.startsWith("image/")) {
        showToast("Selecione uma imagem válida para o avatar.", "error");
        input.value = "";
        return;
      }

      const maxSizeInBytes = 5 * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
        showToast("Envie uma imagem com até 5MB.", "error");
        input.value = "";
        return;
      }

      setUploadingAvatar(true);
      setAvatarPreviewError(false);

      try {
        const safeName = sanitizeFileName(file.name);
        const fallbackExtension = file.type.split("/")[1] || "png";
        const detectedExtension = safeName.includes(".") ? safeName.split(".").pop() || fallbackExtension : fallbackExtension;
        const baseName = safeName.replace(/\.[^.]+$/, "") || "avatar";
        const filePath = `avatars/${authUserId}/${Date.now()}-${baseName}.${detectedExtension}`;

        const uploadResponse = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .upload(filePath, file, { cacheControl: "3600", upsert: true });

        if (uploadResponse.error) throw uploadResponse.error;

        const publicUrlResponse = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(filePath);
        const publicUrl = publicUrlResponse.data.publicUrl ?? "";

        if (!publicUrl) throw new Error("Não foi possível gerar a URL pública da imagem.");

        setFormData((current) => ({ ...current, avatar_url: publicUrl }));
        setAvatarPreviewError(false);

        showToast("A imagem foi enviada com sucesso. Salve o perfil para confirmar.", "success");
      } catch (error: unknown) {
        const message = error instanceof Error ? translateSupabaseError(error.message) : "Não foi possível enviar a imagem.";
        showToast(message, "error");
      } finally {
        setUploadingAvatar(false);
        input.value = "";
      }
    },
    [showToast, authUserId]
  );

  const handleSaveProfile = useCallback(async () => {
    if (!authUserId) {
      showToast("Não foi possível identificar o usuário atual.", "error");
      return;
    }

    const trimmedName = formData.full_name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedAvatarUrl = formData.avatar_url.trim();
    const normalizedRole = formData.role.trim() || "admin";

    if (!trimmedEmail) {
      showToast("Informe um e-mail válido.", "error");
      return;
    }

    setSavingProfile(true);

    try {
      const authUpdateResponse = await supabase.auth.updateUser({ email: trimmedEmail });
      if (authUpdateResponse.error) throw authUpdateResponse.error;

      const payload = {
        id: authUserId,
        email: trimmedEmail,
        full_name: trimmedName || null,
        role: normalizedRole,
        avatar_url: trimmedAvatarUrl || null,
      };

      const profileSaveResponse = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("id, email, full_name, role, avatar_url, created_at, client_id")
        .single();

      if (profileSaveResponse.error) throw profileSaveResponse.error;

      const savedProfile = profileSaveResponse.data as ProfileRow;

      setProfileId(savedProfile.id);
      setFormData((current) => ({ ...current, avatar_url: savedProfile.avatar_url ?? current.avatar_url }));

      showToast("Seus dados de perfil foram atualizados com sucesso.", "success");
      await fetchProfile();
    } catch (error: unknown) {
      const message = error instanceof Error ? translateSupabaseError(error.message) : "Não foi possível salvar o perfil.";
      showToast(message, "error");
    } finally {
      setSavingProfile(false);
    }
  }, [showToast, authUserId, fetchProfile, formData]);

  const handleChangePassword = useCallback(async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      showToast("Preencha e confirme a nova senha.", "error");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showToast("A senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("A confirmação da senha não confere.", "error");
      return;
    }

    setSavingPassword(true);

    try {
      const passwordResponse = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (passwordResponse.error) throw passwordResponse.error;

      setPasswordForm(DEFAULT_PASSWORD_FORM);
      showToast("Sua senha foi alterada com sucesso.", "success");
    } catch (error: unknown) {
      const message = error instanceof Error ? translateSupabaseError(error.message) : "Não foi possível atualizar a senha.";
      showToast(message, "error");
    } finally {
      setSavingPassword(false);
    }
  }, [showToast, passwordForm]);

  const initials = useMemo(() => buildInitials(formData.full_name), [formData.full_name]);
  const avatarPreviewSrc = formData.avatar_url.trim();
  const hasAvatar = avatarPreviewSrc.length > 0;

  return (
    <div className="space-y-6 relative max-w-6xl mx-auto pb-12">
      {/* Sistema de Toasts Padronizado */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md shadow-lg flex items-center gap-2 border ${
          toast.type === 'success' ? 'bg-cs-green/10 border-cs-green/20 text-cs-green' : 
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
          'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : toast.type === 'error' ? <X size={18} /> : <Info size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <User2 className="text-cs-green" size={20} />
            Meu Perfil
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Atualize seus dados básicos, segurança e foto do perfil administrativo.
          </p>
        </div>
        <button
          onClick={() => void handleSaveProfile()}
          disabled={savingProfile || loading}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
        >
          {savingProfile ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Salvar Perfil
        </button>
      </div>

      {loading ? (
        <div className="bg-surface border border-surface/50 rounded-lg p-12 flex justify-center items-center">
          <Loader2 className="animate-spin text-cs-green" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: Avatar e Resumo */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-surface border border-surface/50 p-6 rounded-lg flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-surface/50 bg-background text-2xl font-semibold text-white">
                  {hasAvatar && !avatarPreviewError ? (
                    <img
                      src={avatarPreviewSrc}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                      onError={() => setAvatarPreviewError(true)}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <label className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-cs-green text-white shadow-lg hover:bg-opacity-90 transition-all">
                  {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleAvatarUpload(e)}
                    disabled={uploadingAvatar}
                  />
                </label>
              </div>

              <h2 className="text-lg font-bold text-white">{formData.full_name || "Administrador"}</h2>
              <p className="text-sm text-text-secondary mt-1">{formData.email || "E-mail não encontrado"}</p>
              
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-cs-green/10 px-3 py-1 text-xs font-medium text-cs-green border border-cs-green/20">
                <Shield className="h-3.5 w-3.5" />
                {getRoleLabel(formData.role)}
              </div>

              {avatarPreviewError && (
                <p className="mt-3 text-xs text-red-400">Erro ao carregar a prévia da imagem.</p>
              )}
            </div>

            <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-surface/50 pb-2">Resumo da Conta</h3>
              
              <div>
                <span className="block text-xs font-medium text-text-secondary mb-1">E-mail</span>
                <p className="text-sm text-white bg-background border border-surface/50 px-3 py-2 rounded-md">{formData.email || "Não informado"}</p>
              </div>
              
              <div>
                <span className="block text-xs font-medium text-text-secondary mb-1">ID do Perfil</span>
                <p className="text-xs text-text-secondary bg-background border border-surface/50 px-3 py-2 rounded-md break-all">{profileId || "Não informado"}</p>
              </div>
            </div>
          </div>

          {/* Main Content: Formulários */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
              <h3 className="text-md font-bold text-white border-b border-surface/50 pb-2 flex items-center gap-2">
                <User2 size={18} className="text-cs-green" /> Dados do Administrador
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => updateProfileField("full_name", e.target.value)}
                    placeholder="Seu nome completo"
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateProfileField("email", e.target.value)}
                    placeholder="seuemail@dominio.com"
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Perfil de Acesso</label>
                  <input
                    type="text"
                    value={getRoleLabel(formData.role)}
                    disabled
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-text-secondary focus:outline-none text-sm cursor-not-allowed opacity-70"
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
              <h3 className="text-md font-bold text-white border-b border-surface/50 pb-2 flex items-center gap-2">
                <Lock size={18} className="text-cs-gold" /> Segurança
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Nova Senha</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => updatePasswordField("newPassword", e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Confirmar Senha</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => updatePasswordField("confirmPassword", e.target.value)}
                    placeholder="Repita a nova senha"
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-text-secondary">A troca de senha é aplicada imediatamente à conta atual.</p>
                <button
                  type="button"
                  onClick={() => void handleChangePassword()}
                  disabled={savingPassword}
                  className="flex items-center gap-2 rounded-md bg-cs-gold py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  {savingPassword ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
                  Atualizar Senha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}