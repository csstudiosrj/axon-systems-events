"use client";

import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  Building2,
  Check,
  FileText,
  LayoutGrid,
  Loader2,
  Save,
  Settings,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";

type SettingsTab = "perfil" | "nomenclaturas" | "modulos" | "documentos";

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
  custom_labels?: CustomLabels | null;
  feature_toggles?: FeatureToggles | null;
  commercial_documents?: CommercialDocuments | null;
}

interface SettingsContextShape {
  companyProfile?: CompanyProfileRecord | null;
  systemPreferences?: SystemPreferencesRecord | null;
  refreshSettings?: () => Promise<void> | void;
}

interface CompanyForm {
  company_name: string;
  cnpj: string;
  logo_url: string;
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
  custom_labels: CustomLabels;
  feature_toggles: FeatureToggles;
  commercial_documents: CommercialDocuments;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
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
  company_name: "",
  cnpj: "",
  logo_url: "",
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
  menu_dashboard: "Visão Geral",
  menu_calendar: "Calendário",
  menu_crm: "CRM / Vendas",
  menu_financial: "Financeiro",
  menu_marketing: "Marketing",
  menu_training: "Treinamentos",
  menu_patients: "Pacientes",
  menu_inventory: "Inventário",
  menu_quotes: "Orçamentos",
  menu_service_orders: "Ordens de Serviço",
  menu_support: "Suporte Técnico",
  menu_team: "Equipe",
  entity_client_singular: "Cliente",
  entity_client_plural: "Clientes",
  entity_lead_singular: "Lead",
  entity_lead_plural: "Leads",
  entity_quote_singular: "Orçamento",
  entity_quote_plural: "Orçamentos",
  entity_proposal_singular: "Proposta",
  entity_proposal_plural: "Propostas",
  entity_contract_singular: "Contrato",
  entity_contract_plural: "Contratos",
  entity_invoice_singular: "Fatura",
  entity_invoice_plural: "Faturas",
  entity_service_order_singular: "Ordem de Serviço",
  entity_service_order_plural: "Ordens de Serviço",
  entity_equipment_singular: "Equipamento",
  entity_equipment_plural: "Equipamentos",
  entity_course_singular: "Curso",
  entity_course_plural: "Cursos",
  entity_lesson_singular: "Aula",
  entity_lesson_plural: "Aulas",
  entity_salesperson_singular: "Responsável Comercial",
  entity_salesperson_plural: "Responsáveis Comerciais",
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

const MODULES = [
  { key: "enable_dashboard", title: "Dashboard", desc: "Visão geral do negócio com métricas." },
  { key: "enable_crm", title: "CRM", desc: "Oportunidades, contatos e funil comercial." },
  { key: "enable_clients", title: "Cadastros", desc: "Registros principais de clientes." },
  { key: "enable_quotes", title: "Orçamentos", desc: "Montagem de propostas e valores." },
  { key: "enable_financial", title: "Financeiro", desc: "Contas, recebimentos e vencimentos." },
  { key: "enable_inventory", title: "Inventário", desc: "Equipamentos e estoque." },
  { key: "enable_service_orders", title: "Ordens de Serviço", desc: "Execução e operação." },
  { key: "enable_marketing", title: "Marketing", desc: "Planejamento de conteúdos." },
  { key: "enable_calendar", title: "Calendário", desc: "Agenda e organização." },
  { key: "enable_team", title: "Equipe", desc: "Acompanhamento de colaboradores." },
  { key: "enable_support", title: "Suporte", desc: "Canal de atendimento técnico." },
  { key: "enable_training", title: "Treinamentos", desc: "Área de cursos e aulas." },
  { key: "enable_client_portal", title: "Portal do Cliente", desc: "Área exclusiva para o cliente." },
] as const;

const LABEL_GROUPS: Array<{ title: string; fields: string[] }> = [
  {
    title: "Menus principais",
    fields: [
      "menu_dashboard",
      "menu_calendar",
      "menu_crm",
      "menu_financial",
      "menu_marketing",
      "menu_training",
      "menu_patients",
      "menu_inventory",
      "menu_quotes",
      "menu_service_orders",
      "menu_support",
      "menu_team",
    ],
  },
  {
    title: "Cadastros e relacionamento",
    fields: [
      "entity_client_singular",
      "entity_client_plural",
      "entity_lead_singular",
      "entity_lead_plural",
      "entity_salesperson_singular",
      "entity_salesperson_plural",
    ],
  },
  {
    title: "Comercial e documentos",
    fields: [
      "entity_quote_singular",
      "entity_quote_plural",
      "entity_proposal_singular",
      "entity_proposal_plural",
      "entity_contract_singular",
      "entity_contract_plural",
      "entity_invoice_singular",
      "entity_invoice_plural",
    ],
  },
  {
    title: "Operação e ensino",
    fields: [
      "entity_service_order_singular",
      "entity_service_order_plural",
      "entity_equipment_singular",
      "entity_equipment_plural",
      "entity_course_singular",
      "entity_course_plural",
      "entity_lesson_singular",
      "entity_lesson_plural",
    ],
  },
];

const LABEL_MAP: Record<string, string> = {
  menu_dashboard: "Menu: Visão Geral",
  menu_calendar: "Menu: Calendário",
  menu_crm: "Menu: CRM / Vendas",
  menu_financial: "Menu: Financeiro",
  menu_marketing: "Menu: Marketing",
  menu_training: "Menu: Treinamentos",
  menu_patients: "Menu: Pacientes",
  menu_inventory: "Menu: Inventário",
  menu_quotes: "Menu: Orçamentos",
  menu_service_orders: "Menu: Ordens de Serviço",
  menu_support: "Menu: Suporte Técnico",
  menu_team: "Menu: Equipe",
  entity_client_singular: "Cliente (singular)",
  entity_client_plural: "Cliente (plural)",
  entity_lead_singular: "Lead (singular)",
  entity_lead_plural: "Lead (plural)",
  entity_quote_singular: "Orçamento (singular)",
  entity_quote_plural: "Orçamento (plural)",
  entity_proposal_singular: "Proposta (singular)",
  entity_proposal_plural: "Proposta (plural)",
  entity_contract_singular: "Contrato (singular)",
  entity_contract_plural: "Contrato (plural)",
  entity_invoice_singular: "Fatura (singular)",
  entity_invoice_plural: "Fatura (plural)",
  entity_service_order_singular: "Ordem de Serviço (singular)",
  entity_service_order_plural: "Ordem de Serviço (plural)",
  entity_equipment_singular: "Equipamento (singular)",
  entity_equipment_plural: "Equipamento (plural)",
  entity_course_singular: "Curso (singular)",
  entity_course_plural: "Curso (plural)",
  entity_lesson_singular: "Aula (singular)",
  entity_lesson_plural: "Aula (plural)",
  entity_salesperson_singular: "Responsável Comercial (singular)",
  entity_salesperson_plural: "Responsáveis Comerciais (plural)",
};

const NOMENCLATURE_PRESETS: Array<{
  title: string;
  options: Array<{ label: string; values: Record<string, string> }>;
}> = [
  {
    title: "CRM / Serviços",
    options: [
      {
        label: "Empresarial padrão",
        values: {
          menu_quotes: "Orçamentos",
          menu_service_orders: "Ordens de Serviço",
          entity_quote_singular: "Orçamento",
          entity_quote_plural: "Orçamentos",
          entity_client_singular: "Cliente",
          entity_client_plural: "Clientes",
          entity_salesperson_singular: "Vendedor",
          entity_salesperson_plural: "Vendedores",
        },
      },
      {
        label: "Consultivo / Saúde",
        values: {
          menu_quotes: "Consultas",
          menu_patients: "Pacientes",
          entity_quote_singular: "Consulta",
          entity_quote_plural: "Consultas",
          entity_client_singular: "Paciente",
          entity_client_plural: "Pacientes",
          entity_salesperson_singular: "Consultor",
          entity_salesperson_plural: "Consultores",
        },
      },
    ],
  },
  {
    title: "Eventos / Produção",
    options: [
      {
        label: "Eventos corporativos",
        values: {
          menu_quotes: "Propostas",
          menu_inventory: "Estruturas",
          menu_service_orders: "Operações",
          entity_quote_singular: "Proposta",
          entity_quote_plural: "Propostas",
          entity_service_order_singular: "Operação",
          entity_service_order_plural: "Operações",
          entity_equipment_singular: "Estrutura",
          entity_equipment_plural: "Estruturas",
        },
      },
      {
        label: "Produção cultural",
        values: {
          menu_quotes: "Projetos",
          menu_service_orders: "Produções",
          entity_quote_singular: "Projeto",
          entity_quote_plural: "Projetos",
          entity_service_order_singular: "Produção",
          entity_service_order_plural: "Produções",
          entity_salesperson_singular: "Produtor",
          entity_salesperson_plural: "Produtores",
        },
      },
    ],
  },
  {
    title: "Educação / Treinamento",
    options: [
      {
        label: "EAD / Escola",
        values: {
          menu_quotes: "Matrículas",
          menu_training: "Cursos",
          entity_quote_singular: "Matrícula",
          entity_quote_plural: "Matrículas",
          entity_client_singular: "Aluno",
          entity_client_plural: "Alunos",
          entity_salesperson_singular: "Tutor",
          entity_salesperson_plural: "Tutores",
          entity_course_singular: "Curso",
          entity_course_plural: "Cursos",
          entity_lesson_singular: "Aula",
          entity_lesson_plural: "Aulas",
        },
      },
    ],
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
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
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
  const { companyProfile, systemPreferences, refreshSettings } = useSettings() as SettingsContextShape;

  const [activeTab, setActiveTab] = useState<SettingsTab>("perfil");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(DEFAULT_COMPANY_FORM);
  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    custom_labels: { ...DEFAULT_CUSTOM_LABELS },
    feature_toggles: { ...DEFAULT_FEATURE_TOGGLES },
    commercial_documents: { ...DEFAULT_COMMERCIAL_DOCUMENTS },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [states, setStates] = useState<IbgeState[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const companyBase: CompanyForm = {
      ...DEFAULT_COMPANY_FORM,
      company_name: getString(companyProfile?.company_name),
      cnpj: getString(companyProfile?.cnpj),
      logo_url: getString(companyProfile?.logo_url),
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

    setCompanyForm(companyBase);
    setLogoPreview(getString(companyProfile?.logo_url));

    setPreferencesForm({
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
    });
  }, [companyProfile, systemPreferences]);

  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados")
      .then((r) => r.json())
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
      .then((r) => r.json())
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

  const showToast = (message: string, type: ToastState["type"]) => {
    setToast({ message, type });
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 4000);
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

  const masked = (field: keyof CompanyForm, fmt: (v: string) => string) => {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setField(field, fmt(e.target.value) as CompanyForm[keyof CompanyForm]);
  };

  const applyPreset = (values: Record<string, string>) => {
    setPreferencesForm((prev) => ({
      ...prev,
      custom_labels: {
        ...prev.custom_labels,
        ...values,
      },
    }));
    showToast("Preset aplicado.", "info");
  };

  const handleZipcodeChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setField("zipcode", formatted);

    const digits = onlyDigits(formatted);
    if (digits.length !== 8) return;

    try {
      setCepLoading(true);
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
    } catch {
      showToast("Não foi possível consultar o CEP.", "error");
    } finally {
      setCepLoading(false);
    }
  };

  const selectLogo = (file?: File | null) => {
    if (!file) return;

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setSelectedLogoFile(file);
    setLogoPreview(url);
    showToast("Logo selecionada. Salve para concluir o upload.", "info");
  };

  const removeLogo = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedLogoFile(null);
    setLogoPreview("");
    setField("logo_url", "");
  };

  const uploadLogo = async (): Promise<string> => {
    if (!selectedLogoFile) return companyForm.logo_url || "";

    const extension = selectedLogoFile.name.split(".").pop()?.toLowerCase() || "png";
    const safeName = sanitizeFileName(selectedLogoFile.name.replace(/\.[^.]+$/, "") || "logo");
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

    if (!publicUrl) throw new Error("URL pública não gerada.");

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setSelectedLogoFile(null);
    setLogoPreview(publicUrl);
    setField("logo_url", publicUrl);
    return publicUrl;
  };

  const saveCompanyProfileRecord = async () => {
    const logoUrl = await uploadLogo();

    const payload = {
      company_name: companyForm.company_name || "",
      cnpj: companyForm.cnpj || "",
      logo_url: logoUrl || "",
      primary_color: getString(companyProfile?.primary_color, "#138946") || "#138946",
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

    if (companyProfile?.id) {
      const { error } = await supabase.from("company_profile").update(payload).eq("id", companyProfile.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("company_profile").insert(payload);
    if (error) throw error;
  };

  const savePreferencesRecord = async () => {
    const payload = {
      custom_labels: preferencesForm.custom_labels || {},
      feature_toggles: preferencesForm.feature_toggles || {},
      commercial_documents: preferencesForm.commercial_documents || {},
    };

    if (systemPreferences?.id) {
      const { error } = await supabase.from("system_preferences").update(payload).eq("id", systemPreferences.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("system_preferences").insert(payload);
    if (error) throw error;
  };

  const savePerfil = async () => {
    setIsSubmitting(true);
    try {
      await saveCompanyProfileRecord();
      await refreshSettings?.();
      showToast("Perfil corporativo salvo com sucesso.", "success");
    } catch (error) {
      showToast(`Erro ao salvar perfil: ${getErrorMessage(error)}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveNomenclaturas = async () => {
    setIsSubmitting(true);
    try {
      await savePreferencesRecord();
      await refreshSettings?.();
      showToast("Nomenclaturas salvas com sucesso.", "success");
    } catch (error) {
      showToast(`Erro ao salvar nomenclaturas: ${getErrorMessage(error)}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveModulos = async () => {
    setIsSubmitting(true);
    try {
      await savePreferencesRecord();
      await refreshSettings?.();
      showToast("Módulos salvos com sucesso.", "success");
    } catch (error) {
      showToast(`Erro ao salvar módulos: ${getErrorMessage(error)}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveDocumentos = async () => {
    setIsSubmitting(true);
    try {
      await saveCompanyProfileRecord();
      await savePreferencesRecord();
      await refreshSettings?.();
      showToast("Documentos comerciais salvos com sucesso.", "success");
    } catch (error) {
      showToast(`Erro ao salvar documentos: ${getErrorMessage(error)}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    if (activeTab === "perfil") {
      void savePerfil();
      return;
    }
    if (activeTab === "nomenclaturas") {
      void saveNomenclaturas();
      return;
    }
    if (activeTab === "modulos") {
      void saveModulos();
      return;
    }
    void saveDocumentos();
  };

  return (
    <div className="relative mx-auto max-w-6xl space-y-6 pb-12">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-md border px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "border-cs-green/20 bg-cs-green/10 text-cs-green"
              : toast.type === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-500"
              : "border-blue-500/20 bg-blue-500/10 text-blue-400"
          }`}
        >
          {toast.type === "success" ? <Check size={18} /> : toast.type === "error" ? <X size={18} /> : <Settings size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-surface/50 bg-surface p-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-medium text-white">
            <Settings className="text-cs-green" size={20} />
            Configurações Globais
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            Gerencie o perfil da empresa, módulos ativos e nomenclaturas do sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-md bg-cs-green px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Salvar Alterações
        </button>
      </div>

      <div className="custom-scrollbar flex gap-2 overflow-x-auto border-b border-surface/50 pb-4">
        {[
          { id: "perfil", label: "Perfil Corporativo", icon: Building2 },
          { id: "nomenclaturas", label: "Nomenclaturas", icon: Type },
          { id: "modulos", label: "Módulos", icon: LayoutGrid },
          { id: "documentos", label: "Documentos Comerciais", icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as SettingsTab)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-cs-green/20 bg-cs-green/10 text-cs-green"
                : "border-transparent text-text-secondary hover:bg-surface hover:text-white"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-surface/50 bg-surface p-6">
        {activeTab === "perfil" && (
          <div className="space-y-8">
            <div>
              <h4 className="mb-4 flex items-center gap-2 border-b border-surface/50 pb-2 text-sm font-bold text-white">
                <Building2 size={16} className="text-cs-gold" />
                Identidade Visual
              </h4>

              <div className="flex flex-col items-start gap-6 md:flex-row">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-surface/50 bg-background">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo da empresa" className="h-full w-full object-contain" />
                    ) : (
                      <span className="px-4 text-center text-xs text-text-secondary">Nenhuma logo</span>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => selectLogo(e.target.files?.[0] ?? null)}
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 rounded border border-surface/50 bg-surface px-3 py-1.5 text-xs text-white transition-colors hover:bg-background"
                    >
                      <Upload size={14} />
                      {logoPreview ? "Editar logo" : "Enviar logo"}
                    </button>

                    {logoPreview && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/20"
                      >
                        <Trash2 size={14} />
                        Remover
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full flex-1" />
              </div>
            </div>

            <div>
              <h4 className="mb-4 flex items-center gap-2 border-b border-surface/50 pb-2 text-sm font-bold text-white">
                <Building2 size={16} className="text-cs-green" />
                Dados da Empresa
              </h4>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <InputField label="Nome exibido da empresa" value={companyForm.company_name} onChange={(e) => setField("company_name", e.target.value)} />
                <InputField label="Nome Fantasia" value={companyForm.trade_name} onChange={(e) => setField("trade_name", e.target.value)} />
                <InputField label="Razão Social" value={companyForm.legal_name} onChange={(e) => setField("legal_name", e.target.value)} />
                <InputField label="CNPJ" value={companyForm.cnpj} onChange={masked("cnpj", formatCnpj)} placeholder="00.000.000/0000-00" />
                <InputField label="E-mail de Contato" type="email" value={companyForm.contact_email} onChange={(e) => setField("contact_email", e.target.value)} />
                <InputField label="Telefone Fixo" value={companyForm.phone_landline} onChange={masked("phone_landline", formatPhone)} />
                <InputField label="Celular" value={companyForm.phone_mobile} onChange={masked("phone_mobile", formatPhone)} />
                <InputField label="WhatsApp" value={companyForm.whatsapp_number} onChange={masked("whatsapp_number", formatPhone)} />
                <InputField label="Website" value={companyForm.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <div>
              <h4 className="mb-4 border-b border-surface/50 pb-2 text-sm font-bold text-white">Endereço</h4>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <InputField
                  label={cepLoading ? "CEP (consultando...)" : "CEP"}
                  value={companyForm.zipcode}
                  onChange={handleZipcodeChange}
                />

                <div className="lg:col-span-2">
                  <InputField label="Logradouro" value={companyForm.street} onChange={(e) => setField("street", e.target.value)} />
                </div>

                <InputField label="Número" value={companyForm.street_number} onChange={(e) => setField("street_number", e.target.value)} />
                <InputField label="Complemento" value={companyForm.complement} onChange={(e) => setField("complement", e.target.value)} />
                <InputField label="Bairro" value={companyForm.district} onChange={(e) => setField("district", e.target.value)} />

                <SelectField
                  label="Estado"
                  value={companyForm.state}
                  onChange={(e) => {
                    setField("state", e.target.value);
                    setField("city", "");
                  }}
                >
                  <option value="">Selecione</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.sigla}>
                      {s.nome} ({s.sigla})
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label={loadingCities ? "Cidade (carregando...)" : "Cidade"}
                  value={companyForm.city}
                  onChange={(e) => setField("city", e.target.value)}
                  disabled={!companyForm.state || loadingCities}
                >
                  <option value="">Selecione</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.nome}>
                      {c.nome}
                    </option>
                  ))}
                </SelectField>

                <InputField label="País" value={companyForm.country} onChange={(e) => setField("country", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "nomenclaturas" && (
          <div className="space-y-8">
            <div className="space-y-4">
              {NOMENCLATURE_PRESETS.map((group) => (
                <div key={group.title} className="rounded-lg border border-surface/50 bg-background p-4">
                  <p className="mb-3 text-sm font-semibold text-white">{group.title}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => applyPreset(option.values)}
                        className="rounded-md border border-cs-green/20 bg-cs-green/10 px-3 py-2 text-xs font-medium text-cs-green transition hover:bg-cs-green/20"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              {LABEL_GROUPS.map((group) => (
                <div key={group.title} className="rounded-lg border border-surface/50 bg-background p-4">
                  <h4 className="mb-4 text-sm font-bold text-white">{group.title}</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.fields.map((key) => (
                      <InputField
                        key={key}
                        label={LABEL_MAP[key] ?? key}
                        value={preferencesForm.custom_labels[key] || ""}
                        onChange={(e) => setLabelField(key, e.target.value)}
                        placeholder={DEFAULT_CUSTOM_LABELS[key]}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "modulos" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {MODULES.map((mod) => {
              const isActive = preferencesForm.feature_toggles[mod.key] ?? true;
              return (
                <div key={mod.key} className="flex items-center justify-between rounded-lg border border-surface/50 bg-background p-4">
                  <div>
                    <h5 className="text-sm font-bold text-white">{mod.title}</h5>
                    <p className="mt-0.5 text-xs text-text-secondary">{mod.desc}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFeatureToggle(mod.key, !isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isActive ? "bg-cs-green" : "bg-surface"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "documentos" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { key: "show_logo_on_quotes", label: "Exibir Logo nos Orçamentos" },
                { key: "show_company_address_on_quotes", label: "Exibir Endereço nos Orçamentos" },
                { key: "show_company_contacts_on_quotes", label: "Exibir Contatos nos Orçamentos" },
                { key: "show_signature_on_quotes", label: "Exibir Campo de Assinatura" },
              ].map((toggle) => {
                const isActive = getBoolean(preferencesForm.commercial_documents[toggle.key], false);
                return (
                  <div key={toggle.key} className="flex items-center justify-between rounded-lg border border-surface/50 bg-background p-4">
                    <span className="text-sm font-medium text-white">{toggle.label}</span>
                    <button
                      type="button"
                      onClick={() => setCommercialField(toggle.key, !isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isActive ? "bg-cs-green" : "bg-surface"
                      }`}
                      aria-pressed={isActive}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          isActive ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              <TextareaField
                label="Texto de Abertura Padrão (Orçamentos)"
                rows={3}
                value={getString(preferencesForm.commercial_documents.quote_intro_text)}
                onChange={(e) => setCommercialField("quote_intro_text", e.target.value)}
              />

              <TextareaField
                label="Termos e Condições Padrão (Orçamentos)"
                rows={4}
                value={getString(preferencesForm.commercial_documents.quote_terms_text)}
                onChange={(e) => setCommercialField("quote_terms_text", e.target.value)}
              />

              <TextareaField
                label="Cláusulas Contratuais Padrão"
                rows={5}
                value={companyForm.contract_terms}
                onChange={(e) => setField("contract_terms", e.target.value)}
              />

              <TextareaField
                label="Modelo de Proposta"
                rows={4}
                value={getString(preferencesForm.commercial_documents.default_proposal_template)}
                onChange={(e) => setCommercialField("default_proposal_template", e.target.value)}
              />

              <TextareaField
                label="Observações Operacionais Padrão"
                rows={3}
                value={getString(preferencesForm.commercial_documents.default_operational_notes)}
                onChange={(e) => setCommercialField("default_operational_notes", e.target.value)}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextareaField
                  label="Rodapé de Propostas (PDF)"
                  rows={2}
                  value={companyForm.proposal_footer}
                  onChange={(e) => setField("proposal_footer", e.target.value)}
                />

                <TextareaField
                  label="Rodapé de Faturas (PDF)"
                  rows={2}
                  value={companyForm.invoice_footer}
                  onChange={(e) => setField("invoice_footer", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
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
      <label className="mb-1 block text-xs font-medium text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
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
      <label className="mb-1 block text-xs font-medium text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="block w-full cursor-pointer rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none disabled:opacity-50"
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
      <label className="mb-1 block text-xs font-medium text-text-secondary">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={onChange}
        className="block w-full resize-none rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
      />
    </div>
  );
}