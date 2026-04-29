"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";

type SettingsTab = "perfil-corporativo" | "nomenclaturas" | "modulos" | "documentos";

type CompanyProfilePayload = {
  company_name: string;
  cnpj: string;
  logo_url: string;
  primary_color: string;
  contract_terms: string;
};

type CompanyForm = CompanyProfilePayload & {
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
};

type CustomLabels = Record<string, string>;
type FeatureToggles = Record<string, boolean>;
type CommercialDocuments = Record<string, string | boolean>;

type PreferencesForm = {
  custom_labels: CustomLabels;
  feature_toggles: FeatureToggles;
  commercial_documents: CommercialDocuments;
};

type SettingsContextShape = {
  companyProfile?: {
    id?: string | number;
    company_name?: string | null;
    cnpj?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
    contract_terms?: string | null;
  } | null;
  systemPreferences?: {
    id?: string | number;
    custom_labels?: CustomLabels | null;
    feature_toggles?: FeatureToggles | null;
    commercial_documents?: CommercialDocuments | null;
  } | null;
  refreshSettings?: () => Promise<void> | void;
};

type IbgeState = {
  id: number;
  nome: string;
  sigla: string;
};

type IbgeCity = {
  id: number;
  nome: string;
};

type PresetGroup = {
  title: string;
  options: Array<{
    label: string;
    values: Record<string, string>;
  }>;
};

const DEFAULT_COMPANY_FORM: CompanyForm = {
  company_name: "",
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
  menu_dashboard: "Visão Geral",
  menu_calendar: "Calendário",
  menu_crm: "CRM / Vendas",
  menu_financial: "Financeiro",
  menu_marketing: "Marketing",
  menu_training: "Treinamentos",
  menu_patients: "Pacientes",
  menu_inventory: "Inventário",
  menu_quotes: "Consultas",
  menu_service_orders: "Ordens de Serviço",
  menu_support: "Suporte Técnico",
  menu_team: "Equipe",
  entity_client_singular: "Cliente",
  entity_client_plural: "Clientes",
  entity_lead_singular: "Lead",
  entity_lead_plural: "Leads",
  entity_quote_singular: "Consulta",
  entity_quote_plural: "Consultas",
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
  company_legal_name: "",
  company_trade_name: "",
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

const TAB_OPTIONS: Array<{ key: SettingsTab; label: string }> = [
  { key: "perfil-corporativo", label: "Perfil Corporativo" },
  { key: "nomenclaturas", label: "Nomenclaturas" },
  { key: "modulos", label: "Módulos" },
  { key: "documentos", label: "Documentos Comerciais" },
];

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

const NOMENCLATURE_PRESETS: PresetGroup[] = [
  {
    title: "Pacote clássico CRM / serviços",
    options: [
      {
        label: "Padrão empresarial",
        values: {
          menu_dashboard: "Visão Geral",
          menu_crm: "CRM / Vendas",
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
        label: "Padrão consultivo",
        values: {
          menu_quotes: "Consultas",
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
    title: "Pacote eventos / produção",
    options: [
      {
        label: "Eventos corporativos",
        values: {
          menu_quotes: "Propostas",
          menu_inventory: "Estruturas",
          entity_quote_singular: "Proposta",
          entity_quote_plural: "Propostas",
          entity_service_order_singular: "Operação",
          entity_service_order_plural: "Operações",
          entity_equipment_singular: "Estrutura",
          entity_equipment_plural: "Estruturas",
        },
      },
      {
        label: "Eventos culturais",
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
];

const MODULES = [
  { key: "enable_dashboard", title: "Dashboard", description: "Mostra a visão geral do negócio com números, atalhos e acompanhamento diário." },
  { key: "enable_crm", title: "CRM", description: "Organiza oportunidades, contatos e andamento comercial em um só lugar." },
  { key: "enable_clients", title: "Cadastros", description: "Controla os registros principais de clientes, alunos ou empresas atendidas." },
  { key: "enable_quotes", title: "Orçamentos / Consultas", description: "Permite montar propostas, valores, condições e enviar documentos comerciais." },
  { key: "enable_financial", title: "Financeiro", description: "Centraliza contas, recebimentos, vencimentos e acompanhamento financeiro." },
  { key: "enable_inventory", title: "Inventário", description: "Gerencia itens, equipamentos, estoque e disponibilidade operacional." },
  { key: "enable_service_orders", title: "Ordens de Serviço", description: "Controla execução de serviços, itens extras, status e operação do dia a dia." },
  { key: "enable_marketing", title: "Marketing", description: "Ajuda a planejar e organizar conteúdos, campanhas e publicações." },
  { key: "enable_calendar", title: "Calendário", description: "Exibe agenda, datas importantes e organização das atividades." },
  { key: "enable_team", title: "Equipe", description: "Reúne as informações da equipe e o acompanhamento das pessoas envolvidas." },
  { key: "enable_support", title: "Suporte", description: "Mantém o canal de atendimento e acompanhamento das solicitações." },
  { key: "enable_training", title: "Treinamentos", description: "Libera a área de cursos, aulas e acompanhamento de aprendizagem." },
  { key: "enable_client_portal", title: "Portal do Cliente", description: "Entrega uma área exclusiva para o cliente acompanhar informações e documentos." },
] as const;

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
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getLabelTitle(key: string) {
  const customMap: Record<string, string> = {
    menu_dashboard: "Menu: Visão Geral",
    menu_calendar: "Menu: Calendário",
    menu_crm: "Menu: CRM / Vendas",
    menu_financial: "Menu: Financeiro",
    menu_marketing: "Menu: Marketing",
    menu_training: "Menu: Treinamentos",
    menu_patients: "Menu: Pacientes",
    menu_inventory: "Menu: Inventário",
    menu_quotes: "Menu: Orçamentos / Consultas",
    menu_service_orders: "Menu: Ordens de Serviço",
    menu_support: "Menu: Suporte Técnico",
    menu_team: "Menu: Equipe",
    entity_client_singular: "Entidade: Cliente (singular)",
    entity_client_plural: "Entidade: Cliente (plural)",
    entity_lead_singular: "Entidade: Lead (singular)",
    entity_lead_plural: "Entidade: Lead (plural)",
    entity_quote_singular: "Entidade: Orçamento / Consulta (singular)",
    entity_quote_plural: "Entidade: Orçamento / Consulta (plural)",
    entity_proposal_singular: "Entidade: Proposta (singular)",
    entity_proposal_plural: "Entidade: Proposta (plural)",
    entity_contract_singular: "Entidade: Contrato (singular)",
    entity_contract_plural: "Entidade: Contrato (plural)",
    entity_invoice_singular: "Entidade: Fatura (singular)",
    entity_invoice_plural: "Entidade: Fatura (plural)",
    entity_service_order_singular: "Entidade: Ordem de Serviço (singular)",
    entity_service_order_plural: "Entidade: Ordem de Serviço (plural)",
    entity_equipment_singular: "Entidade: Equipamento (singular)",
    entity_equipment_plural: "Entidade: Equipamento (plural)",
    entity_course_singular: "Entidade: Curso (singular)",
    entity_course_plural: "Entidade: Curso (plural)",
    entity_lesson_singular: "Entidade: Aula (singular)",
    entity_lesson_plural: "Entidade: Aula (plural)",
    entity_salesperson_singular: "Entidade: Responsável comercial (singular)",
    entity_salesperson_plural: "Entidade: Responsável comercial (plural)",
  };

  return customMap[key] ?? key;
}

function buildCommercialDocumentsFromForm(form: CompanyForm, current: CommercialDocuments): CommercialDocuments {
  return {
    ...current,
    company_legal_name: form.legal_name,
    company_trade_name: form.trade_name,
    website: form.website,
    contact_email: form.contact_email,
    phone_landline: form.phone_landline,
    phone_mobile: form.phone_mobile,
    whatsapp_number: form.whatsapp_number,
    zipcode: form.zipcode,
    street: form.street,
    street_number: form.street_number,
    complement: form.complement,
    district: form.district,
    city: form.city,
    state: form.state,
    country: form.country,
    proposal_footer: form.proposal_footer,
    invoice_footer: form.invoice_footer,
  };
}

function mergeClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ConfiguracoesPage() {
  const { companyProfile, systemPreferences, refreshSettings } = useSettings() as SettingsContextShape;

  const [activeTab, setActiveTab] = useState<SettingsTab>("perfil-corporativo");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(DEFAULT_COMPANY_FORM);
  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    custom_labels: { ...DEFAULT_CUSTOM_LABELS },
    feature_toggles: { ...DEFAULT_FEATURE_TOGGLES },
    commercial_documents: { ...DEFAULT_COMMERCIAL_DOCUMENTS },
  });
  const [savingTab, setSavingTab] = useState<SettingsTab | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropSize, setCropSize] = useState(320);
  const [states, setStates] = useState<IbgeState[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const primaryColor = useMemo(() => companyForm.primary_color || "#138946", [companyForm.primary_color]);
  const canSaveLogoEdit = useMemo(() => Boolean(selectedLogoFile), [selectedLogoFile]);

  useEffect(() => {
    const commercialDocuments = {
      ...DEFAULT_COMMERCIAL_DOCUMENTS,
      ...(systemPreferences?.commercial_documents ?? {}),
    };

    setCompanyForm({
      ...DEFAULT_COMPANY_FORM,
      company_name: companyProfile?.company_name ?? "",
      cnpj: companyProfile?.cnpj ?? "",
      logo_url: companyProfile?.logo_url ?? "",
      primary_color: companyProfile?.primary_color ?? DEFAULT_COMPANY_FORM.primary_color,
      contract_terms: companyProfile?.contract_terms ?? "",
      legal_name: String(commercialDocuments.company_legal_name ?? ""),
      trade_name: String(commercialDocuments.company_trade_name ?? ""),
      website: String(commercialDocuments.website ?? ""),
      contact_email: String(commercialDocuments.contact_email ?? ""),
      phone_landline: String(commercialDocuments.phone_landline ?? ""),
      phone_mobile: String(commercialDocuments.phone_mobile ?? ""),
      whatsapp_number: String(commercialDocuments.whatsapp_number ?? ""),
      zipcode: String(commercialDocuments.zipcode ?? ""),
      street: String(commercialDocuments.street ?? ""),
      street_number: String(commercialDocuments.street_number ?? ""),
      complement: String(commercialDocuments.complement ?? ""),
      district: String(commercialDocuments.district ?? ""),
      city: String(commercialDocuments.city ?? ""),
      state: String(commercialDocuments.state ?? ""),
      country: String(commercialDocuments.country ?? "Brasil"),
      proposal_footer: String(commercialDocuments.proposal_footer ?? ""),
      invoice_footer: String(commercialDocuments.invoice_footer ?? ""),
    });

    setPreferencesForm({
      custom_labels: {
        ...DEFAULT_CUSTOM_LABELS,
        ...(systemPreferences?.custom_labels ?? {}),
      },
      feature_toggles: {
        ...DEFAULT_FEATURE_TOGGLES,
        ...(systemPreferences?.feature_toggles ?? {}),
      },
      commercial_documents: commercialDocuments,
    });

    setLogoPreview(companyProfile?.logo_url ?? "");
  }, [companyProfile, systemPreferences]);

  useEffect(() => {
    async function loadStates() {
      setLoadingStates(true);
      try {
        const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados");
        if (!response.ok) throw new Error("Falha ao carregar estados.");
        const data = (await response.json()) as IbgeState[];
        setStates([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      } catch {
        setStates([]);
      } finally {
        setLoadingStates(false);
      }
    }

    void loadStates();
  }, []);

  useEffect(() => {
    const state = companyForm.state.trim().toUpperCase();
    if (!state || state.length !== 2) {
      setCities([]);
      return;
    }

    async function loadCities() {
      setLoadingCities(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`);
        if (!response.ok) throw new Error("Falha ao carregar municípios.");
        const data = (await response.json()) as IbgeCity[];
        setCities([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      } catch {
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    }

    void loadCities();
  }, [companyForm.state]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function setStatus(message: string, type: "success" | "error" | "info") {
    setFeedback({ message, type });
  }

  function updateCompanyField<K extends keyof CompanyForm>(field: K, value: CompanyForm[K]) {
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateLabelField(key: string, value: string) {
    setPreferencesForm((prev) => ({
      ...prev,
      custom_labels: {
        ...prev.custom_labels,
        [key]: value,
      },
    }));
  }

  function updateFeatureToggle(key: string, value: boolean) {
    setPreferencesForm((prev) => ({
      ...prev,
      feature_toggles: {
        ...prev.feature_toggles,
        [key]: value,
      },
    }));
  }

  function updateCommercialDocField(key: string, value: string | boolean) {
    setPreferencesForm((prev) => ({
      ...prev,
      commercial_documents: {
        ...prev.commercial_documents,
        [key]: value,
      },
    }));
  }

  function handleMaskedInput(field: keyof CompanyForm, formatter: (value: string) => string) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      updateCompanyField(field, formatter(event.target.value) as CompanyForm[keyof CompanyForm]);
    };
  }

  function applyPreset(values: Record<string, string>) {
    setPreferencesForm((prev) => ({
      ...prev,
      custom_labels: {
        ...prev.custom_labels,
        ...values,
      },
    }));
    setStatus("Preset aplicado. Revise os rótulos e salve a aba de nomenclaturas.", "info");
  }

  function handleSelectLogo(file?: File | null) {
    if (!file) return;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setSelectedLogoFile(file);
    setLogoPreview(objectUrl);
    setStatus("Nova logo selecionada. Salve o perfil corporativo para concluir o upload.", "info");
  }

  function removeLogo() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setSelectedLogoFile(null);
    setLogoPreview("");
    updateCompanyField("logo_url", "");
    setStatus("Logo removida localmente. Salve o perfil para persistir.", "info");
  }

  async function uploadProcessedLogo() {
    if (!selectedLogoFile) return companyForm.logo_url;

    setUploadingLogo(true);
    try {
      const tempUrl = URL.createObjectURL(selectedLogoFile);
      const image = document.createElement("img");
      image.src = tempUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Falha ao ler imagem da logo."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = cropSize;
      canvas.height = cropSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a logo.");

      const shortestSide = Math.min(image.width, image.height);
      const sourceSize = shortestSide / cropScale;
      const sourceX = (image.width - sourceSize) / 2;
      const sourceY = (image.height - sourceSize) / 2;

      context.clearRect(0, 0, cropSize, cropSize);
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, cropSize, cropSize);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      URL.revokeObjectURL(tempUrl);
      if (!blob) throw new Error("Falha ao gerar arquivo final da logo.");

      const safeName = sanitizeFileName(selectedLogoFile.name.replace(/\.[^.]+$/, "") || "logo");
      const filePath = `logos/${Date.now()}-${safeName}.png`;

      const { error: uploadError } = await supabase.storage.from("axon-assets").upload(filePath, blob, {
        contentType: "image/png",
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      if (!publicUrl) throw new Error("Falha ao gerar URL pública da logo.");

      setSelectedLogoFile(null);
      setLogoPreview(publicUrl);
      updateCompanyField("logo_url", publicUrl);
      return publicUrl;
    } finally {
      setUploadingLogo(false);
    }
  }

  async function upsertSystemPreferences(payload: PreferencesForm) {
    const currentId = systemPreferences?.id;
    const query = currentId
      ? supabase.from("system_preferences").update(payload).eq("id", currentId)
      : supabase.from("system_preferences").insert(payload);

    const { error } = await query;
    if (error) throw error;
  }

  async function saveCompanyTab() {
    setSavingTab("perfil-corporativo");
    setStatus("Salvando perfil corporativo...", "info");

    try {
      const logoUrl = await uploadProcessedLogo();
      const companyPayload: CompanyProfilePayload = {
        company_name: companyForm.company_name.trim(),
        cnpj: formatCnpj(companyForm.cnpj),
        logo_url: logoUrl,
        primary_color: primaryColor,
        contract_terms: companyForm.contract_terms,
      };

      const currentId = companyProfile?.id;
      const companyQuery = currentId
        ? supabase.from("company_profile").update(companyPayload).eq("id", currentId)
        : supabase.from("company_profile").insert(companyPayload);

      const { error: companyError } = await companyQuery;
      if (companyError) throw companyError;

      const preferencesPayload: PreferencesForm = {
        ...preferencesForm,
        commercial_documents: buildCommercialDocumentsFromForm(companyForm, preferencesForm.commercial_documents),
      };

      await upsertSystemPreferences(preferencesPayload);
      await refreshSettings?.();
      setStatus("Perfil corporativo salvo com sucesso.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar perfil corporativo.", "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveLabelsTab() {
    setSavingTab("nomenclaturas");
    setStatus("Salvando nomenclaturas...", "info");

    try {
      await upsertSystemPreferences(preferencesForm);
      await refreshSettings?.();
      setStatus("Nomenclaturas salvas com sucesso.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar nomenclaturas.", "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveModulesTab() {
    setSavingTab("modulos");
    setStatus("Salvando módulos...", "info");

    try {
      await upsertSystemPreferences(preferencesForm);
      await refreshSettings?.();
      setStatus("Módulos salvos com sucesso.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar módulos.", "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveDocumentsTab() {
    setSavingTab("documentos");
    setStatus("Salvando documentos comerciais...", "info");

    try {
      const currentId = companyProfile?.id;
      const companyQuery = currentId
        ? supabase.from("company_profile").update({ contract_terms: companyForm.contract_terms }).eq("id", currentId)
        : supabase.from("company_profile").insert({
            company_name: companyForm.company_name.trim(),
            cnpj: formatCnpj(companyForm.cnpj),
            logo_url: companyForm.logo_url,
            primary_color: primaryColor,
            contract_terms: companyForm.contract_terms,
          });

      const { error: companyError } = await companyQuery;
      if (companyError) throw companyError;

      const preferencesPayload: PreferencesForm = {
        ...preferencesForm,
        commercial_documents: buildCommercialDocumentsFromForm(companyForm, preferencesForm.commercial_documents),
      };

      await upsertSystemPreferences(preferencesPayload);
      await refreshSettings?.();
      setStatus("Documentos comerciais salvos com sucesso.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar documentos comerciais.", "error");
    } finally {
      setSavingTab(null);
    }
  }

  function renderSaveButton(tab: SettingsTab, label: string, onClick: () => void) {
    const loading = savingTab === tab;
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClick}
          disabled={loading || uploadingLogo}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
        >
          {loading ? "Salvando..." : label}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-transparent text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Configurações AXON</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Identidade visual, nomenclaturas, módulos e documentos comerciais.</p>
        </div>

        {feedback ? (
          <div
            className={mergeClassNames(
              "rounded-2xl border px-4 py-3 text-sm",
              feedback.type === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
              feedback.type === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-200",
              feedback.type === "info" && "border-white/10 bg-white/5 text-[var(--color-text-primary)]"
            )}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[var(--color-surface)]/80 p-2">
          {TAB_OPTIONS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={mergeClassNames(
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  isActive ? "text-white" : "text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-white"
                )}
                style={isActive ? { backgroundColor: primaryColor } : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "perfil-corporativo" ? (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6 shadow-none">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Perfil Corporativo</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Sem alterar o fundo global do sistema. Só dados corporativos e identidade visual.</p>
            </div>

            {renderSaveButton("perfil-corporativo", "Salvar perfil corporativo", saveCompanyTab)}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nome exibido da empresa">
                <Input value={companyForm.company_name} onChange={(event) => updateCompanyField("company_name", event.target.value)} />
              </Field>

              <Field label="CNPJ">
                <Input value={companyForm.cnpj} onChange={handleMaskedInput("cnpj", formatCnpj)} placeholder="00.000.000/0000-00" />
              </Field>

              <Field label="Cor principal do sistema">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={companyForm.primary_color}
                    onChange={(event) => updateCompanyField("primary_color", event.target.value)}
                    className="h-11 w-16 rounded-xl border border-white/10 bg-black/20 p-1"
                  />
                  <Input value={companyForm.primary_color} onChange={(event) => updateCompanyField("primary_color", event.target.value)} />
                </div>
              </Field>

              <Field label="Razão social">
                <Input value={companyForm.legal_name} onChange={(event) => updateCompanyField("legal_name", event.target.value)} />
              </Field>

              <Field label="Nome fantasia">
                <Input value={companyForm.trade_name} onChange={(event) => updateCompanyField("trade_name", event.target.value)} />
              </Field>

              <Field label="Site">
                <Input value={companyForm.website} onChange={(event) => updateCompanyField("website", event.target.value)} placeholder="https://..." />
              </Field>

              <Field label="E-mail de contato">
                <Input value={companyForm.contact_email} onChange={(event) => updateCompanyField("contact_email", event.target.value)} />
              </Field>

              <Field label="Telefone fixo">
                <Input value={companyForm.phone_landline} onChange={handleMaskedInput("phone_landline", formatPhone)} placeholder="(21) 3333-4444" />
              </Field>

              <Field label="Celular">
                <Input value={companyForm.phone_mobile} onChange={handleMaskedInput("phone_mobile", formatPhone)} placeholder="(21) 99999-9999" />
              </Field>

              <Field label="WhatsApp">
                <Input value={companyForm.whatsapp_number} onChange={handleMaskedInput("whatsapp_number", formatPhone)} placeholder="(21) 99999-9999" />
              </Field>

              <Field label="CEP">
                <Input value={companyForm.zipcode} onChange={handleMaskedInput("zipcode", formatCep)} placeholder="00000-000" />
              </Field>

              <Field label="Estado">
                <Select
                  value={companyForm.state}
                  onChange={(event) => {
                    updateCompanyField("state", event.target.value);
                    updateCompanyField("city", "");
                  }}
                >
                  <option value="">{loadingStates ? "Carregando estados..." : "Selecione"}</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.sigla}>
                      {state.nome} ({state.sigla})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Cidade">
                <Select value={companyForm.city} onChange={(event) => updateCompanyField("city", event.target.value)} disabled={!companyForm.state || loadingCities}>
                  <option value="">{loadingCities ? "Carregando municípios..." : "Selecione"}</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.nome}>
                      {city.nome}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Endereço">
                <Input value={companyForm.street} onChange={(event) => updateCompanyField("street", event.target.value)} />
              </Field>

              <Field label="Número">
                <Input value={companyForm.street_number} onChange={(event) => updateCompanyField("street_number", event.target.value)} />
              </Field>

              <Field label="Complemento">
                <Input value={companyForm.complement} onChange={(event) => updateCompanyField("complement", event.target.value)} />
              </Field>

              <Field label="Bairro">
                <Input value={companyForm.district} onChange={(event) => updateCompanyField("district", event.target.value)} />
              </Field>

              <Field label="País">
                <Input value={companyForm.country} onChange={(event) => updateCompanyField("country", event.target.value)} />
              </Field>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="mb-4 space-y-1">
                <h3 className="font-medium text-[var(--color-text-primary)]">Logo da empresa</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Bucket axon-assets / pasta logos.</p>
              </div>

              <div className="flex flex-col gap-5 lg:flex-row">
                <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/10 bg-black/10">
                  {logoPreview || companyForm.logo_url ? (
                    <img
                      src={logoPreview || companyForm.logo_url}
                      alt="Logo da empresa"
                      className="h-full w-full object-contain"
                      style={{ transform: `scale(${cropScale})` }}
                    />
                  ) : (
                    <span className="px-4 text-center text-sm text-[var(--color-text-secondary)]">Nenhuma logo enviada</span>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleSelectLogo(event.target.files?.[0] ?? null)}
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-white/10 bg-black/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5">
                      {companyForm.logo_url || logoPreview ? "Editar logo" : "Enviar logo"}
                    </button>
                    {(companyForm.logo_url || logoPreview) ? (
                      <button type="button" onClick={removeLogo} className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-400/20">
                        Excluir logo
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Ajuste de corte">
                      <input type="range" min="1" max="2.2" step="0.1" value={cropScale} onChange={(event) => setCropScale(Number(event.target.value))} className="w-full accent-[var(--color-cs-green)]" />
                    </Field>
                    <Field label="Tamanho final">
                      <input type="range" min="160" max="800" step="20" value={cropSize} onChange={(event) => setCropSize(Number(event.target.value))} className="w-full accent-[var(--color-cs-green)]" />
                    </Field>
                  </div>

                  <p className="text-xs text-[var(--color-text-secondary)]">A logo só sobe no storage quando você salvar.</p>
                  {canSaveLogoEdit ? <p className="text-xs text-[var(--color-cs-gold)]">Nova logo pendente de upload.</p> : null}
                </div>
              </div>
            </div>

            {renderSaveButton("perfil-corporativo", "Salvar perfil corporativo", saveCompanyTab)}
          </section>
        ) : null}

        {activeTab === "nomenclaturas" ? (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6 shadow-none">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Nomenclaturas</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Tudo em português, com presets prontos para o usuário só selecionar.</p>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Presets rápidos</h3>
              <div className="space-y-4">
                {NOMENCLATURE_PRESETS.map((group) => (
                  <div key={group.title} className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">{group.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyPreset(preset.values)}
                          className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white transition hover:border-[var(--color-cs-green)]/40 hover:bg-[var(--color-cs-green)]/10"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {renderSaveButton("nomenclaturas", "Salvar nomenclaturas", saveLabelsTab)}

            <div className="space-y-5">
              {LABEL_GROUPS.map((group) => (
                <div key={group.title} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <h3 className="mb-4 font-medium text-[var(--color-text-primary)]">{group.title}</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.fields.map((field) => (
                      <Field key={field} label={getLabelTitle(field)}>
                        <Input value={preferencesForm.custom_labels[field] ?? ""} onChange={(event) => updateLabelField(field, event.target.value)} />
                      </Field>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {renderSaveButton("nomenclaturas", "Salvar nomenclaturas", saveLabelsTab)}
          </section>
        ) : null}

        {activeTab === "modulos" ? (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6 shadow-none">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Módulos</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Ative apenas o que entra na operação do cliente.</p>
            </div>

            {renderSaveButton("modulos", "Salvar módulos", saveModulesTab)}

            <div className="grid gap-4 lg:grid-cols-2">
              {MODULES.map((module) => {
                const enabled = Boolean(preferencesForm.feature_toggles[module.key]);
                return (
                  <div key={module.key} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-medium text-[var(--color-text-primary)]">{module.title}</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">{module.description}</p>
                      </div>
                      <ToggleSwitch value={enabled} onChange={(value) => updateFeatureToggle(module.key, value)} activeColor={primaryColor} />
                    </div>
                  </div>
                );
              })}
            </div>

            {renderSaveButton("modulos", "Salvar módulos", saveModulesTab)}
          </section>
        ) : null}

        {activeTab === "documentos" ? (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6 shadow-none">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Documentos Comerciais</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Cláusulas, textos padrões, rodapés e regras de exibição.</p>
            </div>

            {renderSaveButton("documentos", "Salvar documentos comerciais", saveDocumentsTab)}

            <div className="grid gap-4 md:grid-cols-2">
              <ToggleField label="Mostrar logo nos orçamentos" value={Boolean(preferencesForm.commercial_documents.show_logo_on_quotes)} onChange={(value) => updateCommercialDocField("show_logo_on_quotes", value)} activeColor={primaryColor} />
              <ToggleField label="Mostrar endereço nos orçamentos" value={Boolean(preferencesForm.commercial_documents.show_company_address_on_quotes)} onChange={(value) => updateCommercialDocField("show_company_address_on_quotes", value)} activeColor={primaryColor} />
              <ToggleField label="Mostrar contatos nos orçamentos" value={Boolean(preferencesForm.commercial_documents.show_company_contacts_on_quotes)} onChange={(value) => updateCommercialDocField("show_company_contacts_on_quotes", value)} activeColor={primaryColor} />
              <ToggleField label="Mostrar assinatura nos orçamentos" value={Boolean(preferencesForm.commercial_documents.show_signature_on_quotes)} onChange={(value) => updateCommercialDocField("show_signature_on_quotes", value)} activeColor={primaryColor} />
            </div>

            <Field label="Texto de abertura do orçamento">
              <Textarea value={String(preferencesForm.commercial_documents.quote_intro_text ?? "")} onChange={(event) => updateCommercialDocField("quote_intro_text", event.target.value)} />
            </Field>

            <Field label="Termos padrão do orçamento">
              <Textarea value={String(preferencesForm.commercial_documents.quote_terms_text ?? "")} onChange={(event) => updateCommercialDocField("quote_terms_text", event.target.value)} />
            </Field>

            <Field label="Cláusulas contratuais padrão">
              <Textarea value={companyForm.contract_terms} onChange={(event) => updateCompanyField("contract_terms", event.target.value)} />
            </Field>

            <Field label="Modelo de proposta">
              <Textarea value={String(preferencesForm.commercial_documents.default_proposal_template ?? "")} onChange={(event) => updateCommercialDocField("default_proposal_template", event.target.value)} />
            </Field>

            <Field label="Rodapé de proposta">
              <Textarea value={companyForm.proposal_footer} onChange={(event) => updateCompanyField("proposal_footer", event.target.value)} />
            </Field>

            <Field label="Rodapé de fatura">
              <Textarea value={companyForm.invoice_footer} onChange={(event) => updateCompanyField("invoice_footer", event.target.value)} />
            </Field>

            <Field label="Observações operacionais padrão">
              <Textarea value={String(preferencesForm.commercial_documents.default_operational_notes ?? "")} onChange={(event) => updateCommercialDocField("default_operational_notes", event.target.value)} />
            </Field>

            {renderSaveButton("documentos", "Salvar documentos comerciais", saveDocumentsTab)}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={mergeClassNames(
        "min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-4 py-2 text-sm text-white outline-none transition",
        "placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)]/60 focus:bg-black/20 focus:ring-2 focus:ring-[var(--color-cs-green)]/15",
        props.className
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={mergeClassNames(
        "min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-4 py-2 text-sm text-white outline-none transition",
        "focus:border-[var(--color-cs-green)]/60 focus:bg-black/20 focus:ring-2 focus:ring-[var(--color-cs-green)]/15 disabled:cursor-not-allowed disabled:opacity-60",
        props.className
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={mergeClassNames(
        "min-h-[140px] w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white outline-none transition",
        "placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)]/60 focus:bg-black/20 focus:ring-2 focus:ring-[var(--color-cs-green)]/15",
        props.className
      )}
    />
  );
}

function ToggleSwitch({ value, onChange, activeColor }: { value: boolean; onChange: (value: boolean) => void; activeColor: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="relative h-7 w-12 rounded-full transition"
      style={{ backgroundColor: value ? activeColor : "rgba(255,255,255,0.18)" }}
    >
      <span className={mergeClassNames("absolute top-1 h-5 w-5 rounded-full bg-white transition", value ? "left-6" : "left-1")} />
    </button>
  );
}

function ToggleField({
  label,
  value,
  onChange,
  activeColor,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  activeColor: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 p-4">
      <span className="pr-4 text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      <ToggleSwitch value={value} onChange={onChange} activeColor={activeColor} />
    </div>
  );
}