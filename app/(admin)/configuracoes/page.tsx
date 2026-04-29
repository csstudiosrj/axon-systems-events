"use client";

import {
  ChangeEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";

type SettingsTab =
  | "perfil-corporativo"
  | "nomenclaturas"
  | "modulos"
  | "documentos";

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

type IbgeState = { id: number; nome: string; sigla: string };
type IbgeCity = { id: number; nome: string };

type PresetGroup = {
  title: string;
  options: Array<{ label: string; values: Record<string, string> }>;
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

const LABEL_MAP: Record<string, string> = {
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
  entity_client_singular: "Cliente (singular)",
  entity_client_plural: "Cliente (plural)",
  entity_lead_singular: "Lead (singular)",
  entity_lead_plural: "Lead (plural)",
  entity_quote_singular: "Orçamento / Consulta (singular)",
  entity_quote_plural: "Orçamento / Consulta (plural)",
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
  entity_salesperson_singular: "Responsável comercial (singular)",
  entity_salesperson_plural: "Responsável comercial (plural)",
};

const NOMENCLATURE_PRESETS: PresetGroup[] = [
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

const MODULES = [
  {
    key: "enable_dashboard",
    title: "Dashboard",
    description: "Visão geral do negócio com métricas, atalhos e acompanhamento diário.",
  },
  {
    key: "enable_crm",
    title: "CRM",
    description: "Oportunidades, contatos e funil comercial em um só lugar.",
  },
  {
    key: "enable_clients",
    title: "Cadastros",
    description: "Registros principais de clientes, alunos ou empresas atendidas.",
  },
  {
    key: "enable_quotes",
    title: "Orçamentos / Consultas",
    description: "Montagem de propostas, valores, condições e envio de documentos.",
  },
  {
    key: "enable_financial",
    title: "Financeiro",
    description: "Contas, recebimentos, vencimentos e acompanhamento financeiro.",
  },
  {
    key: "enable_inventory",
    title: "Inventário",
    description: "Itens, equipamentos, estoque e disponibilidade operacional.",
  },
  {
    key: "enable_service_orders",
    title: "Ordens de Serviço",
    description: "Execução de serviços, itens extras, status e operação do dia a dia.",
  },
  {
    key: "enable_marketing",
    title: "Marketing",
    description: "Planejamento e organização de conteúdos, campanhas e publicações.",
  },
  {
    key: "enable_calendar",
    title: "Calendário",
    description: "Agenda, datas importantes e organização de atividades.",
  },
  {
    key: "enable_team",
    title: "Equipe",
    description: "Informações da equipe e acompanhamento de colaboradores.",
  },
  {
    key: "enable_support",
    title: "Suporte",
    description: "Canal de atendimento e acompanhamento de solicitações.",
  },
  {
    key: "enable_training",
    title: "Treinamentos",
    description: "Área de cursos, aulas e acompanhamento de aprendizagem.",
  },
  {
    key: "enable_client_portal",
    title: "Portal do Cliente",
    description: "Área exclusiva para o cliente acompanhar informações e documentos.",
  },
] as const;

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
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildCommercialDocuments(
  form: CompanyForm,
  current: CommercialDocuments
): CommercialDocuments {
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

export default function ConfiguracoesPage() {
  const { companyProfile, systemPreferences, refreshSettings } =
    useSettings() as SettingsContextShape;

  const [activeTab, setActiveTab] = useState<SettingsTab>("perfil-corporativo");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(DEFAULT_COMPANY_FORM);
  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    custom_labels: { ...DEFAULT_CUSTOM_LABELS },
    feature_toggles: { ...DEFAULT_FEATURE_TOGGLES },
    commercial_documents: { ...DEFAULT_COMMERCIAL_DOCUMENTS },
  });

  const [savingTab, setSavingTab] = useState<SettingsTab | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
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

  const primaryColor = useMemo(
    () => companyForm.primary_color || "#138946",
    [companyForm.primary_color]
  );

  useEffect(() => {
    const saved: CommercialDocuments = {
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
      legal_name: String(saved.company_legal_name ?? ""),
      trade_name: String(saved.company_trade_name ?? ""),
      website: String(saved.website ?? ""),
      contact_email: String(saved.contact_email ?? ""),
      phone_landline: String(saved.phone_landline ?? ""),
      phone_mobile: String(saved.phone_mobile ?? ""),
      whatsapp_number: String(saved.whatsapp_number ?? ""),
      zipcode: String(saved.zipcode ?? ""),
      street: String(saved.street ?? ""),
      street_number: String(saved.street_number ?? ""),
      complement: String(saved.complement ?? ""),
      district: String(saved.district ?? ""),
      city: String(saved.city ?? ""),
      state: String(saved.state ?? ""),
      country: String(saved.country ?? "Brasil"),
      proposal_footer: String(saved.proposal_footer ?? ""),
      invoice_footer: String(saved.invoice_footer ?? ""),
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
      commercial_documents: saved,
    });

    setLogoPreview(companyProfile?.logo_url ?? "");
  }, [companyProfile, systemPreferences]);

  useEffect(() => {
    setLoadingStates(true);
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados")
      .then((r) => r.json())
      .then((data: IbgeState[]) =>
        setStates([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))
      )
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  }, []);

  useEffect(() => {
    const uf = companyForm.state.trim().toUpperCase();
    if (!uf || uf.length !== 2) {
      setCities([]);
      return;
    }

    setLoadingCities(true);
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
    )
      .then((r) => r.json())
      .then((data: IbgeCity[]) =>
        setCities([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))
      )
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [companyForm.state]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function notify(message: string, type: "success" | "error" | "info") {
    setFeedback({ message, type });
  }

  function setField<K extends keyof CompanyForm>(field: K, value: CompanyForm[K]) {
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  }

  function setLabel(key: string, value: string) {
    setPreferencesForm((prev) => ({
      ...prev,
      custom_labels: { ...prev.custom_labels, [key]: value },
    }));
  }

  function setToggle(key: string, value: boolean) {
    setPreferencesForm((prev) => ({
      ...prev,
      feature_toggles: { ...prev.feature_toggles, [key]: value },
    }));
  }

  function setCommercialDoc(key: string, value: string | boolean) {
    setPreferencesForm((prev) => ({
      ...prev,
      commercial_documents: { ...prev.commercial_documents, [key]: value },
    }));
  }

  function masked(field: keyof CompanyForm, fmt: (v: string) => string) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setField(field, fmt(e.target.value) as CompanyForm[keyof CompanyForm]);
  }

  function applyPreset(values: Record<string, string>) {
    setPreferencesForm((prev) => ({
      ...prev,
      custom_labels: { ...prev.custom_labels, ...values },
    }));
    notify("Preset aplicado. Revise e salve.", "info");
  }

  function selectLogo(file?: File | null) {
    if (!file) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setSelectedLogoFile(file);
    setLogoPreview(url);
    notify("Logo selecionada. Salve o perfil para concluir o upload.", "info");
  }

  function removeLogo() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedLogoFile(null);
    setLogoPreview("");
    setField("logo_url", "");
    notify("Logo removida. Salve o perfil para persistir.", "info");
  }

  async function uploadLogo(): Promise<string> {
    if (!selectedLogoFile) return companyForm.logo_url;

    setUploadingLogo(true);
    try {
      const tempUrl = URL.createObjectURL(selectedLogoFile);
      const img = new Image();
      img.src = tempUrl;

      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Falha ao ler imagem da logo."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = cropSize;
      canvas.height = cropSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível.");

      const shortest = Math.min(img.width, img.height);
      const srcSize = shortest / cropScale;
      const srcX = (img.width - srcSize) / 2;
      const srcY = (img.height - srcSize) / 2;

      ctx.clearRect(0, 0, cropSize, cropSize);
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, cropSize, cropSize);
      URL.revokeObjectURL(tempUrl);

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png", 0.95)
      );
      if (!blob) throw new Error("Falha ao gerar arquivo da logo.");

      const safeName = sanitizeFileName(
        selectedLogoFile.name.replace(/\.[^.]+$/, "") || "logo"
      );
      const path = `logos/${Date.now()}-${safeName}.png`;

      const { error: uploadErr } = await supabase.storage
        .from("axon-assets")
        .upload(path, blob, { contentType: "image/png", upsert: true });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from("axon-assets").getPublicUrl(path);
      if (!data.publicUrl) throw new Error("URL pública não gerada.");

      setSelectedLogoFile(null);
      setLogoPreview(data.publicUrl);
      setField("logo_url", data.publicUrl);
      return data.publicUrl;
    } finally {
      setUploadingLogo(false);
    }
  }

  async function upsertPreferences(payload: PreferencesForm) {
    const id = systemPreferences?.id;

    if (id) {
      const { error } = await supabase
        .from("system_preferences")
        .update({
          custom_labels: payload.custom_labels,
          feature_toggles: payload.feature_toggles,
          commercial_documents: payload.commercial_documents,
        })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("system_preferences")
        .insert({
          custom_labels: payload.custom_labels,
          feature_toggles: payload.feature_toggles,
          commercial_documents: payload.commercial_documents,
        });
      if (error) throw error;
    }
  }

  async function saveCompanyTab() {
    setSavingTab("perfil-corporativo");
    notify("Salvando...", "info");
    try {
      const logoUrl = await uploadLogo();

      const payload: CompanyProfilePayload = {
        company_name: companyForm.company_name.trim(),
        cnpj: formatCnpj(companyForm.cnpj),
        logo_url: logoUrl,
        primary_color: primaryColor,
        contract_terms: companyForm.contract_terms,
      };

      const id = companyProfile?.id;
      const { error } = id
        ? await supabase.from("company_profile").update(payload).eq("id", id)
        : await supabase.from("company_profile").insert(payload);
      if (error) throw error;

      await upsertPreferences({
        ...preferencesForm,
        commercial_documents: buildCommercialDocuments(
          companyForm,
          preferencesForm.commercial_documents
        ),
      });

      await refreshSettings?.();
      notify("Perfil corporativo salvo.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveLabelsTab() {
    setSavingTab("nomenclaturas");
    notify("Salvando...", "info");
    try {
      await upsertPreferences(preferencesForm);
      await refreshSettings?.();
      notify("Nomenclaturas salvas.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveModulesTab() {
    setSavingTab("modulos");
    notify("Salvando...", "info");
    try {
      await upsertPreferences(preferencesForm);
      await refreshSettings?.();
      notify("Módulos salvos.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveDocumentsTab() {
    setSavingTab("documentos");
    notify("Salvando...", "info");
    try {
      const id = companyProfile?.id;
      const { error } = id
        ? await supabase
            .from("company_profile")
            .update({ contract_terms: companyForm.contract_terms })
            .eq("id", id)
        : await supabase.from("company_profile").insert({
            company_name: companyForm.company_name.trim(),
            cnpj: formatCnpj(companyForm.cnpj),
            logo_url: companyForm.logo_url,
            primary_color: primaryColor,
            contract_terms: companyForm.contract_terms,
          });
      if (error) throw error;

      await upsertPreferences({
        ...preferencesForm,
        commercial_documents: buildCommercialDocuments(
          companyForm,
          preferencesForm.commercial_documents
        ),
      });

      await refreshSettings?.();
      notify("Documentos comerciais salvos.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setSavingTab(null);
    }
  }

  function SaveButton({
    tab,
    label,
    onClick,
  }: {
    tab: SettingsTab;
    label: string;
    onClick: () => void;
  }) {
    const busy = savingTab === tab || uploadingLogo;
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
        >
          {busy ? "Salvando…" : label}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-transparent text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {feedback && (
          <div
            className={cx(
              "rounded-2xl border px-4 py-3 text-sm",
              feedback.type === "success" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
              feedback.type === "error" &&
                "border-rose-500/30 bg-rose-500/10 text-rose-300",
              feedback.type === "info" &&
                "border-white/10 bg-white/5 text-[var(--color-text-primary)]"
            )}
          >
            {feedback.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[var(--color-surface)]/80 p-2">
          {TAB_OPTIONS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  active
                    ? "text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-white"
                )}
                style={active ? { backgroundColor: primaryColor } : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "perfil-corporativo" && (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6">
            <SectionHeader
              title="Perfil Corporativo"
              subtitle="Dados da empresa e identidade visual do sistema."
            />

            <SaveButton
              tab="perfil-corporativo"
              label="Salvar perfil corporativo"
              onClick={saveCompanyTab}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nome exibido">
                <Input
                  value={companyForm.company_name}
                  onChange={(e) => setField("company_name", e.target.value)}
                />
              </Field>

              <Field label="CNPJ">
                <Input
                  value={companyForm.cnpj}
                  onChange={masked("cnpj", formatCnpj)}
                  placeholder="00.000.000/0000-00"
                />
              </Field>

              <Field label="Razão social">
                <Input
                  value={companyForm.legal_name}
                  onChange={(e) => setField("legal_name", e.target.value)}
                />
              </Field>

              <Field label="Nome fantasia">
                <Input
                  value={companyForm.trade_name}
                  onChange={(e) => setField("trade_name", e.target.value)}
                />
              </Field>

              <Field label="Site">
                <Input
                  value={companyForm.website}
                  onChange={(e) => setField("website", e.target.value)}
                  placeholder="https://..."
                />
              </Field>

              <Field label="E-mail de contato">
                <Input
                  value={companyForm.contact_email}
                  onChange={(e) => setField("contact_email", e.target.value)}
                  type="email"
                />
              </Field>

              <Field label="Telefone fixo">
                <Input
                  value={companyForm.phone_landline}
                  onChange={masked("phone_landline", formatPhone)}
                  placeholder="(21) 3333-4444"
                />
              </Field>

              <Field label="Celular">
                <Input
                  value={companyForm.phone_mobile}
                  onChange={masked("phone_mobile", formatPhone)}
                  placeholder="(21) 99999-9999"
                />
              </Field>

              <Field label="WhatsApp">
                <Input
                  value={companyForm.whatsapp_number}
                  onChange={masked("whatsapp_number", formatPhone)}
                  placeholder="(21) 99999-9999"
                />
              </Field>

              <Field label="CEP">
                <Input
                  value={companyForm.zipcode}
                  onChange={masked("zipcode", formatCep)}
                  placeholder="00000-000"
                />
              </Field>

              <Field label="Estado">
                <Select
                  value={companyForm.state}
                  onChange={(e) => {
                    setField("state", e.target.value);
                    setField("city", "");
                  }}
                >
                  <option value="">
                    {loadingStates ? "Carregando…" : "Selecione"}
                  </option>
                  {states.map((s) => (
                    <option key={s.id} value={s.sigla}>
                      {s.nome} ({s.sigla})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Cidade">
                <Select
                  value={companyForm.city}
                  onChange={(e) => setField("city", e.target.value)}
                  disabled={!companyForm.state || loadingCities}
                >
                  <option value="">
                    {loadingCities ? "Carregando…" : "Selecione"}
                  </option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.nome}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Endereço">
                <Input
                  value={companyForm.street}
                  onChange={(e) => setField("street", e.target.value)}
                />
              </Field>

              <Field label="Número">
                <Input
                  value={companyForm.street_number}
                  onChange={(e) => setField("street_number", e.target.value)}
                />
              </Field>

              <Field label="Complemento">
                <Input
                  value={companyForm.complement}
                  onChange={(e) => setField("complement", e.target.value)}
                />
              </Field>

              <Field label="Bairro">
                <Input
                  value={companyForm.district}
                  onChange={(e) => setField("district", e.target.value)}
                />
              </Field>

              <Field label="País">
                <Input
                  value={companyForm.country}
                  onChange={(e) => setField("country", e.target.value)}
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
              <h3 className="mb-1 font-medium">Logo da empresa</h3>
              <p className="mb-5 text-xs text-[var(--color-text-secondary)]">
                Bucket <code>axon-assets</code>, pasta <code>logos/</code>. Formato PNG final.
              </p>

              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex h-44 w-44 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-black/20">
                  {logoPreview || companyForm.logo_url ? (
                    <img
                      src={logoPreview || companyForm.logo_url}
                      alt="Logo"
                      className="h-full w-full object-contain transition-transform"
                      style={{ transform: `scale(${cropScale})` }}
                    />
                  ) : (
                    <span className="px-4 text-center text-sm text-[var(--color-text-secondary)]">
                      Nenhuma logo
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => selectLogo(e.target.files?.[0])}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-white/10 bg-black/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
                    >
                      {logoPreview || companyForm.logo_url ? "Trocar logo" : "Enviar logo"}
                    </button>
                    {(logoPreview || companyForm.logo_url) && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-400/20"
                      >
                        Excluir logo
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={`Zoom: ${cropScale.toFixed(1)}×`}>
                      <input
                        type="range"
                        min="1"
                        max="2.5"
                        step="0.1"
                        value={cropScale}
                        onChange={(e) => setCropScale(Number(e.target.value))}
                        className="w-full accent-[var(--color-cs-green)]"
                      />
                    </Field>
                    <Field label={`Tamanho final: ${cropSize}px`}>
                      <input
                        type="range"
                        min="160"
                        max="800"
                        step="20"
                        value={cropSize}
                        onChange={(e) => setCropSize(Number(e.target.value))}
                        className="w-full accent-[var(--color-cs-green)]"
                      />
                    </Field>
                  </div>

                  {selectedLogoFile && (
                    <p className="text-xs text-[var(--color-cs-gold)]">
                      Upload pendente — salve o perfil para concluir.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <SaveButton
              tab="perfil-corporativo"
              label="Salvar perfil corporativo"
              onClick={saveCompanyTab}
            />
          </section>
        )}

        {activeTab === "nomenclaturas" && (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6">
            <SectionHeader
              title="Nomenclaturas"
              subtitle="Renomeie menus e entidades para o vocabulário do cliente."
            />

            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
              <h3 className="mb-4 text-sm font-semibold">Presets rápidos</h3>
              <div className="space-y-5">
                {NOMENCLATURE_PRESETS.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--color-text-secondary)]">
                      {group.title}
                    </p>
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

            <SaveButton
              tab="nomenclaturas"
              label="Salvar nomenclaturas"
              onClick={saveLabelsTab}
            />

            <div className="space-y-5">
              {LABEL_GROUPS.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-white/10 bg-black/10 p-5"
                >
                  <h3 className="mb-4 font-medium">{group.title}</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.fields.map((field) => (
                      <Field key={field} label={LABEL_MAP[field] ?? field}>
                        <Input
                          value={preferencesForm.custom_labels[field] ?? ""}
                          onChange={(e) => setLabel(field, e.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <SaveButton
              tab="nomenclaturas"
              label="Salvar nomenclaturas"
              onClick={saveLabelsTab}
            />
          </section>
        )}

        {activeTab === "modulos" && (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6">
            <SectionHeader
              title="Módulos"
              subtitle="Ative apenas as funcionalidades usadas pelo cliente."
            />

            <SaveButton
              tab="modulos"
              label="Salvar módulos"
              onClick={saveModulesTab}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              {MODULES.map((mod) => {
                const enabled = Boolean(preferencesForm.feature_toggles[mod.key]);
                return (
                  <div
                    key={mod.key}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 p-5"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">{mod.title}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {mod.description}
                      </p>
                    </div>
                    <Toggle
                      value={enabled}
                      onChange={(v) => setToggle(mod.key, v)}
                      activeColor={primaryColor}
                    />
                  </div>
                );
              })}
            </div>

            <SaveButton
              tab="modulos"
              label="Salvar módulos"
              onClick={saveModulesTab}
            />
          </section>
        )}

        {activeTab === "documentos" && (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6">
            <SectionHeader
              title="Documentos Comerciais"
              subtitle="Cláusulas, textos padrões, rodapés e regras de exibição."
            />

            <SaveButton
              tab="documentos"
              label="Salvar documentos comerciais"
              onClick={saveDocumentsTab}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow
                label="Mostrar logo nos orçamentos"
                value={Boolean(
                  preferencesForm.commercial_documents.show_logo_on_quotes
                )}
                onChange={(v) => setCommercialDoc("show_logo_on_quotes", v)}
                activeColor={primaryColor}
              />
              <ToggleRow
                label="Mostrar endereço nos orçamentos"
                value={Boolean(
                  preferencesForm.commercial_documents.show_company_address_on_quotes
                )}
                onChange={(v) =>
                  setCommercialDoc("show_company_address_on_quotes", v)
                }
                activeColor={primaryColor}
              />
              <ToggleRow
                label="Mostrar contatos nos orçamentos"
                value={Boolean(
                  preferencesForm.commercial_documents.show_company_contacts_on_quotes
                )}
                onChange={(v) =>
                  setCommercialDoc("show_company_contacts_on_quotes", v)
                }
                activeColor={primaryColor}
              />
              <ToggleRow
                label="Mostrar assinatura nos orçamentos"
                value={Boolean(
                  preferencesForm.commercial_documents.show_signature_on_quotes
                )}
                onChange={(v) => setCommercialDoc("show_signature_on_quotes", v)}
                activeColor={primaryColor}
              />
            </div>

            <Field label="Texto de abertura do orçamento">
              <Textarea
                value={String(
                  preferencesForm.commercial_documents.quote_intro_text ?? ""
                )}
                onChange={(e) =>
                  setCommercialDoc("quote_intro_text", e.target.value)
                }
              />
            </Field>

            <Field label="Termos padrão do orçamento">
              <Textarea
                value={String(
                  preferencesForm.commercial_documents.quote_terms_text ?? ""
                )}
                onChange={(e) =>
                  setCommercialDoc("quote_terms_text", e.target.value)
                }
              />
            </Field>

            <Field label="Cláusulas contratuais padrão">
              <Textarea
                value={companyForm.contract_terms}
                onChange={(e) => setField("contract_terms", e.target.value)}
              />
            </Field>

            <Field label="Modelo de proposta">
              <Textarea
                value={String(
                  preferencesForm.commercial_documents.default_proposal_template ?? ""
                )}
                onChange={(e) =>
                  setCommercialDoc("default_proposal_template", e.target.value)
                }
              />
            </Field>

            <Field label="Rodapé de proposta">
              <Textarea
                value={companyForm.proposal_footer}
                onChange={(e) => setField("proposal_footer", e.target.value)}
              />
            </Field>

            <Field label="Rodapé de fatura">
              <Textarea
                value={companyForm.invoice_footer}
                onChange={(e) => setField("invoice_footer", e.target.value)}
              />
            </Field>

            <Field label="Observações operacionais padrão">
              <Textarea
                value={String(
                  preferencesForm.commercial_documents.default_operational_notes ?? ""
                )}
                onChange={(e) =>
                  setCommercialDoc("default_operational_notes", e.target.value)
                }
              />
            </Field>

            <SaveButton
              tab="documentos"
              label="Salvar documentos comerciais"
              onClick={saveDocumentsTab}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-4 py-2 text-sm text-white outline-none transition",
        "placeholder:text-[var(--color-text-secondary)]",
        "focus:border-[var(--color-cs-green)]/60 focus:bg-black/20 focus:ring-2 focus:ring-[var(--color-cs-green)]/15",
        props.className
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "min-h-11 w-full rounded-xl border border-white/10 bg-[var(--color-surface)] px-4 py-2 text-sm text-white outline-none transition",
        "focus:border-[var(--color-cs-green)]/60 focus:ring-2 focus:ring-[var(--color-cs-green)]/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        props.className
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={5}
      {...props}
      className={cx(
        "min-h-[140px] w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white outline-none transition",
        "placeholder:text-[var(--color-text-secondary)]",
        "focus:border-[var(--color-cs-green)]/60 focus:bg-black/20 focus:ring-2 focus:ring-[var(--color-cs-green)]/15",
        props.className
      )}
    />
  );
}

function Toggle({
  value,
  onChange,
  activeColor,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  activeColor: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: value ? activeColor : "rgba(255,255,255,0.15)" }}
    >
      <span
        className={cx(
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200",
          value ? "left-6" : "left-1"
        )}
      />
    </button>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  activeColor,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  activeColor: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 p-4">
      <span className="pr-4 text-sm font-medium">{label}</span>
      <Toggle value={value} onChange={onChange} activeColor={activeColor} />
    </div>
  );
}