"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  FileText,
  ImageIcon,
  Loader2,
  Palette,
  Save,
  Settings2,
  Tag,
  Upload,
  X,
  AlertCircle,
  Type,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

type TabId = "identidade" | "nomenclaturas";
type ToastType = "success" | "error" | "info";

interface CustomLabels {
  client_singular: string;
  client_plural: string;
  quote_singular: string;
  quote_plural: string;
  academy_name: string;
  [key: string]: string;
}

interface SystemSettingsRow {
  id?: string | number;
  company_name: string | null;
  cnpj: string | null;
  logo_url: string | null;
  primary_color: string | null;
  default_contract_terms: string | null;
  custom_labels: CustomLabels | null;
}

interface SettingsFormData {
  company_name: string;
  cnpj: string;
  logo_url: string;
  primary_color: string;
  default_contract_terms: string;
  custom_labels: CustomLabels;
}

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

const DEFAULT_CUSTOM_LABELS: CustomLabels = {
  client_singular: "Cliente",
  client_plural: "Clientes",
  quote_singular: "Orçamento",
  quote_plural: "Orçamentos",
  academy_name: "Academy",
};

const DEFAULT_FORM_DATA: SettingsFormData = {
  company_name: "",
  cnpj: "",
  logo_url: "",
  primary_color: "#138946",
  default_contract_terms: "",
  custom_labels: DEFAULT_CUSTOM_LABELS,
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function sanitizeCustomLabels(input: unknown): CustomLabels {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...DEFAULT_CUSTOM_LABELS };
  }

  const source = input as Record<string, unknown>;

  return {
    client_singular:
      typeof source.client_singular === "string" && source.client_singular.trim()
        ? source.client_singular
        : DEFAULT_CUSTOM_LABELS.client_singular,
    client_plural:
      typeof source.client_plural === "string" && source.client_plural.trim()
        ? source.client_plural
        : DEFAULT_CUSTOM_LABELS.client_plural,
    quote_singular:
      typeof source.quote_singular === "string" && source.quote_singular.trim()
        ? source.quote_singular
        : DEFAULT_CUSTOM_LABELS.quote_singular,
    quote_plural:
      typeof source.quote_plural === "string" && source.quote_plural.trim()
        ? source.quote_plural
        : DEFAULT_CUSTOM_LABELS.quote_plural,
    academy_name:
      typeof source.academy_name === "string" && source.academy_name.trim()
        ? source.academy_name
        : DEFAULT_CUSTOM_LABELS.academy_name,
  };
}

function normalizeSettings(row: SystemSettingsRow | null): SettingsFormData {
  if (!row) {
    return { ...DEFAULT_FORM_DATA, custom_labels: { ...DEFAULT_CUSTOM_LABELS } };
  }

  return {
    company_name: row.company_name ?? "",
    cnpj: row.cnpj ?? "",
    logo_url: row.logo_url ?? "",
    primary_color: row.primary_color ?? "#138946",
    default_contract_terms: row.default_contract_terms ?? "",
    custom_labels: sanitizeCustomLabels(row.custom_labels),
  };
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("identidade");
  const [formData, setFormData] = useState<SettingsFormData>(DEFAULT_FORM_DATA);
  const [settingsRowId, setSettingsRowId] = useState<string | number | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast: ToastItem = { id, type, title, message };

    setToasts((current) => [...current, toast]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .limit(1)
        .maybeSingle<SystemSettingsRow>();

      if (error) {
        throw error;
      }

      if (data) {
        setSettingsRowId(data.id ?? null);
        setFormData(normalizeSettings(data));
      } else {
        setSettingsRowId(null);
        setFormData({
          ...DEFAULT_FORM_DATA,
          custom_labels: { ...DEFAULT_CUSTOM_LABELS },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível carregar as configurações.";
      addToast("error", "Erro ao carregar", message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const updateField = useCallback(
    <K extends keyof SettingsFormData>(field: K, value: SettingsFormData[K]) => {
      setFormData((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const updateCustomLabel = useCallback((field: keyof CustomLabels, value: string) => {
    setFormData((current) => ({
      ...current,
      custom_labels: {
        ...current.custom_labels,
        [field]: value,
      },
    }));
  }, []);

  const handleLogoUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) return;

      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        addToast("error", "Arquivo inválido", "Selecione uma imagem para a logo.");
        event.target.value = "";
        return;
      }

      setUploadingLogo(true);

      try {
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
        const filePath = `branding/logo-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("axon-assets")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);
        const publicUrl = data.publicUrl;

        if (!publicUrl) {
          throw new Error("Não foi possível gerar a URL pública da logo.");
        }

        setFormData((current) => ({
          ...current,
          logo_url: publicUrl,
        }));

        addToast("success", "Logo enviada", "A nova logo foi carregada com sucesso.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha no upload da logo.";
        addToast("error", "Erro no upload", message);
      } finally {
        setUploadingLogo(false);
        event.target.value = "";
      }
    },
    [addToast]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      const payload = {
        company_name: formData.company_name.trim() || null,
        cnpj: formData.cnpj.trim() || null,
        logo_url: formData.logo_url.trim() || null,
        primary_color: formData.primary_color.trim() || "#138946",
        default_contract_terms: formData.default_contract_terms.trim() || null,
        custom_labels: {
          client_singular: formData.custom_labels.client_singular.trim() || DEFAULT_CUSTOM_LABELS.client_singular,
          client_plural: formData.custom_labels.client_plural.trim() || DEFAULT_CUSTOM_LABELS.client_plural,
          quote_singular: formData.custom_labels.quote_singular.trim() || DEFAULT_CUSTOM_LABELS.quote_singular,
          quote_plural: formData.custom_labels.quote_plural.trim() || DEFAULT_CUSTOM_LABELS.quote_plural,
          academy_name: formData.custom_labels.academy_name.trim() || DEFAULT_CUSTOM_LABELS.academy_name,
        },
      };

      if (settingsRowId !== null) {
        const { error } = await supabase
          .from("system_settings")
          .update(payload)
          .eq("id", settingsRowId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("system_settings")
          .insert(payload)
          .select("*")
          .single<SystemSettingsRow>();

        if (error) throw error;
        setSettingsRowId(data.id ?? null);
      }

      addToast("success", "Configurações salvas", "As alterações foram persistidas com sucesso.");
      await fetchSettings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar as configurações.";
      addToast("error", "Erro ao salvar", message);
    } finally {
      setSaving(false);
    }
  }, [fetchSettings, formData, settingsRowId, addToast]);

  const tabs = useMemo(
    () => [
      {
        id: "identidade" as const,
        label: "Identidade e Contrato",
        icon: Settings2,
      },
      {
        id: "nomenclaturas" as const,
        label: "Nomenclaturas do Sistema",
        icon: Type,
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-[#0d0807] text-zinc-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-[#1a1413] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#138946]/30 bg-[#138946]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#72d39c]">
                <Palette className="h-3.5 w-3.5" />
                White-Label
              </span>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Configurações do Sistema
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                  Personalize a identidade visual, os termos contratuais e as nomenclaturas
                  globais utilizadas em toda a plataforma.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium transition-all",
                "bg-[#138946] text-white shadow-lg shadow-[#138946]/20 hover:bg-[#0f723b]",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-white/10 bg-[#1a1413] p-3">
            <nav className="flex flex-col gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all",
                      isActive
                        ? "bg-[#138946] text-white shadow-lg shadow-[#138946]/20"
                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border transition-all",
                        isActive
                          ? "border-white/15 bg-white/10"
                          : "border-white/10 bg-black/20 group-hover:border-white/15 group-hover:bg-white/5"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{tab.label}</span>
                      <span className={cn("block text-xs", isActive ? "text-white/75" : "text-zinc-500")}>
                        {tab.id === "identidade"
                          ? "Marca, cor principal e termos"
                          : "Nomes exibidos para módulos"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-[#1a1413] p-5 sm:p-6">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                  <Loader2 className="h-4 w-4 animate-spin text-[#138946]" />
                  Carregando configurações...
                </div>
              </div>
            ) : (
              <>
                {activeTab === "identidade" && (
                  <div className="space-y-8">
                    <div className="border-b border-white/10 pb-5">
                      <h2 className="text-xl font-semibold text-white">Identidade e Contrato</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Defina a marca principal exibida no sistema, a cor de destaque e o
                        modelo padrão de termos contratuais.
                      </p>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-6">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                              <Building2 className="h-4 w-4 text-[#72d39c]" />
                              Nome da empresa
                            </label>
                            <input
                              type="text"
                              value={formData.company_name}
                              onChange={(e) => updateField("company_name", e.target.value)}
                              placeholder="Ex.: Axon Academy"
                              className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                              <FileText className="h-4 w-4 text-[#72d39c]" />
                              CNPJ
                            </label>
                            <input
                              type="text"
                              value={formData.cnpj}
                              onChange={(e) => updateField("cnpj", formatCnpj(e.target.value))}
                              placeholder="00.000.000/0000-00"
                              className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                              <Palette className="h-4 w-4 text-[#72d39c]" />
                              Cor principal
                            </label>
                            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0807] px-3 py-2">
                              <input
                                type="color"
                                value={formData.primary_color}
                                onChange={(e) => updateField("primary_color", e.target.value)}
                                className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                              />
                              <input
                                type="text"
                                value={formData.primary_color}
                                onChange={(e) => updateField("primary_color", e.target.value)}
                                placeholder="#138946"
                                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                              />
                            </div>
                          </div>

                          <div className="space-y-2 sm:col-span-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                              <ImageIcon className="h-4 w-4 text-[#72d39c]" />
                              URL pública da logo
                            </label>
                            <input
                              type="url"
                              value={formData.logo_url}
                              onChange={(e) => updateField("logo_url", e.target.value)}
                              placeholder="https://..."
                              className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                            />
                          </div>

                          <div className="space-y-2 sm:col-span-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                              <FileText className="h-4 w-4 text-[#72d39c]" />
                              Termos padrão de contrato
                            </label>
                            <textarea
                              value={formData.default_contract_terms}
                              onChange={(e) => updateField("default_contract_terms", e.target.value)}
                              placeholder="Insira aqui as cláusulas, observações ou termos padrões..."
                              rows={10}
                              className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                            />
                          </div>
                        </div>
                      </div>

                      <aside className="space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-[#120e0d] p-4">
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-white">Logo da marca</h3>
                              <p className="mt-1 text-xs leading-5 text-zinc-500">
                                Envie um arquivo para o bucket axon-assets.
                              </p>
                            </div>
                            <div
                              className="h-10 w-10 rounded-2xl border border-white/10"
                              style={{ backgroundColor: formData.primary_color || "#138946" }}
                            />
                          </div>

                          <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-[#0d0807] p-6">
                            {formData.logo_url ? (
                              <img
                                src={formData.logo_url}
                                alt="Logo atual"
                                className="max-h-32 w-auto object-contain"
                              />
                            ) : (
                              <div className="flex flex-col items-center text-center text-zinc-500">
                                <ImageIcon className="mb-3 h-10 w-10" />
                                <p className="text-sm">Nenhuma logo configurada</p>
                              </div>
                            )}
                          </div>

                          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-[#138946]/40 hover:bg-[#138946]/10">
                            {uploadingLogo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {uploadingLogo ? "Enviando logo..." : "Enviar nova logo"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => void handleLogoUpload(e)}
                              disabled={uploadingLogo}
                            />
                          </label>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-[#120e0d] p-4">
                          <h3 className="text-sm font-semibold text-white">Preview de cor</h3>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Visualização rápida da cor principal aplicada a um CTA.
                          </p>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d0807] p-4">
                            <button
                              type="button"
                              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                              style={{ backgroundColor: formData.primary_color || "#138946" }}
                            >
                              Botão principal
                            </button>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>
                )}

                {activeTab === "nomenclaturas" && (
                  <div className="space-y-8">
                    <div className="border-b border-white/10 pb-5">
                      <h2 className="text-xl font-semibold text-white">Nomenclaturas do Sistema</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Ajuste os rótulos globais usados em menus, formulários, dashboards e
                        fluxos operacionais da plataforma.
                      </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Tag className="h-4 w-4 text-[#72d39c]" />
                          Cliente (singular)
                        </label>
                        <input
                          type="text"
                          value={formData.custom_labels.client_singular}
                          onChange={(e) => updateCustomLabel("client_singular", e.target.value)}
                          placeholder="Cliente"
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Tag className="h-4 w-4 text-[#72d39c]" />
                          Cliente (plural)
                        </label>
                        <input
                          type="text"
                          value={formData.custom_labels.client_plural}
                          onChange={(e) => updateCustomLabel("client_plural", e.target.value)}
                          placeholder="Clientes"
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Tag className="h-4 w-4 text-[#72d39c]" />
                          Orçamento (singular)
                        </label>
                        <input
                          type="text"
                          value={formData.custom_labels.quote_singular}
                          onChange={(e) => updateCustomLabel("quote_singular", e.target.value)}
                          placeholder="Orçamento"
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Tag className="h-4 w-4 text-[#72d39c]" />
                          Orçamento (plural)
                        </label>
                        <input
                          type="text"
                          value={formData.custom_labels.quote_plural}
                          onChange={(e) => updateCustomLabel("quote_plural", e.target.value)}
                          placeholder="Orçamentos"
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Tag className="h-4 w-4 text-[#72d39c]" />
                          Nome da Academy
                        </label>
                        <input
                          type="text"
                          value={formData.custom_labels.academy_name}
                          onChange={(e) => updateCustomLabel("academy_name", e.target.value)}
                          placeholder="Academy"
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#120e0d] p-5">
                      <h3 className="text-sm font-semibold text-white">Prévia de uso</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Veja como os rótulos podem aparecer na interface.
                      </p>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-[#0d0807] p-4">
                          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                            Menu
                          </span>
                          <p className="mt-3 text-sm text-zinc-300">
                            Gerenciar {formData.custom_labels.client_plural}
                          </p>
                          <p className="mt-1 text-sm text-zinc-300">
                            Novo {formData.custom_labels.quote_singular}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#0d0807] p-4">
                          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                            Dashboard
                          </span>
                          <p className="mt-3 text-sm text-zinc-300">
                            Total de {formData.custom_labels.client_plural}
                          </p>
                          <p className="mt-1 text-sm text-zinc-300">
                            Área {formData.custom_labels.academy_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
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
                    <Settings2 className="h-5 w-5" />
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