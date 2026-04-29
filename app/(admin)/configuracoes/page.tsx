"use client";

import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  Sparkles,
  Shapes,
  FileBadge,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";

type TabId = "perfil-corporativo" | "nomenclaturas" | "modulos" | "documentos";
type ToastType = "success" | "error" | "info";

interface CustomLabels {
  client_singular: string;
  client_plural: string;
  quote_singular: string;
  quote_plural: string;
  academy_name: string;
  [key: string]: string;
}

interface FeatureToggles {
  [key: string]: boolean;
}

interface CompanyProfileForm {
  company_name: string;
  cnpj: string;
  logo_url: string;
  primary_color: string;
}

interface SystemPreferencesForm {
  feature_toggles: FeatureToggles;
  custom_labels: CustomLabels;
}

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

interface RowIdResult {
  id?: string | number | null;
}

const DEFAULT_CUSTOM_LABELS: CustomLabels = {
  client_singular: "Cliente",
  client_plural: "Clientes",
  quote_singular: "Orçamento",
  quote_plural: "Orçamentos",
  academy_name: "Treinamentos",
};

const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  enable_crm: true,
  enable_financial: true,
  enable_inventory: true,
  enable_service_orders: true,
  enable_training: true,
  enable_marketing: true,
  enable_calendar: true,
};

const DEFAULT_COMPANY_PROFILE: CompanyProfileForm = {
  company_name: "",
  cnpj: "",
  logo_url: "",
  primary_color: "#138946",
};

const DEFAULT_SYSTEM_PREFERENCES: SystemPreferencesForm = {
  feature_toggles: DEFAULT_FEATURE_TOGGLES,
  custom_labels: DEFAULT_CUSTOM_LABELS,
};

const FEATURE_LABELS: Record<string, string> = {
  enable_crm: "CRM / Vendas",
  enable_financial: "Financeiro",
  enable_inventory: "Inventário",
  enable_service_orders: "Ordens de Serviço",
  enable_training: "Treinamentos",
  enable_marketing: "Marketing",
  enable_calendar: "Calendário",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function sanitizeCustomLabels(input: unknown): CustomLabels {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    client_singular: safeString(source.client_singular, DEFAULT_CUSTOM_LABELS.client_singular),
    client_plural: safeString(source.client_plural, DEFAULT_CUSTOM_LABELS.client_plural),
    quote_singular: safeString(source.quote_singular, DEFAULT_CUSTOM_LABELS.quote_singular),
    quote_plural: safeString(source.quote_plural, DEFAULT_CUSTOM_LABELS.quote_plural),
    academy_name: safeString(source.academy_name, DEFAULT_CUSTOM_LABELS.academy_name),
  };
}

function sanitizeFeatureToggles(input: unknown): FeatureToggles {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const merged: FeatureToggles = { ...DEFAULT_FEATURE_TOGGLES };

  for (const key of Object.keys(DEFAULT_FEATURE_TOGGLES)) {
    merged[key] = typeof source[key] === "boolean" ? (source[key] as boolean) : merged[key];
  }

  return merged;
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

export default function ConfiguracoesPage() {
  const { companyProfile, systemPreferences, loading, refreshSettings, resolvedClientId } =
    useSettings();

  const [activeTab, setActiveTab] = useState<TabId>("perfil-corporativo");
  const [companyRowId, setCompanyRowId] = useState<string | number | null>(null);
  const [preferencesRowId, setPreferencesRowId] = useState<string | number | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyProfileForm>(DEFAULT_COMPANY_PROFILE);
  const [preferencesForm, setPreferencesForm] =
    useState<SystemPreferencesForm>(DEFAULT_SYSTEM_PREFERENCES);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [initialized, setInitialized] = useState<boolean>(false);

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

  const loadRowIds = useCallback(async () => {
    try {
      const [companyResult, preferencesResult] = await Promise.all([
        supabase.from("company_profile").select("id").limit(1).maybeSingle<RowIdResult>(),
        supabase.from("system_preferences").select("id").limit(1).maybeSingle<RowIdResult>(),
      ]);

      if (companyResult.error) throw companyResult.error;
      if (preferencesResult.error) throw preferencesResult.error;

      setCompanyRowId(companyResult.data?.id ?? null);
      setPreferencesRowId(preferencesResult.data?.id ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível resolver os registros atuais.";
      addToast("error", "Erro ao preparar salvamento", message);
    }
  }, [addToast]);

  useEffect(() => {
    if (loading) return;

    setCompanyForm({
      company_name: companyProfile.company_name ?? "",
      cnpj: companyProfile.cnpj ?? "",
      logo_url: companyProfile.logo_url ?? "",
      primary_color: companyProfile.primary_color ?? "#138946",
    });

    setPreferencesForm({
      feature_toggles: sanitizeFeatureToggles(systemPreferences.feature_toggles),
      custom_labels: sanitizeCustomLabels(systemPreferences.custom_labels),
    });

    setInitialized(true);
    void loadRowIds();
  }, [companyProfile, systemPreferences, loading, loadRowIds]);

  const updateCompanyField = useCallback(
    <K extends keyof CompanyProfileForm>(field: K, value: CompanyProfileForm[K]) => {
      setCompanyForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const updateCustomLabel = useCallback((field: keyof CustomLabels, value: string) => {
    setPreferencesForm((current) => ({
      ...current,
      custom_labels: {
        ...current.custom_labels,
        [field]: value,
      },
    }));
  }, []);

  const toggleFeature = useCallback((key: string) => {
    setPreferencesForm((current) => ({
      ...current,
      feature_toggles: {
        ...current.feature_toggles,
        [key]: !Boolean(current.feature_toggles[key]),
      },
    }));
  }, []);

  const handleLogoUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0] ?? null;

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        addToast("error", "Arquivo inválido", "Selecione uma imagem para a logo.");
        input.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        addToast("error", "Arquivo muito grande", "Envie uma imagem com até 5MB.");
        input.value = "";
        return;
      }

      setUploadingLogo(true);

      try {
        const safeName = sanitizeFileName(file.name);
        const fallbackExtension = file.type.split("/")[1] || "png";
        const detectedExtension = safeName.includes(".")
          ? safeName.split(".").pop() || fallbackExtension
          : fallbackExtension;
        const baseName = safeName.replace(/\.[^.]+$/, "") || "logo";
        const scope = resolvedClientId ? `client-${resolvedClientId}` : "global";
        const filePath = `branding/${scope}/logo-${Date.now()}-${baseName}.${detectedExtension}`;

        const uploadResponse = await supabase.storage.from("axon-assets").upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

        if (uploadResponse.error) throw uploadResponse.error;

        const publicUrlResponse = supabase.storage.from("axon-assets").getPublicUrl(filePath);
        const publicUrl = publicUrlResponse.data.publicUrl ?? "";

        if (!publicUrl) throw new Error("Não foi possível gerar a URL pública da logo.");

        setCompanyForm((current) => ({
          ...current,
          logo_url: publicUrl,
        }));

        addToast("success", "Logo enviada", "A nova logo foi carregada com sucesso.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha no upload da logo.";
        addToast("error", "Erro no upload", message);
      } finally {
        setUploadingLogo(false);
        input.value = "";
      }
    },
    [addToast, resolvedClientId]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      const normalizedPrimaryColor = isValidHexColor(companyForm.primary_color)
        ? companyForm.primary_color.trim()
        : "#138946";

      const companyPayload = {
        company_name: companyForm.company_name.trim() || null,
        cnpj: companyForm.cnpj.trim() || null,
        logo_url: companyForm.logo_url.trim() || null,
        primary_color: normalizedPrimaryColor,
      };

      const preferencesPayload = {
        feature_toggles: sanitizeFeatureToggles(preferencesForm.feature_toggles),
        custom_labels: sanitizeCustomLabels(preferencesForm.custom_labels),
      };

      const companyPromise =
        companyRowId !== null
          ? supabase.from("company_profile").update(companyPayload).eq("id", companyRowId)
          : supabase.from("company_profile").insert(companyPayload).select("id").single<RowIdResult>();

      const preferencesPromise =
        preferencesRowId !== null
          ? supabase.from("system_preferences").update(preferencesPayload).eq("id", preferencesRowId)
          : supabase
              .from("system_preferences")
              .insert(preferencesPayload)
              .select("id")
              .single<RowIdResult>();

      const [companyResult, preferencesResult] = await Promise.all([
        companyPromise,
        preferencesPromise,
      ]);

      if (companyResult.error) throw companyResult.error;
      if (preferencesResult.error) throw preferencesResult.error;

      if ("data" in companyResult) {
        setCompanyRowId(companyResult.data?.id ?? companyRowId);
      }

      if ("data" in preferencesResult) {
        setPreferencesRowId(preferencesResult.data?.id ?? preferencesRowId);
      }

      await refreshSettings();
      addToast("success", "Configurações salvas", "As alterações foram persistidas com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar as configurações.";
      addToast("error", "Erro ao salvar", message);
    } finally {
      setSaving(false);
    }
  }, [companyForm, companyRowId, preferencesForm, preferencesRowId, refreshSettings, addToast]);

  const tabs = useMemo(
    () => [
      {
        id: "perfil-corporativo" as const,
        label: "Perfil Corporativo",
        icon: Building2,
        description: "Marca, dados da empresa e identidade visual",
      },
      {
        id: "nomenclaturas" as const,
        label: "Nomenclaturas",
        icon: Type,
        description: "Como o sistema chama cada entidade do negócio",
      },
      {
        id: "modulos" as const,
        label: "Módulos",
        icon: Shapes,
        description: "Ative ou desative áreas do sistema por operação",
      },
      {
        id: "documentos" as const,
        label: "Documentos Comerciais",
        icon: FileBadge,
        description: "Espaço reservado para contratos, propostas e modelos",
      },
    ],
    []
  );

  const localLoading = loading || !initialized;

  return (
    <main className="min-h-screen bg-[#0d0807] text-zinc-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-[#1a1413] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#138946]/30 bg-[#138946]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#72d39c]">
                <Sparkles className="h-3.5 w-3.5" />
                Personalização do sistema
              </span>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Configurações do Sistema
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                  Personalize a identidade da empresa, os nomes exibidos no produto e os módulos
                  disponíveis para cada operação.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || localLoading}
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
                        {tab.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-[#1a1413] p-5 sm:p-6">
            {localLoading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                  <Loader2 className="h-4 w-4 animate-spin text-[#138946]" />
                  Carregando configurações...
                </div>
              </div>
            ) : (
              <>
                {activeTab === "perfil-corporativo" && (
                  <div className="space-y-8">
                    <div className="border-b border-white/10 pb-5">
                      <h2 className="text-xl font-semibold text-white">Perfil Corporativo</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Configure a apresentação institucional da empresa dentro do sistema.
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
                              value={companyForm.company_name}
                              onChange={(e) => updateCompanyField("company_name", e.target.value)}
                              placeholder="Ex.: AXON Systems"
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
                              value={companyForm.cnpj}
                              onChange={(e) => updateCompanyField("cnpj", formatCnpj(e.target.value))}
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
                                value={isValidHexColor(companyForm.primary_color) ? companyForm.primary_color : "#138946"}
                                onChange={(e) => updateCompanyField("primary_color", e.target.value)}
                                className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                              />
                              <input
                                type="text"
                                value={companyForm.primary_color}
                                onChange={(e) => updateCompanyField("primary_color", e.target.value)}
                                placeholder="#138946"
                                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <aside className="space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-[#120e0d] p-4">
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-white">Logo da marca</h3>
                              <p className="mt-1 text-xs leading-5 text-zinc-500">
                                Defina a logo oficial via upload para o bucket axon-assets.
                              </p>
                            </div>
                            <div
                              className="h-10 w-10 rounded-2xl border border-white/10"
                              style={{ backgroundColor: companyForm.primary_color || "#138946" }}
                            />
                          </div>

                          <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-[#0d0807] p-6">
                            {companyForm.logo_url ? (
                              <img
                                src={companyForm.logo_url}
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
                      </aside>
                    </div>
                  </div>
                )}

                {activeTab === "nomenclaturas" && (
                  <div className="space-y-8">
                    <div className="border-b border-white/10 pb-5">
                      <h2 className="text-xl font-semibold text-white">Nomenclaturas</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Defina como o sistema deve chamar clientes, orçamentos e a área educacional.
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
                          value={preferencesForm.custom_labels.client_singular}
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
                          value={preferencesForm.custom_labels.client_plural}
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
                          value={preferencesForm.custom_labels.quote_singular}
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
                          value={preferencesForm.custom_labels.quote_plural}
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
                          value={preferencesForm.custom_labels.academy_name}
                          onChange={(e) => updateCustomLabel("academy_name", e.target.value)}
                          placeholder="Academy"
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "modulos" && (
                  <div className="space-y-8">
                    <div className="border-b border-white/10 pb-5">
                      <h2 className="text-xl font-semibold text-white">Módulos</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Controle quais áreas ficam disponíveis na navegação e no uso diário do sistema.
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#120e0d] p-5">
                      <h3 className="text-sm font-semibold text-white">Módulos habilitados</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Quando um módulo for desativado, ele deve desaparecer da navegação que consome essas preferências.
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {Object.keys(DEFAULT_FEATURE_TOGGLES).map((key) => {
                          const enabled = Boolean(preferencesForm.feature_toggles[key]);

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleFeature(key)}
                              className={cn(
                                "rounded-2xl border px-4 py-3 text-left text-sm transition-all",
                                enabled
                                  ? "border-[#138946]/40 bg-[#138946]/10 text-white"
                                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                              )}
                            >
                              <span className="block font-medium">{FEATURE_LABELS[key]}</span>
                              <span className="mt-1 block text-xs">
                                {enabled ? "Ativado" : "Desativado"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "documentos" && (
                  <div className="space-y-8">
                    <div className="border-b border-white/10 pb-5">
                      <h2 className="text-xl font-semibold text-white">Documentos Comerciais</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Área preparada para centralizar contratos, propostas, observações padrão e demais modelos comerciais.
                      </p>
                    </div>

                    <div className="rounded-3xl border border-dashed border-white/10 bg-[#120e0d] p-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-[#138946]/20 bg-[#138946]/10 p-3 text-[#72d39c]">
                          <FileBadge className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Próxima etapa</h3>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                            Os termos de contrato saíram desta página. Esta nova aba deixa o caminho aberto
                            para configurar contrato, proposta comercial, cláusulas padrão e outros textos
                            operacionais sem misturar isso com identidade visual e nomenclaturas.
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