"use client";

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  BadgeCheck,
  Building2,
  Check,
  FileText,
  Grip,
  ImagePlus,
  LayoutGrid,
  Loader2,
  MapPin,
  PaintBucket,
  RefreshCcw,
  Save,
  Settings2,
  Type,
  Upload,
  X,
} from "lucide-react";

type SettingsTab = "perfil" | "sistema" | "modulos" | "documentacao";
type ToastType = "success" | "error" | "info";

type CustomLabels = Record<string, string>;
type FeatureToggles = Record<string, boolean>;
type CommercialDocuments = Record<string, string | boolean>;

interface SettingsContextShape {
  companyProfile?: CompanyProfileRecord | null;
  systemPreferences?: SystemPreferencesRecord | null;
  refreshSettings?: () => Promise<void> | void;
}

interface CompanyProfileRecord {
  id?: string | number;
  company_name?: string | null;
  cnpj?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  contract_terms?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  website?: string | null;
  contact_email?: string | null;
  phone_landline?: string | null;
  phone_mobile?: string | null;
  whatsapp_number?: string | null;
  zipcode?: string | null;
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  proposal_footer?: string | null;
  invoice_footer?: string | null;
}

interface SystemPreferencesRecord {
  id?: string | number;
  custom_labels?: CustomLabels | null;
  feature_toggles?: FeatureToggles | null;
  commercial_documents?: CommercialDocuments | null;
}

interface CompanyForm {
  id?: string;
  company_name: string;
  cnpj: string;
  logo_url: string;
  primary_color: string;
  contract_terms: string;
  legal_name: string;
  trade_name: string;
  website: string;
  contact_email: string;
  phone_landline: string;
  phone_mobile: string;
  whatsapp_number: string;
  zipcode: string;
  street: string;
  street_number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  country: string;
  proposal_footer: string;
  invoice_footer: string;
}

interface PreferencesForm {
  id?: string;
  custom_labels: CustomLabels;
  feature_toggles: FeatureToggles;
  commercial_documents: CommercialDocuments;
}

interface ToastState {
  type: ToastType;
  message: string;
}

interface IbgeState {
  id: number;
  nome: string;
  sigla: string;
}

interface IbgeCity {
  id: number;
  nome: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

const DEFAULT_COMPANY_FORM: CompanyForm = {
  company_name: "ARXUM",
  cnpj: "",
  logo_url: "",
  primary_color: "#138946",
  contract_terms: "",
  legal_name: "",
  trade_name: "",
  website: "",
  contact_email: "",
  phone_landline: "",
  phone_mobile: "",
  whatsapp_number: "",
  zipcode: "",
  street: "",
  street_number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  country: "Brasil",
  proposal_footer: "",
  invoice_footer: "",
};

const DEFAULT_CUSTOM_LABELS: CustomLabels = {
  crm_name: "CRM / Vendas",
  academy_name: "Treinamentos",
  inventory_name: "Inventário",
  os_name: "Ordem de Serviço",
  client_singular: "Cliente",
  client_plural: "Clientes",
  quote_singular: "Orçamento",
  quote_plural: "Orçamentos",
};

const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  enable_crm: true,
  enable_academy: true,
  enable_support: true,
  enable_financial: true,
  enable_inventory: true,
};

const DEFAULT_COMMERCIAL_DOCUMENTS: CommercialDocuments = {
  show_logo_on_quotes: true,
  show_company_address_on_quotes: true,
  show_company_contacts_on_quotes: true,
  show_signature_on_quotes: false,
  quote_intro_text: "",
  quote_terms_text: "",
  default_contract_template: "",
  default_proposal_template: "",
  default_operational_notes: "",
};

const MODULES: Array<{
  key: string;
  title: string;
  description: string;
}> = [
  {
    key: "enable_crm",
    title: "CRM / Vendas",
    description: "Leads, relacionamento e oportunidades comerciais.",
  },
  {
    key: "enable_academy",
    title: "Academy / Treinamentos",
    description: "Netflix corporativa para funcionários e clientes.",
  },
  {
    key: "enable_support",
    title: "Suporte",
    description: "Atendimento técnico e acompanhamento de chamados.",
  },
  {
    key: "enable_financial",
    title: "Financeiro",
    description: "Cobranças, recebimentos, vencimentos e controle financeiro.",
  },
  {
    key: "enable_inventory",
    title: "Inventário",
    description: "Equipamentos, materiais e ativos operacionais.",
  },
];

const LABEL_GROUPS: Array<{ title: string; fields: string[] }> = [
  {
    title: "Abas e módulos principais",
    fields: ["crm_name", "academy_name", "inventory_name", "os_name"],
  },
  {
    title: "Entidades comerciais",
    fields: ["client_singular", "client_plural", "quote_singular", "quote_plural"],
  },
];

const LABEL_MAP: Record<string, string> = {
  crm_name: "Nome da aba CRM",
  academy_name: "Nome da aba Academy / Treinamentos",
  inventory_name: "Nome da aba Inventário",
  os_name: "Nome da aba Ordem de Serviço",
  client_singular: "Cliente (singular)",
  client_plural: "Clientes (plural)",
  quote_singular: "Orçamento (singular)",
  quote_plural: "Orçamentos (plural)",
};

const SYSTEM_PRESETS: Array<{
  title: string;
  description: string;
  labels: Record<string, string>;
  toggles?: Record<string, boolean>;
}> = [
  {
    title: "Saúde",
    description: "Consultório médico, odonto, vet e atendimento clínico.",
    labels: {
      crm_name: "Relacionamento",
      academy_name: "Treinamentos",
      inventory_name: "Materiais",
      os_name: "Atendimentos",
      client_singular: "Paciente",
      client_plural: "Pacientes",
      quote_singular: "Consulta",
      quote_plural: "Consultas",
    },
    toggles: {
      enable_academy: false,
      enable_inventory: false,
    },
  },
  {
    title: "Educação",
    description: "Escolas, cursos, treinamentos e operação EAD.",
    labels: {
      crm_name: "Relacionamento",
      academy_name: "Cursos",
      inventory_name: "Materiais",
      os_name: "Atividades",
      client_singular: "Aluno",
      client_plural: "Alunos",
      quote_singular: "Matrícula",
      quote_plural: "Matrículas",
    },
  },
  {
    title: "Eventos",
    description: "Locação, produção, estruturas e operação técnica.",
    labels: {
      crm_name: "CRM / Vendas",
      academy_name: "Treinamentos",
      inventory_name: "Equipamentos",
      os_name: "Operações",
      client_singular: "Cliente",
      client_plural: "Clientes",
      quote_singular: "Proposta",
      quote_plural: "Propostas",
    },
  },
  {
    title: "Consultoria",
    description: "Projetos consultivos, acompanhamento e contratos.",
    labels: {
      crm_name: "Comercial",
      academy_name: "Base de Conhecimento",
      inventory_name: "Recursos",
      os_name: "Projetos",
      client_singular: "Conta",
      client_plural: "Contas",
      quote_singular: "Proposta",
      quote_plural: "Propostas",
    },
    toggles: {
      enable_inventory: false,
    },
  },
  {
    title: "Web Host",
    description: "Assinaturas, suporte, clientes e operação técnica.",
    labels: {
      crm_name: "Comercial",
      academy_name: "Tutoriais",
      inventory_name: "Infraestrutura",
      os_name: "Chamados",
      client_singular: "Conta",
      client_plural: "Contas",
      quote_singular: "Plano",
      quote_plural: "Planos",
    },
    toggles: {
      enable_inventory: false,
      enable_academy: false,
    },
  },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Erro inesperado");
  }
  return "Erro inesperado";
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { companyProfile, systemPreferences, refreshSettings } =
    useSettings() as SettingsContextShape;

  const [activeTab, setActiveTab] = useState<SettingsTab>("perfil");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(DEFAULT_COMPANY_FORM);
  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    custom_labels: { ...DEFAULT_CUSTOM_LABELS },
    feature_toggles: { ...DEFAULT_FEATURE_TOGGLES },
    commercial_documents: { ...DEFAULT_COMMERCIAL_DOCUMENTS },
  });
  const [states, setStates] = useState<IbgeState[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [zipcodeLoading, setZipcodeLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [logoScale, setLogoScale] = useState(1);
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 50 });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const nextCompany: CompanyForm = {
      ...DEFAULT_COMPANY_FORM,
      id: companyProfile?.id ? String(companyProfile.id) : undefined,
      company_name: getString(companyProfile?.company_name, "ARXUM").replace(/AXON/gi, "ARXUM"),
      cnpj: getString(companyProfile?.cnpj),
      logo_url: getString(companyProfile?.logo_url),
      primary_color: getString(companyProfile?.primary_color, "#138946") || "#138946",
      contract_terms: getString(companyProfile?.contract_terms),
      legal_name: getString(companyProfile?.legal_name),
      trade_name: getString(companyProfile?.trade_name),
      website: getString(companyProfile?.website),
      contact_email: getString(companyProfile?.contact_email),
      phone_landline: getString(companyProfile?.phone_landline),
      phone_mobile: getString(companyProfile?.phone_mobile),
      whatsapp_number: getString(companyProfile?.whatsapp_number),
      zipcode: getString(companyProfile?.zipcode),
      street: getString(companyProfile?.street),
      street_number: getString(companyProfile?.street_number),
      complement: getString(companyProfile?.complement),
      district: getString(companyProfile?.district),
      city: getString(companyProfile?.city),
      state: getString(companyProfile?.state),
      country: getString(companyProfile?.country, "Brasil") || "Brasil",
      proposal_footer: getString(companyProfile?.proposal_footer),
      invoice_footer: getString(companyProfile?.invoice_footer),
    };

    const nextPreferences: PreferencesForm = {
      id: systemPreferences?.id ? String(systemPreferences.id) : undefined,
      custom_labels: {
        ...DEFAULT_CUSTOM_LABELS,
        ...(systemPreferences?.custom_labels ?? {}),
      },
      feature_toggles: {
        ...DEFAULT_FEATURE_TOGGLES,
        ...(systemPreferences?.feature_toggles ?? {}),
      },
      commercial_documents: {
        ...DEFAULT_COMMERCIAL_DOCUMENTS,
        ...(systemPreferences?.commercial_documents ?? {}),
      },
    };

    setCompanyForm(nextCompany);
    setPreferencesForm(nextPreferences);
    setLogoPreview(nextCompany.logo_url || "");
  }, [companyProfile, systemPreferences]);

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados")
      .then((res) => res.json())
      .then((data: IbgeState[]) =>
        setStates([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))
      )
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    const uf = companyForm.state.trim().toUpperCase();
    if (!uf || uf.length !== 2) {
      setCities([]);
      return;
    }

    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then((res) => res.json())
      .then((data: IbgeCity[]) =>
        setCities([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))
      )
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [companyForm.state]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3500);
  };

  const setField = <K extends keyof CompanyForm>(field: K, value: CompanyForm[K]) => {
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  };

  const setLabelField = (key: string, value: string) => {
    setPreferencesForm((prev) => ({
      ...prev,
      custom_labels: {
        ...prev.custom_labels,
        [key]: value,
      },
    }));
  };

  const setFeatureToggle = (key: string, value: boolean) => {
    setPreferencesForm((prev) => ({
      ...prev,
      feature_toggles: {
        ...prev.feature_toggles,
        [key]: value,
      },
    }));
  };

  const setCommercialField = (key: string, value: string | boolean) => {
    setPreferencesForm((prev) => ({
      ...prev,
      commercial_documents: {
        ...prev.commercial_documents,
        [key]: value,
      },
    }));
  };

  const masked =
    (field: keyof CompanyForm, formatter: (value: string) => string) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setField(field, formatter(e.target.value) as CompanyForm[keyof CompanyForm]);
    };

  const handleZipcodeChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setField("zipcode", formatted);

    const digits = onlyDigits(formatted);
    if (digits.length !== 8) return;

    try {
      setZipcodeLoading(true);
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: ViaCepResponse = await response.json();

      if (data.erro) {
        showToast("CEP não encontrado.", "error");
        return;
      }

      setCompanyForm((prev) => ({
        ...prev,
        zipcode: formatted,
        street: data.logradouro || prev.street,
        district: data.bairro || prev.district,
        complement: prev.complement || data.complemento || "",
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));

      showToast("Endereço preenchido automaticamente.", "success");
    } catch {
      showToast("Não foi possível consultar o CEP.", "error");
    } finally {
      setZipcodeLoading(false);
    }
  };

  const selectLogo = (file?: File | null) => {
    if (!file) return;

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;

    setSelectedLogoFile(file);
    setLogoPreview(url);
    setCropMode(true);
    setLogoScale(1);
    setLogoPosition({ x: 50, y: 50 });
    showToast("Logo carregada. Ajuste o enquadramento e salve.", "info");
  };

  const removeLogo = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setSelectedLogoFile(null);
    setLogoPreview("");
    setField("logo_url", "");
    showToast("Logo removida da configuração atual.", "info");
  };

  const uploadLogo = async (): Promise<string> => {
    if (!selectedLogoFile) return companyForm.logo_url || "";

    const extension = selectedLogoFile.name.split(".").pop()?.toLowerCase() || "png";
    const safeName = sanitizeFileName(
      selectedLogoFile.name.replace(/\.[^.]+$/, "") || "logo-arxum"
    );
    const filePath = `logos/${Date.now()}-${safeName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("axon-assets")
      .upload(filePath, selectedLogoFile, {
        contentType: selectedLogoFile.type || "image/png",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);
    const publicUrl = data?.publicUrl || "";

    if (!publicUrl) {
      throw new Error("Não foi possível gerar a URL pública da logo.");
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setSelectedLogoFile(null);
    setCropMode(false);
    setLogoPreview(publicUrl);
    setField("logo_url", publicUrl);

    return publicUrl;
  };

  const saveCompanyProfile = async () => {
    const logoUrl = await uploadLogo();

    const payload = {
      id: companyForm.id || "00000000-0000-0000-0000-000000000001",
      company_name: (companyForm.company_name || "ARXUM").replace(/AXON/gi, "ARXUM"),
      cnpj: companyForm.cnpj || "",
      logo_url: logoUrl || "",
      primary_color: companyForm.primary_color || "#138946",
      contract_terms: companyForm.contract_terms || "",
      legal_name: companyForm.legal_name || "",
      trade_name: companyForm.trade_name || "",
      website: companyForm.website || "",
      contact_email: companyForm.contact_email || "",
      phone_landline: companyForm.phone_landline || "",
      phone_mobile: companyForm.phone_mobile || "",
      whatsapp_number: companyForm.whatsapp_number || "",
      zipcode: companyForm.zipcode || "",
      street: companyForm.street || "",
      street_number: companyForm.street_number || "",
      complement: companyForm.complement || "",
      district: companyForm.district || "",
      city: companyForm.city || "",
      state: companyForm.state || "",
      country: companyForm.country || "Brasil",
      proposal_footer: companyForm.proposal_footer || "",
      invoice_footer: companyForm.invoice_footer || "",
    };

    const { error } = await supabase
      .from("company_profile")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;
  };

  const saveSystemPreferences = async () => {
    const payload = {
      id: preferencesForm.id || "00000000-0000-0000-0000-000000000001",
      custom_labels: preferencesForm.custom_labels || {},
      feature_toggles: preferencesForm.feature_toggles || {},
      commercial_documents: preferencesForm.commercial_documents || {},
    };

    const { error } = await supabase
      .from("system_preferences")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;
  };

  const handleSave = async () => {
    setIsSubmitting(true);

    try {
      if (activeTab === "perfil") {
        await saveCompanyProfile();
      }

      if (activeTab === "sistema") {
        await saveSystemPreferences();
      }

      if (activeTab === "modulos") {
        await saveSystemPreferences();
      }

      if (activeTab === "documentacao") {
        await saveCompanyProfile();
        await saveSystemPreferences();
      }

      if (refreshSettings) {
        await refreshSettings();
      }

      router.refresh();
      showToast("Configurações salvas com sucesso.", "success");
    } catch (error) {
      showToast(`Erro ao salvar: ${getErrorMessage(error)}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (preset: (typeof SYSTEM_PRESETS)[number]) => {
    setPreferencesForm((prev) => ({
      ...prev,
      custom_labels: {
        ...prev.custom_labels,
        ...preset.labels,
      },
      feature_toggles: {
        ...prev.feature_toggles,
        ...(preset.toggles ?? {}),
      },
    }));

    showToast(`Preset ${preset.title} aplicado.`, "info");
  };

  const activeModulesCount = useMemo(
    () => Object.values(preferencesForm.feature_toggles).filter(Boolean).length,
    [preferencesForm.feature_toggles]
  );

  return (
    <div className="relative mx-auto max-w-7xl space-y-6 pb-12">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${
            toast.type === "success"
              ? "border-cs-green/30 bg-cs-green/10 text-cs-green"
              : toast.type === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-white/10 bg-white/5 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <Check size={18} />
          ) : toast.type === "error" ? (
            <X size={18} />
          ) : (
            <Settings2 size={18} />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cs-green/20 bg-cs-green/10 px-3 py-1 text-xs font-semibold text-cs-green">
              <BadgeCheck className="h-3.5 w-3.5" />
              ARXUM · Configurações globais
            </div>
            <h1 className="text-2xl font-semibold text-white">Centro de Configurações</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Perfil da empresa, presets de segmento, módulos ativos e documentação comercial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
              <span className="block text-xs text-text-secondary">Módulos ativos</span>
              <span className="font-semibold text-white">{activeModulesCount}</span>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-cs-green px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar alterações
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-surface p-3">
          <div className="space-y-2">
            {[
              { id: "perfil", label: "Perfil da empresa", icon: Building2 },
              { id: "sistema", label: "Configuração do sistema", icon: Type },
              { id: "modulos", label: "Módulos", icon: LayoutGrid },
              { id: "documentacao", label: "Documentação", icon: FileText },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    isActive
                      ? "bg-cs-green text-white"
                      : "text-text-secondary hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-6">
          {activeTab === "perfil" && (
            <>
              <Card
                title="Identidade visual"
                description="Logo, cor principal e identidade da empresa."
                icon={PaintBucket}
              >
                <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-dashed border-white/10 bg-background p-4">
                      <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-black">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo da empresa"
                            className="pointer-events-none max-h-full max-w-full object-contain"
                            style={
                              cropMode
                                ? {
                                    transform: `translate(${logoPosition.x - 50}px, ${logoPosition.y - 50}px) scale(${logoScale})`,
                                  }
                                : undefined
                            }
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-text-secondary">
                            <ImagePlus className="h-8 w-8" />
                            <span className="text-sm">Nenhuma logo enviada</span>
                          </div>
                        )}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => selectLogo(e.target.files?.[0] ?? null)}
                      />

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                        >
                          <Upload className="h-4 w-4" />
                          {logoPreview ? "Trocar logo" : "Enviar logo"}
                        </button>

                        {logoPreview && (
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/20"
                          >
                            <X className="h-4 w-4" />
                            Remover
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-background p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                        <Grip className="h-4 w-4 text-cs-green" />
                        Ajuste visual da logo
                      </div>

                      <div className="space-y-4">
                        <RangeField
                          label="Zoom"
                          min={1}
                          max={2.5}
                          step={0.1}
                          value={logoScale}
                          onChange={(value) => setLogoScale(value)}
                        />
                        <RangeField
                          label="Posição horizontal"
                          min={0}
                          max={100}
                          step={1}
                          value={logoPosition.x}
                          onChange={(value) => setLogoPosition((prev) => ({ ...prev, x: value }))}
                        />
                        <RangeField
                          label="Posição vertical"
                          min={0}
                          max={100}
                          step={1}
                          value={logoPosition.y}
                          onChange={(value) => setLogoPosition((prev) => ({ ...prev, y: value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <InputField
                      label="Nome exibido da empresa"
                      value={companyForm.company_name}
                      onChange={(e) =>
                        setField("company_name", e.target.value.replace(/AXON/gi, "ARXUM"))
                      }
                    />
                    <InputField
                      label="Nome fantasia"
                      value={companyForm.trade_name}
                      onChange={(e) => setField("trade_name", e.target.value)}
                    />
                    <InputField
                      label="Razão social"
                      value={companyForm.legal_name}
                      onChange={(e) => setField("legal_name", e.target.value)}
                    />
                    <InputField
                      label="CNPJ"
                      value={companyForm.cnpj}
                      onChange={masked("cnpj", formatCnpj)}
                      placeholder="00.000.000/0000-00"
                    />
                    <InputField
                      label="E-mail"
                      type="email"
                      value={companyForm.contact_email}
                      onChange={(e) => setField("contact_email", e.target.value)}
                    />
                    <InputField
                      label="Website"
                      value={companyForm.website}
                      onChange={(e) => setField("website", e.target.value)}
                      placeholder="https://seusite.com.br"
                    />
                    <InputField
                      label="Telefone fixo"
                      value={companyForm.phone_landline}
                      onChange={masked("phone_landline", formatPhone)}
                    />
                    <InputField
                      label="Celular"
                      value={companyForm.phone_mobile}
                      onChange={masked("phone_mobile", formatPhone)}
                    />
                    <InputField
                      label="WhatsApp"
                      value={companyForm.whatsapp_number}
                      onChange={masked("whatsapp_number", formatPhone)}
                    />

                    <div className="md:col-span-2 xl:col-span-1">
                      <label className="mb-2 block text-xs font-medium text-text-secondary">
                        Cor principal
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={companyForm.primary_color}
                          onChange={(e) => setField("primary_color", e.target.value)}
                          className="h-11 w-11 rounded-xl border-0 bg-transparent p-0"
                        />
                        <input
                          type="text"
                          value={companyForm.primary_color}
                          onChange={(e) => setField("primary_color", e.target.value)}
                          className="block w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm uppercase text-white outline-none transition focus:border-cs-green"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                title="Endereço"
                description="CEP com preenchimento automático e localização completa."
                icon={MapPin}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <InputField
                    label={zipcodeLoading ? "CEP (consultando...)" : "CEP"}
                    value={companyForm.zipcode}
                    onChange={handleZipcodeChange}
                  />
                  <div className="xl:col-span-2">
                    <InputField
                      label="Logradouro"
                      value={companyForm.street}
                      onChange={(e) => setField("street", e.target.value)}
                    />
                  </div>
                  <InputField
                    label="Número"
                    value={companyForm.street_number}
                    onChange={(e) => setField("street_number", e.target.value)}
                  />
                  <InputField
                    label="Complemento"
                    value={companyForm.complement}
                    onChange={(e) => setField("complement", e.target.value)}
                  />
                  <InputField
                    label="Bairro"
                    value={companyForm.district}
                    onChange={(e) => setField("district", e.target.value)}
                  />

                  <SelectField
                    label="Estado"
                    value={companyForm.state}
                    onChange={(e) => {
                      setField("state", e.target.value);
                      setField("city", "");
                    }}
                  >
                    <option value="">Selecione</option>
                    {states.map((state) => (
                      <option key={state.id} value={state.sigla}>
                        {state.nome} ({state.sigla})
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    label={loadingCities ? "Cidade (carregando...)" : "Cidade"}
                    value={companyForm.city}
                    disabled={!companyForm.state || loadingCities}
                    onChange={(e) => setField("city", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.nome}>
                        {city.nome}
                      </option>
                    ))}
                  </SelectField>

                  <InputField
                    label="País"
                    value={companyForm.country}
                    onChange={(e) => setField("country", e.target.value)}
                  />
                </div>
              </Card>
            </>
          )}

          {activeTab === "sistema" && (
            <>
              <Card
                title="Presets por segmento"
                description="Aplica nomes padrão do seu nicho em todo o sistema."
                icon={RefreshCcw}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {SYSTEM_PRESETS.map((preset) => (
                    <div
                      key={preset.title}
                      className="rounded-3xl border border-white/10 bg-background p-4"
                    >
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-white">{preset.title}</h3>
                        <p className="mt-1 text-xs text-text-secondary">{preset.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-cs-green/20 bg-cs-green/10 px-4 py-2 text-sm font-medium text-cs-green transition hover:bg-cs-green/20"
                      >
                        Aplicar preset
                      </button>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                title="Nomes personalizados"
                description="Se o preset não atender, digite seus próprios nomes."
                icon={Type}
              >
                <div className="space-y-6">
                  {LABEL_GROUPS.map((group) => (
                    <div
                      key={group.title}
                      className="rounded-3xl border border-white/10 bg-background p-4"
                    >
                      <h3 className="mb-4 text-sm font-semibold text-white">{group.title}</h3>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {group.fields.map((field) => (
                          <InputField
                            key={field}
                            label={LABEL_MAP[field] ?? field}
                            value={preferencesForm.custom_labels[field] || ""}
                            onChange={(e) => setLabelField(field, e.target.value)}
                            placeholder={DEFAULT_CUSTOM_LABELS[field]}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {activeTab === "modulos" && (
            <Card
              title="Ativação de módulos"
              description="Ligue e desligue os módulos realmente usados pela empresa."
              icon={LayoutGrid}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {MODULES.map((module) => {
                  const isActive = preferencesForm.feature_toggles[module.key] ?? true;

                  return (
                    <div
                      key={module.key}
                      className="flex items-center justify-between rounded-3xl border border-white/10 bg-background p-4"
                    >
                      <div className="pr-4">
                        <h3 className="text-sm font-semibold text-white">{module.title}</h3>
                        <p className="mt-1 text-xs text-text-secondary">{module.description}</p>
                      </div>

                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setFeatureToggle(module.key, !isActive)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                          isActive ? "bg-cs-green" : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                            isActive ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {activeTab === "documentacao" && (
            <>
              <Card
                title="Exibição em documentos"
                description="Escolha quais dados comerciais aparecem nos materiais emitidos."
                icon={FileText}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { key: "show_logo_on_quotes", label: "Exibir logo nos orçamentos" },
                    { key: "show_company_address_on_quotes", label: "Exibir endereço nos orçamentos" },
                    { key: "show_company_contacts_on_quotes", label: "Exibir contatos nos orçamentos" },
                    { key: "show_signature_on_quotes", label: "Exibir assinatura nos orçamentos" },
                  ].map((item) => {
                    const active = getBoolean(preferencesForm.commercial_documents[item.key], false);

                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-3xl border border-white/10 bg-background p-4"
                      >
                        <span className="text-sm font-medium text-white">{item.label}</span>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCommercialField(item.key, !active)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                            active ? "bg-cs-green" : "bg-white/10"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                              active ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card
                title="Textos padrão"
                description="Ajuste introduções, termos, contratos e rodapés."
                icon={FileText}
              >
                <div className="space-y-4">
                  <TextareaField
                    label="Texto de abertura do orçamento"
                    rows={3}
                    value={getString(preferencesForm.commercial_documents.quote_intro_text)}
                    onChange={(e) => setCommercialField("quote_intro_text", e.target.value)}
                  />

                  <TextareaField
                    label="Termos e condições do orçamento"
                    rows={4}
                    value={getString(preferencesForm.commercial_documents.quote_terms_text)}
                    onChange={(e) => setCommercialField("quote_terms_text", e.target.value)}
                  />

                  <TextareaField
                    label="Cláusulas padrão de contrato"
                    rows={5}
                    value={companyForm.contract_terms}
                    onChange={(e) => setField("contract_terms", e.target.value)}
                  />

                  <TextareaField
                    label="Modelo padrão de proposta"
                    rows={4}
                    value={getString(preferencesForm.commercial_documents.default_proposal_template)}
                    onChange={(e) =>
                      setCommercialField("default_proposal_template", e.target.value)
                    }
                  />

                  <TextareaField
                    label="Observações operacionais padrão"
                    rows={3}
                    value={getString(preferencesForm.commercial_documents.default_operational_notes)}
                    onChange={(e) =>
                      setCommercialField("default_operational_notes", e.target.value)
                    }
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextareaField
                      label="Rodapé de propostas"
                      rows={3}
                      value={companyForm.proposal_footer}
                      onChange={(e) => setField("proposal_footer", e.target.value)}
                    />
                    <TextareaField
                      label="Rodapé de faturas"
                      rows={3}
                      value={companyForm.invoice_footer}
                      onChange={(e) => setField("invoice_footer", e.target.value)}
                    />
                  </div>
                </div>
              </Card>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-surface p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-white/10 pb-4">
        <div className="rounded-2xl bg-cs-green/10 p-2 text-cs-green">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="block w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white outline-none transition focus:border-cs-green"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="block w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white outline-none transition focus:border-cs-green disabled:opacity-50"
      >
        {children}
      </select>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-text-secondary">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={onChange}
        className="block w-full resize-none rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white outline-none transition focus:border-cs-green"
      />
    </div>
  );
}

function RangeField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium text-text-secondary">{label}</label>
        <span className="text-xs text-white">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#138946]"
      />
    </div>
  );
}