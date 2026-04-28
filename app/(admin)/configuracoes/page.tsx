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
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Type,
  Upload,
  X,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import {
  useSettings,
  type CompanyProfile,
  type CustomLabels,
  type FeatureToggles,
  type SystemPreferences,
} from "@/app/providers/SettingsProvider";

type TabId = "company" | "preferences";
type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

interface CompanyProfileRow extends CompanyProfile {
  id?: string | number;
}

interface SystemPreferencesRow extends SystemPreferences {
  id?: string | number;
}

interface FeatureToggleDefinition {
  key: string;
  label: string;
  description: string;
}

const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  enable_crm: true,
  enable_financial: true,
  enable_inventory: true,
  enable_service_orders: true,
  enable_training: true,
  enable_marketing: true,
  enable_calendar: true,
};

const FEATURE_TOGGLE_DEFINITIONS: FeatureToggleDefinition[] = [
  {
    key: "enable_crm",
    label: "CRM Comercial",
    description: "Habilita pipeline comercial, contatos e funil de vendas.",
  },
  {
    key: "enable_financial",
    label: "Financeiro",
    description: "Libera contas, fluxo financeiro e rotinas de cobrança.",
  },
  {
    key: "enable_inventory",
    label: "Inventário",
    description: "Controla estoque, ativos e disponibilidade operacional.",
  },
  {
    key: "enable_service_orders",
    label: "Ordens de Serviço",
    description: "Permite abertura e acompanhamento de OS técnicas.",
  },
  {
    key: "enable_training",
    label: "Academy",
    description: "Exibe o módulo de treinamentos e conteúdos educacionais.",
  },
  {
    key: "enable_marketing",
    label: "Marketing",
    description: "Ativa campanhas, mídia e painel de marketing.",
  },
  {
    key: "enable_calendar",
    label: "Calendário",
    description: "Disponibiliza agenda global e visão operacional.",
  },
];

const defaultCustomLabels: CustomLabels = {
  client_singular: "Cliente",
  client_plural: "Clientes",
  quote_singular: "Orçamento",
  quote_plural: "Orçamentos",
  academy_name: "Treinamentos",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function normalizeFeatureToggles(input: FeatureToggles | undefined): FeatureToggles {
  return {
    ...DEFAULT_FEATURE_TOGGLES,
    ...(input ?? {}),
  };
}

function normalizeCustomLabels(input: CustomLabels | undefined): CustomLabels {
  return {
    ...defaultCustomLabels,
    ...(input ?? {}),
  };
}

export default function ConfiguracoesPage() {
  const { companyProfile, systemPreferences, loading } = useSettings();

  const [activeTab, setActiveTab] = useState<TabId>("company");

  const [companyRowId, setCompanyRowId] = useState<string | number | null>(null);
  const [preferencesRowId, setPreferencesRowId] = useState<string | number | null>(null);

  const [companyForm, setCompanyForm] = useState<CompanyProfile>(companyProfile);
  const [preferencesForm, setPreferencesForm] = useState<SystemPreferences>({
    feature_toggles: normalizeFeatureToggles(systemPreferences.feature_toggles),
    custom_labels: normalizeCustomLabels(systemPreferences.custom_labels),
  });

  const [savingCompany, setSavingCompany] = useState<boolean>(false);
  const [savingPreferences, setSavingPreferences] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

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

  const fetchRowIds = useCallback(async () => {
    try {
      const [companyResult, preferencesResult] = await Promise.all([
        supabase.from("company_profile").select("id").limit(1).maybeSingle<{ id?: string | number }>(),
        supabase.from("system_preferences").select("id").limit(1).maybeSingle<{ id?: string | number }>(),
      ]);

      if (companyResult.error) throw companyResult.error;
      if (preferencesResult.error) throw preferencesResult.error;

      setCompanyRowId(companyResult.data?.id ?? null);
      setPreferencesRowId(preferencesResult.data?.id ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao identificar os registros de configuração.";
      addToast("error", "Erro de sincronização", message);
    }
  }, [addToast]);

  useEffect(() => {
    setCompanyForm(companyProfile);
  }, [companyProfile]);

  useEffect(() => {
    setPreferencesForm({
      feature_toggles: normalizeFeatureToggles(systemPreferences.feature_toggles),
      custom_labels: normalizeCustomLabels(systemPreferences.custom_labels),
    });
  }, [systemPreferences]);

  useEffect(() => {
    void fetchRowIds();
  }, [fetchRowIds]);

  const updateCompanyField = useCallback(
    <K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) => {
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
        [key]: !(current.feature_toggles[key] as boolean),
      },
    }));
  }, []);

  const handleLogoUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        addToast("error", "Arquivo inválido", "Selecione apenas arquivos de imagem.");
        event.target.value = "";
        return;
      }

      setUploadingLogo(true);

      try {
        const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "png";
        const filePath = `branding/logo-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("axon-assets")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);

        if (!data?.publicUrl) {
          throw new Error("Não foi possível obter a URL pública da logo.");
        }

        setCompanyForm((current) => ({
          ...current,
          logo_url: data.publicUrl,
        }));

        addToast("success", "Logo enviada", "A nova logo foi carregada e vinculada ao perfil.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha ao enviar a logo para o storage.";
        addToast("error", "Erro no upload", message);
      } finally {
        setUploadingLogo(false);
        event.target.value = "";
      }
    },
    [addToast]
  );

  const handleSaveCompany = useCallback(async () => {
    setSavingCompany(true);

    try {
      const payload: CompanyProfile = {
        company_name: companyForm.company_name.trim(),
        cnpj: companyForm.cnpj.trim(),
        logo_url: companyForm.logo_url.trim(),
        primary_color: companyForm.primary_color.trim() || "#138946",
        contract_terms: companyForm.contract_terms,
      };

      if (companyRowId !== null) {
        const { error } = await supabase
          .from("company_profile")
          .update(payload)
          .eq("id", companyRowId)
          .select();

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("company_profile")
          .insert(payload)
          .select("id")
          .single<{ id?: string | number }>();

        if (error) throw error;
        setCompanyRowId(data?.id ?? null);
      }

      addToast("success", "Perfil salvo", "As informações da empresa foram atualizadas com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar o perfil da empresa.";
      addToast("error", "Erro ao salvar", message);
    } finally {
      setSavingCompany(false);
    }
  }, [addToast, companyForm, companyRowId]);

  const handleSavePreferences = useCallback(async () => {
    setSavingPreferences(true);

    try {
      const payload: SystemPreferences = {
        feature_toggles: normalizeFeatureToggles(preferencesForm.feature_toggles),
        custom_labels: normalizeCustomLabels(preferencesForm.custom_labels),
      };

      if (preferencesRowId !== null) {
        const { error } = await supabase
          .from("system_preferences")
          .update(payload)
          .eq("id", preferencesRowId)
          .select();

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("system_preferences")
          .insert(payload)
          .select("id")
          .single<{ id?: string | number }>();

        if (error) throw error;
        setPreferencesRowId(data?.id ?? null);
      }

      addToast("success", "Preferências salvas", "As preferências do sistema foram atualizadas.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar as preferências.";
      addToast("error", "Erro ao salvar", message);
    } finally {
      setSavingPreferences(false);
    }
  }, [addToast, preferencesForm, preferencesRowId]);

  const tabs = useMemo(
    () => [
      {
        id: "company" as const,
        label: "Perfil da Empresa",
        icon: Building2,
        description: "Marca, identidade visual e termos contratuais.",
      },
      {
        id: "preferences" as const,
        label: "Preferências do Sistema",
        icon: SlidersHorizontal,
        description: "Módulos ativos e nomenclaturas globais da plataforma.",
      },
    ],
    []
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d0807] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1413] px-5 py-4 text-sm text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin text-[#138946]" />
            Carregando configurações...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0807] text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1413] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="relative p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(19,137,70,0.18),transparent_30%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#138946]/30 bg-[#138946]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#79d89f]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Super Admin
                </span>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Configurações Estratégicas
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                    Gerencie identidade institucional, branding white-label, módulos ativos e
                    nomenclaturas do ecossistema SaaS.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#120e0d]"
                    style={{ boxShadow: `0 0 0 1px ${companyForm.primary_color}22` }}
                  >
                    {companyForm.logo_url ? (
                      <img
                        src={companyForm.logo_url}
                        alt={companyForm.company_name || "Logo da empresa"}
                        className="max-h-10 w-auto object-contain"
                      />
                    ) : (
                      <Building2
                        className="h-6 w-6"
                        style={{ color: companyForm.primary_color || "#138946" }}
                      />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {companyForm.company_name || "Empresa não configurada"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Ambiente institucional do seu SaaS B2B
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-white/10 bg-[#1a1413] p-3">
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
                      "group rounded-2xl px-4 py-4 text-left transition-all",
                      isActive
                        ? "bg-[#138946] text-white shadow-lg shadow-[#138946]/20"
                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all",
                          isActive
                            ? "border-white/15 bg-white/10"
                            : "border-white/10 bg-black/20 group-hover:border-white/15 group-hover:bg-white/5"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{tab.label}</p>
                        <p className={cn("mt-1 text-xs leading-5", isActive ? "text-white/75" : "text-zinc-500")}>
                          {tab.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="rounded-[28px] border border-white/10 bg-[#1a1413] p-5 sm:p-6">
            {activeTab === "company" && (
              <div className="space-y-8">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Perfil da Empresa</h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Controle branding, identidade visual e os termos institucionais padrão.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSaveCompany()}
                      disabled={savingCompany}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f723b] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingCompany ? "Salvando..." : "Salvar perfil"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Building2 className="h-4 w-4 text-[#79d89f]" />
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
                          <FileText className="h-4 w-4 text-[#79d89f]" />
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
                          <Palette className="h-4 w-4 text-[#79d89f]" />
                          Cor principal
                        </label>
                        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0807] px-3 py-2">
                          <input
                            type="color"
                            value={companyForm.primary_color || "#138946"}
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

                      <div className="space-y-2 sm:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <ImageIcon className="h-4 w-4 text-[#79d89f]" />
                          URL pública da logo
                        </label>
                        <input
                          type="url"
                          value={companyForm.logo_url}
                          onChange={(e) => updateCompanyField("logo_url", e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <FileText className="h-4 w-4 text-[#79d89f]" />
                          Termos contratuais
                        </label>
                        <textarea
                          value={companyForm.contract_terms}
                          onChange={(e) => updateCompanyField("contract_terms", e.target.value)}
                          placeholder="Insira cláusulas, premissas, observações legais e estrutura contratual padrão..."
                          rows={12}
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-[#120e0d] p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">Logo institucional</h3>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Upload direto para o bucket axon-assets.
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
                            alt="Logo atual da empresa"
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
                      <h3 className="text-sm font-semibold text-white">Preview da marca</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        Exemplo rápido da aplicação da identidade principal.
                      </p>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d0807] p-4">
                        <button
                          type="button"
                          className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                          style={{ backgroundColor: companyForm.primary_color || "#138946" }}
                        >
                          CTA institucional
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="space-y-8">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#138946]/20 bg-[#138946]/10 text-[#79d89f]">
                      <Settings2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Preferências do Sistema</h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Defina quais módulos estão ativos e como as entidades aparecem na UI.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSavePreferences()}
                      disabled={savingPreferences}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#138946] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f723b] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPreferences ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingPreferences ? "Salvando..." : "Salvar preferências"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Feature Toggles
                      </h3>
                      <p className="mt-2 text-sm text-zinc-400">
                        Ative ou desative módulos estratégicos da operação conforme o plano ou a fase do cliente.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      {FEATURE_TOGGLE_DEFINITIONS.map((toggle) => {
                        const isEnabled = Boolean(preferencesForm.feature_toggles[toggle.key]);

                        return (
                          <button
                            key={toggle.key}
                            type="button"
                            onClick={() => toggleFeature(toggle.key)}
                            className={cn(
                              "flex items-center justify-between gap-4 rounded-3xl border p-4 text-left transition-all",
                              isEnabled
                                ? "border-[#138946]/35 bg-[#138946]/10"
                                : "border-white/10 bg-[#120e0d] hover:bg-white/5"
                            )}
                            aria-pressed={isEnabled}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">{toggle.label}</p>
                              <p className="mt-1 text-sm leading-6 text-zinc-400">
                                {toggle.description}
                              </p>
                            </div>

                            <div className="shrink-0">
                              {isEnabled ? (
                                <ToggleRight className="h-10 w-10 text-[#79d89f]" />
                              ) : (
                                <ToggleLeft className="h-10 w-10 text-zinc-600" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Nomenclaturas
                      </h3>
                      <p className="mt-2 text-sm text-zinc-400">
                        Personalize os rótulos globais usados nos módulos e painéis.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Type className="h-4 w-4 text-[#79d89f]" />
                          Cliente (singular)
                        </label>
                        <input
                          type="text"
                          value={preferencesForm.custom_labels.client_singular}
                          onChange={(e) => updateCustomLabel("client_singular", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Type className="h-4 w-4 text-[#79d89f]" />
                          Cliente (plural)
                        </label>
                        <input
                          type="text"
                          value={preferencesForm.custom_labels.client_plural}
                          onChange={(e) => updateCustomLabel("client_plural", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Type className="h-4 w-4 text-[#79d89f]" />
                          Orçamento (singular)
                        </label>
                        <input
                          type="text"
                          value={preferencesForm.custom_labels.quote_singular}
                          onChange={(e) => updateCustomLabel("quote_singular", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Type className="h-4 w-4 text-[#79d89f]" />
                          Orçamento (plural)
                        </label>
                        <input
                          type="text"
                          value={preferencesForm.custom_labels.quote_plural}
                          onChange={(e) => updateCustomLabel("quote_plural", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                          <Type className="h-4 w-4 text-[#79d89f]" />
                          Nome da Academy
                        </label>
                        <input
                          type="text"
                          value={preferencesForm.custom_labels.academy_name}
                          onChange={(e) => updateCustomLabel("academy_name", e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-[#0d0807] px-4 py-3 text-sm text-white outline-none transition focus:border-[#138946]/70 focus:ring-2 focus:ring-[#138946]/20"
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#120e0d] p-5">
                      <h4 className="text-sm font-semibold text-white">Pré-visualização</h4>
                      <p className="mt-1 text-sm text-zinc-500">
                        Exemplo do reflexo dessas nomenclaturas no sistema.
                      </p>

                      <div className="mt-4 grid gap-4">
                        <div className="rounded-2xl border border-white/10 bg-[#0d0807] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Módulos</p>
                          <p className="mt-3 text-sm text-zinc-300">
                            Gerenciar {preferencesForm.custom_labels.client_plural}
                          </p>
                          <p className="mt-1 text-sm text-zinc-300">
                            Novo {preferencesForm.custom_labels.quote_singular}
                          </p>
                          <p className="mt-1 text-sm text-zinc-300">
                            Área {preferencesForm.custom_labels.academy_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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