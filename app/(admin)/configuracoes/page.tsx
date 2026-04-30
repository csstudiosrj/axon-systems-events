"use client";

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  Building2,
  Check,
  FileText,
  LayoutGrid,
  Loader2,
  MapPin,
  Paintbrush,
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
  feature_toggles?: FeatureToggles | null;
  custom_labels?: CustomLabels | null;
  commercial_documents?: CommercialDocuments | null;
}

interface SettingsContextShape {
  companyProfile?: CompanyProfileRecord | null;
  systemPreferences?: SystemPreferencesRecord | null;
  refreshSettings?: () => Promise<void> | void;
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
  feature_toggles: FeatureToggles;
  custom_labels: CustomLabels;
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

const OFFICIAL_PROFILE_ID = "22ad58f5-1c84-4037-aab5-74f86b0bee38";
const OFFICIAL_PREFERENCES_ID = "31d266bd-01f5-45ed-a976-98c4a4fbfffb";

const DEFAULT_COMPANY_FORM: CompanyForm = {
  id: OFFICIAL_PROFILE_ID,
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
  menu_crm: "CRM / Vendas",
  menu_team: "Equipe",
  menu_quotes: "Orçamentos",
  academy_name: "Treinamentos",
  menu_support: "Suporte Técnico",
  quote_plural: "Orçamentos",
  client_plural: "Clientes",
  menu_calendar: "Calendário",
  menu_patients: "Pacientes",
  menu_training: "Treinamentos",
  menu_dashboard: "Visão Geral",
  menu_financial: "Financeiro",
  menu_inventory: "Inventário",
  menu_marketing: "Marketing",
  quote_singular: "Orçamento",
  client_singular: "Cliente",
  entity_lead_plural: "Leads",
  entity_quote_plural: "Orçamentos",
  menu_service_orders: "Ordens de Serviço",
  entity_client_plural: "Clientes",
  entity_course_plural: "Cursos",
  entity_lead_singular: "Lead",
  entity_lesson_plural: "Aulas",
  entity_invoice_plural: "Faturas",
  entity_quote_singular: "Orçamento",
  entity_client_singular: "Cliente",
  entity_contract_plural: "Contratos",
  entity_course_singular: "Curso",
  entity_lesson_singular: "Aula",
  entity_proposal_plural: "Propostas",
  entity_equipment_plural: "Equipamentos",
  entity_invoice_singular: "Fatura",
  entity_contract_singular: "Contrato",
  entity_proposal_singular: "Proposta",
  entity_equipment_singular: "Equipamento",
  entity_salesperson_plural: "Responsáveis Comerciais",
  entity_salesperson_singular: "Responsável Comercial",
  entity_service_order_plural: "Ordens de Serviço",
  entity_service_order_singular: "Ordem de Serviço",
};

const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  enable_dashboard: true,
  enable_crm: true,
  enable_clients: true,
  enable_quotes: true,
  enable_financial: true,
  enable_inventory: true,
  enable_service_orders: true,
  enable_marketing: true,
  enable_calendar: true,
  enable_team: true,
  enable_support: true,
  enable_training: true,
  enable_client_portal: true,
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

const FEATURE_MODULES = [
  { key: "enable_dashboard", title: "Dashboard", desc: "Visão geral do negócio." },
  { key: "enable_crm", title: "CRM / Vendas", desc: "Leads e oportunidades." },
  { key: "enable_clients", title: "Clientes", desc: "Cadastros e relacionamentos." },
  { key: "enable_quotes", title: "Orçamentos", desc: "Propostas e negociações." },
  { key: "enable_financial", title: "Financeiro", desc: "Receitas, vencimentos e fluxo." },
  { key: "enable_inventory", title: "Inventário", desc: "Produtos, equipamentos e estoque." },
  { key: "enable_service_orders", title: "Ordens de Serviço", desc: "Execução operacional." },
  { key: "enable_marketing", title: "Marketing", desc: "Campanhas e planejamento." },
  { key: "enable_calendar", title: "Calendário", desc: "Agenda e compromissos." },
  { key: "enable_team", title: "Equipe", desc: "Colaboradores e times." },
  { key: "enable_support", title: "Suporte", desc: "Atendimento técnico." },
  { key: "enable_training", title: "Treinamentos", desc: "Academia e aulas." },
  { key: "enable_client_portal", title: "Portal do Cliente", desc: "Área do cliente final." },
];

const LABEL_GROUPS: Array<{ title: string; fields: string[] }> = [
  {
    title: "Menus principais",
    fields: [
      "menu_crm",
      "menu_team",
      "menu_quotes",
      "academy_name",
      "menu_support",
      "menu_calendar",
      "menu_dashboard",
      "menu_financial",
      "menu_inventory",
      "menu_marketing",
      "menu_service_orders",
      "menu_training",
      "menu_patients",
    ],
  },
  {
    title: "Entidades",
    fields: [
      "client_singular",
      "client_plural",
      "quote_singular",
      "quote_plural",
      "entity_client_singular",
      "entity_client_plural",
      "entity_quote_singular",
      "entity_quote_plural",
      "entity_contract_singular",
      "entity_contract_plural",
      "entity_invoice_singular",
      "entity_invoice_plural",
      "entity_course_singular",
      "entity_course_plural",
      "entity_lesson_singular",
      "entity_lesson_plural",
      "entity_proposal_singular",
      "entity_proposal_plural",
      "entity_equipment_singular",
      "entity_equipment_plural",
      "entity_salesperson_singular",
      "entity_salesperson_plural",
      "entity_service_order_singular",
      "entity_service_order_plural",
      "entity_lead_singular",
      "entity_lead_plural",
    ],
  },
];

const LABEL_MAP: Record<string, string> = {
  menu_crm: "Menu CRM",
  menu_team: "Menu Equipe",
  menu_quotes: "Menu Orçamentos",
  academy_name: "Academy / Treinamentos",
  menu_support: "Menu Suporte",
  menu_calendar: "Menu Calendário",
  menu_dashboard: "Menu Visão Geral",
  menu_financial: "Menu Financeiro",
  menu_inventory: "Menu Inventário",
  menu_marketing: "Menu Marketing",
  menu_service_orders: "Menu Ordens de Serviço",
  menu_training: "Menu Treinamentos",
  menu_patients: "Menu Pacientes",
  client_singular: "Cliente singular",
  client_plural: "Cliente plural",
  quote_singular: "Orçamento singular",
  quote_plural: "Orçamento plural",
  entity_client_singular: "Entidade cliente singular",
  entity_client_plural: "Entidade cliente plural",
  entity_quote_singular: "Entidade orçamento singular",
  entity_quote_plural: "Entidade orçamento plural",
  entity_contract_singular: "Entidade contrato singular",
  entity_contract_plural: "Entidade contrato plural",
  entity_invoice_singular: "Entidade fatura singular",
  entity_invoice_plural: "Entidade fatura plural",
  entity_course_singular: "Entidade curso singular",
  entity_course_plural: "Entidade curso plural",
  entity_lesson_singular: "Entidade aula singular",
  entity_lesson_plural: "Entidade aula plural",
  entity_proposal_singular: "Entidade proposta singular",
  entity_proposal_plural: "Entidade proposta plural",
  entity_equipment_singular: "Entidade equipamento singular",
  entity_equipment_plural: "Entidade equipamento plural",
  entity_salesperson_singular: "Entidade responsável singular",
  entity_salesperson_plural: "Entidade responsáveis plural",
  entity_service_order_singular: "Entidade OS singular",
  entity_service_order_plural: "Entidade OS plural",
  entity_lead_singular: "Entidade lead singular",
  entity_lead_plural: "Entidade lead plural",
};

const PRESETS = [
  {
    title: "Eventos",
    labels: {
      menu_quotes: "Propostas",
      menu_service_orders: "Operações",
      inventory_name: "Estruturas",
      quote_singular: "Proposta",
      quote_plural: "Propostas",
      client_singular: "Cliente",
      client_plural: "Clientes",
    },
  },
  {
    title: "Educação",
    labels: {
      menu_quotes: "Matrículas",
      academy_name: "Cursos",
      quote_singular: "Matrícula",
      quote_plural: "Matrículas",
      client_singular: "Aluno",
      client_plural: "Alunos",
    },
  },
  {
    title: "Saúde",
    labels: {
      menu_quotes: "Consultas",
      menu_patients: "Pacientes",
      quote_singular: "Consulta",
      quote_plural: "Consultas",
      client_singular: "Paciente",
      client_plural: "Pacientes",
    },
  },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCep(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
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
  const { companyProfile, systemPreferences, refreshSettings } = useSettings() as SettingsContextShape;

  const [activeTab, setActiveTab] = useState<SettingsTab>("perfil");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(DEFAULT_COMPANY_FORM);
  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    id: OFFICIAL_PREFERENCES_ID,
    feature_toggles: { ...DEFAULT_FEATURE_TOGGLES },
    custom_labels: { ...DEFAULT_CUSTOM_LABELS },
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setCompanyForm({
      ...DEFAULT_COMPANY_FORM,
      id: OFFICIAL_PROFILE_ID,
      company_name: getString(companyProfile?.company_name, "ARXUM") || "ARXUM",
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
    });

    setLogoPreview(getString(companyProfile?.logo_url));

    setPreferencesForm({
      id: OFFICIAL_PREFERENCES_ID,
      feature_toggles: {
        ...DEFAULT_FEATURE_TOGGLES,
        ...(systemPreferences?.feature_toggles ?? {}),
      },
      custom_labels: {
        ...DEFAULT_CUSTOM_LABELS,
        ...(systemPreferences?.custom_labels ?? {}),
      },
      commercial_documents: {
        ...DEFAULT_COMMERCIAL_DOCUMENTS,
        ...(systemPreferences?.commercial_documents ?? {}),
      },
    });
  }, [companyProfile, systemPreferences]);

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados")
      .then((res) => res.json())
      .then((data: IbgeState[]) => setStates([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))))
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
      .then((data: IbgeCity[]) => setCities([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))))
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
      custom_labels: { ...prev.custom_labels, [key]: value },
    }));
  };

  const setFeatureToggle = (key: string, value: boolean) => {
    setPreferencesForm((prev) => ({
      ...prev,
      feature_toggles: { ...prev.feature_toggles, [key]: value },
    }));
  };

  const setCommercialField = (key: string, value: string | boolean) => {
    setPreferencesForm((prev) => ({
      ...prev,
      commercial_documents: { ...prev.commercial_documents, [key]: value },
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
    showToast("Logo selecionada. Salve para aplicar.", "info");
  };

  const removeLogo = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setSelectedLogoFile(null);
    setLogoPreview("");
    setField("logo_url", "");
  };

  const uploadLogo = async () => {
    if (!selectedLogoFile) return companyForm.logo_url || "";

    const extension = selectedLogoFile.name.split(".").pop()?.toLowerCase() || "png";
    const safeName = sanitizeFileName(selectedLogoFile.name.replace(/\.[^.]+$/, "") || "logo-arxum");
    const filePath = `branding/global/logo-${Date.now()}-${safeName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("axon-assets")
      .upload(filePath, selectedLogoFile, {
        contentType: selectedLogoFile.type || "image/png",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);
    const publicUrl = data?.publicUrl || "";
    if (!publicUrl) throw new Error("URL pública não gerada.");

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setSelectedLogoFile(null);
    setLogoPreview(publicUrl);
    setField("logo_url", publicUrl);

    return publicUrl;
  };

  const saveCompanyProfile = async () => {
    const logoUrl = await uploadLogo();
    const payload = {
      id: OFFICIAL_PROFILE_ID,
      company_name: companyForm.company_name || "ARXUM",
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

    const { error } = await supabase.from("company_profile").upsert(payload, { onConflict: "id" });
    if (error) throw error;
  };

  const saveSystemPreferences = async () => {
    const payload = {
      id: OFFICIAL_PREFERENCES_ID,
      feature_toggles: preferencesForm.feature_toggles || {},
      custom_labels: preferencesForm.custom_labels || {},
      commercial_documents: preferencesForm.commercial_documents || {},
    };

    const { error } = await supabase.from("system_preferences").upsert(payload, { onConflict: "id" });
    if (error) throw error;
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await saveCompanyProfile();
      await saveSystemPreferences();
      if (refreshSettings) await refreshSettings();
      router.refresh();
      showToast("Configurações salvas com sucesso.", "success");
    } catch (error) {
      showToast(`Erro ao salvar: ${getErrorMessage(error)}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setPreferencesForm((prev) => ({
      ...prev,
      custom_labels: { ...prev.custom_labels, ...preset.labels },
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
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "border-cs-green/20 bg-cs-green/10 text-cs-green"
              : toast.type === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-400"
              : "border-white/10 bg-white/5 text-white"
          }`}
        >
          {toast.type === "success" ? <Check size={18} /> : toast.type === "error" ? <X size={18} /> : <Settings2 size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <Settings2 className="h-5 w-5 text-cs-green" />
              Configurações globais
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Perfil da empresa, módulos, nomenclaturas e documentos comerciais.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-cs-green px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-surface p-3">
          {[
            { id: "perfil", label: "Perfil", icon: Building2 },
            { id: "sistema", label: "Nomenclaturas", icon: Type },
            { id: "modulos", label: "Módulos", icon: LayoutGrid },
            { id: "documentacao", label: "Documentação", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                  isActive ? "bg-cs-green text-white" : "text-text-secondary hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <span className="block text-xs text-text-secondary">Módulos ativos</span>
            <span className="mt-1 block text-lg font-semibold text-white">{activeModulesCount}</span>
          </div>
        </aside>

        <main className="space-y-6">
          {activeTab === "perfil" && (
            <>
              <Panel title="Identidade visual" description="Logo e cores da empresa." icon={Paintbrush}>
                <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-dashed border-white/10 bg-black p-4">
                      <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-background">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo da empresa"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-text-secondary">
                            <Upload className="h-8 w-8" />
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
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                        >
                          {logoPreview ? "Trocar logo" : "Enviar logo"}
                        </button>
                        {logoPreview && (
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/20"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <InputField label="Nome exibido da empresa" value={companyForm.company_name} onChange={(e) => setField("company_name", e.target.value)} />
                    <InputField label="Nome fantasia" value={companyForm.trade_name} onChange={(e) => setField("trade_name", e.target.value)} />
                    <InputField label="Razão social" value={companyForm.legal_name} onChange={(e) => setField("legal_name", e.target.value)} />
                    <InputField label="CNPJ" value={companyForm.cnpj} onChange={masked("cnpj", formatCnpj)} placeholder="00.000.000/0000-00" />
                    <InputField label="E-mail" type="email" value={companyForm.contact_email} onChange={(e) => setField("contact_email", e.target.value)} />
                    <InputField label="Website" value={companyForm.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://..." />
                    <InputField label="Telefone fixo" value={companyForm.phone_landline} onChange={masked("phone_landline", formatPhone)} />
                    <InputField label="Celular" value={companyForm.phone_mobile} onChange={masked("phone_mobile", formatPhone)} />
                    <InputField label="WhatsApp" value={companyForm.whatsapp_number} onChange={masked("whatsapp_number", formatPhone)} />
                    <InputField label="Cor principal" value={companyForm.primary_color} onChange={(e) => setField("primary_color", e.target.value)} />
                  </div>
                </div>
              </Panel>

              <Panel title="Endereço" description="CEP com preenchimento automático." icon={MapPin}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <InputField
                    label={zipcodeLoading ? "CEP (consultando...)" : "CEP"}
                    value={companyForm.zipcode}
                    onChange={handleZipcodeChange}
                  />
                  <div className="xl:col-span-2">
                    <InputField label="Logradouro" value={companyForm.street} onChange={(e) => setField("street", e.target.value)} />
                  </div>
                  <InputField label="Número" value={companyForm.street_number} onChange={(e) => setField("street_number", e.target.value)} />
                  <InputField label="Complemento" value={companyForm.complement} onChange={(e) => setField("complement", e.target.value)} />
                  <InputField label="Bairro" value={companyForm.district} onChange={(e) => setField("district", e.target.value)} />
                  <SelectField label="Estado" value={companyForm.state} onChange={(e) => { setField("state", e.target.value); setField("city", ""); }}>
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
                  <InputField label="País" value={companyForm.country} onChange={(e) => setField("country", e.target.value)} />
                </div>
              </Panel>
            </>
          )}

          {activeTab === "sistema" && (
            <>
              <Panel title="Presets" description="Atalhos por segmento." icon={RefreshCcw}>
                <div className="grid gap-4 md:grid-cols-3">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-3xl border border-white/10 bg-background p-4 text-left transition hover:bg-white/5"
                    >
                      <div className="text-sm font-semibold text-white">{preset.title}</div>
                      <div className="mt-1 text-xs text-text-secondary">Aplicar nomenclaturas.</div>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Nomenclaturas" description="Chaves reais do banco atual." icon={Type}>
                <div className="space-y-6">
                  {LABEL_GROUPS.map((group) => (
                    <div key={group.title} className="rounded-3xl border border-white/10 bg-background p-4">
                      <h3 className="mb-4 text-sm font-semibold text-white">{group.title}</h3>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {group.fields.map((key) => (
                          <InputField
                            key={key}
                            label={LABEL_MAP[key] ?? key}
                            value={preferencesForm.custom_labels[key] || ""}
                            onChange={(e) => setLabelField(key, e.target.value)}
                            placeholder={DEFAULT_CUSTOM_LABELS[key] || ""}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}

          {activeTab === "modulos" && (
            <Panel title="Módulos" description="Todos os módulos reais do sistema." icon={LayoutGrid}>
              <div className="grid gap-4 md:grid-cols-2">
                {FEATURE_MODULES.map((module) => {
                  const active = getBoolean(preferencesForm.feature_toggles[module.key], true);
                  return (
                    <div key={module.key} className="flex items-center justify-between rounded-3xl border border-white/10 bg-background p-4">
                      <div className="pr-4">
                        <h3 className="text-sm font-semibold text-white">{module.title}</h3>
                        <p className="mt-1 text-xs text-text-secondary">{module.desc}</p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFeatureToggle(module.key, !active)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                          active ? "bg-cs-green" : "bg-white/10"
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${active ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {activeTab === "documentacao" && (
            <>
              <Panel title="Visibilidade" description="Campos exibidos nos documentos." icon={FileText}>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { key: "show_logo_on_quotes", label: "Exibir logo nos orçamentos" },
                    { key: "show_company_address_on_quotes", label: "Exibir endereço nos orçamentos" },
                    { key: "show_company_contacts_on_quotes", label: "Exibir contatos nos orçamentos" },
                    { key: "show_signature_on_quotes", label: "Exibir assinatura nos orçamentos" },
                  ].map((item) => {
                    const active = getBoolean(preferencesForm.commercial_documents[item.key], false);
                    return (
                      <div key={item.key} className="flex items-center justify-between rounded-3xl border border-white/10 bg-background p-4">
                        <span className="text-sm font-medium text-white">{item.label}</span>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCommercialField(item.key, !active)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                            active ? "bg-cs-green" : "bg-white/10"
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${active ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="Textos padrão" description="Mensagens e modelos comerciais." icon={FileText}>
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
                    onChange={(e) => setCommercialField("default_proposal_template", e.target.value)}
                  />
                  <TextareaField
                    label="Observações operacionais padrão"
                    rows={3}
                    value={getString(preferencesForm.commercial_documents.default_operational_notes)}
                    onChange={(e) => setCommercialField("default_operational_notes", e.target.value)}
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
              </Panel>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Panel({
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
    <section className="rounded-3xl border border-white/10 bg-surface p-6">
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
    </section>
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