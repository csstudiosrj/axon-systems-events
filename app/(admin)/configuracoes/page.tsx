"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";

type SettingsTab = "perfil-corporativo" | "nomenclaturas" | "modulos" | "documentos";

type ValidCompanyProfilePayload = {
  company_name: string;
  cnpj: string;
  logo_url: string;
  primary_color: string;
  contract_terms: string;
};

type ExtendedCompanyForm = ValidCompanyProfilePayload & {
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

type PreferencesForm = {
  custom_labels: Record<string, string>;
  feature_toggles: Record<string, boolean>;
  commercial_documents: Record<string, string | boolean>;
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
    custom_labels?: Record<string, string> | null;
    feature_toggles?: Record<string, boolean> | null;
    commercial_documents?: Record<string, string | boolean> | null;
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

const DEFAULT_COMPANY_FORM: ExtendedCompanyForm = {
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

const DEFAULT_CUSTOM_LABELS: Record<string, string> = {
  client_singular: "Cliente",
  client_plural: "Clientes",
  quote_singular: "Orçamento",
  quote_plural: "Orçamentos",
  academy_name: "Treinamentos",
  dashboard_name: "Dashboard",
  crm_name: "CRM",
  financial_name: "Financeiro",
  inventory_name: "Inventário",
  service_orders_name: "Ordens de Serviço",
  marketing_name: "Marketing",
  calendar_name: "Calendário",
  team_name: "Equipe",
  support_name: "Suporte",
  profile_name: "Perfil",
  portal_name: "Portal do Cliente",
  invoice_singular: "Fatura",
  invoice_plural: "Faturas",
  lead_singular: "Lead",
  lead_plural: "Leads",
  course_singular: "Curso",
  course_plural: "Cursos",
  lesson_singular: "Aula",
  lesson_plural: "Aulas",
  equipment_singular: "Equipamento",
  equipment_plural: "Equipamentos",
  contract_singular: "Contrato",
  contract_plural: "Contratos",
  proposal_singular: "Proposta",
  proposal_plural: "Propostas",
  service_order_singular: "Ordem de Serviço",
  service_order_plural: "Ordens de Serviço",
  salesperson_singular: "Responsável Comercial",
  salesperson_plural: "Responsáveis Comerciais",
};

const DEFAULT_FEATURE_TOGGLES: Record<string, boolean> = {
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

const DEFAULT_COMMERCIAL_DOCUMENTS: Record<string, string | boolean> = {
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

const MODULES = [
  { key: "enable_dashboard", title: "Dashboard", description: "Mostra a visão geral do negócio com números, atalhos e acompanhamento diário." },
  { key: "enable_crm", title: "CRM", description: "Organiza oportunidades, contatos e andamento comercial em um só lugar." },
  { key: "enable_clients", title: "Cadastros", description: "Controla os registros principais de clientes, alunos ou empresas atendidas." },
  { key: "enable_quotes", title: "Orçamentos", description: "Permite montar propostas, valores, condições e enviar documentos comerciais." },
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

const LABEL_GROUPS = [
  {
    title: "Cadastros e relacionamento",
    fields: ["client_singular", "client_plural", "lead_singular", "lead_plural", "salesperson_singular", "salesperson_plural"],
  },
  {
    title: "Comercial e documentos",
    fields: ["quote_singular", "quote_plural", "proposal_singular", "proposal_plural", "contract_singular", "contract_plural", "invoice_singular", "invoice_plural"],
  },
  {
    title: "Operação",
    fields: ["service_order_singular", "service_order_plural", "equipment_singular", "equipment_plural"],
  },
  {
    title: "Ensino e conteúdo",
    fields: ["academy_name", "course_singular", "course_plural", "lesson_singular", "lesson_plural"],
  },
  {
    title: "Menus do sistema",
    fields: ["dashboard_name", "crm_name", "financial_name", "inventory_name", "service_orders_name", "marketing_name", "calendar_name", "team_name", "support_name", "profile_name", "portal_name"],
  },
] as const;

const TAB_OPTIONS: Array<{ key: SettingsTab; label: string }> = [
  { key: "perfil-corporativo", label: "Perfil Corporativo" },
  { key: "nomenclaturas", label: "Nomenclaturas" },
  { key: "modulos", label: "Módulos" },
  { key: "documentos", label: "Documentos Comerciais" },
];

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

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

function buildPrimaryPalette(color: string) {
  const primary = color || "#138946";
  return {
    background: `${primary}22`,
    border: `${primary}55`,
    soft: `${primary}14`,
  };
}

function getLabelTitle(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCommercialDocumentsFromForm(form: ExtendedCompanyForm, current: Record<string, string | boolean>) {
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
  const { companyProfile, systemPreferences, refreshSettings } = useSettings() as SettingsContextShape;

  const [activeTab, setActiveTab] = useState<SettingsTab>("perfil-corporativo");
  const [companyForm, setCompanyForm] = useState<ExtendedCompanyForm>(DEFAULT_COMPANY_FORM);
  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    custom_labels: { ...DEFAULT_CUSTOM_LABELS },
    feature_toggles: { ...DEFAULT_FEATURE_TOGGLES },
    commercial_documents: { ...DEFAULT_COMMERCIAL_DOCUMENTS },
  });
  const [savingTab, setSavingTab] = useState<SettingsTab | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "info">("info");
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

  const themePalette = useMemo(() => buildPrimaryPalette(companyForm.primary_color), [companyForm.primary_color]);
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
        if (!response.ok) throw new Error("Não foi possível carregar os estados.");
        const data = (await response.json()) as IbgeState[];
        const sorted = [...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        setStates(sorted);
      } catch {
        setStates([]);
      } finally {
        setLoadingStates(false);
      }
    }

    void loadStates();
  }, []);

  useEffect(() => {
    const selectedState = companyForm.state.trim().toUpperCase();
    if (!selectedState || selectedState.length !== 2) {
      setCities([]);
      return;
    }

    async function loadCities() {
      setLoadingCities(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedState}/municipios`);
        if (!response.ok) throw new Error("Não foi possível carregar os municípios.");
        const data = (await response.json()) as IbgeCity[];
        const sorted = [...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        setCities(sorted);
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
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function setFeedback(message: string, type: "success" | "error" | "info") {
    setStatusMessage(message);
    setStatusType(type);
  }

  function updateCompanyField<K extends keyof ExtendedCompanyForm>(field: K, value: ExtendedCompanyForm[K]) {
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

  function handleMaskedInput(field: keyof ExtendedCompanyForm, formatter: (value: string) => string) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      updateCompanyField(field, formatter(event.target.value) as ExtendedCompanyForm[keyof ExtendedCompanyForm]);
    };
  }

  function handleSelectLogo(file?: File | null) {
    if (!file) return;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const localUrl = URL.createObjectURL(file);
    previewUrlRef.current = localUrl;
    setSelectedLogoFile(file);
    setLogoPreview(localUrl);
    setFeedback("Nova logo selecionada. Salve o perfil corporativo para concluir o upload.", "info");
  }

  async function uploadProcessedLogo() {
    if (!selectedLogoFile) {
      return companyForm.logo_url;
    }

    setUploadingLogo(true);
    try {
      const tempUrl = URL.createObjectURL(selectedLogoFile);
      const image = document.createElement("img");
      image.src = tempUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Não foi possível carregar a imagem selecionada."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = cropSize;
      canvas.height = cropSize;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Não foi possível preparar a imagem da logo.");
      }

      const shortestSide = Math.min(image.width, image.height);
      const sourceSize = shortestSide / cropScale;
      const sourceX = (image.width - sourceSize) / 2;
      const sourceY = (image.height - sourceSize) / 2;

      context.clearRect(0, 0, cropSize, cropSize);
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, cropSize, cropSize);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png", 0.95);
      });

      URL.revokeObjectURL(tempUrl);

      if (!blob) {
        throw new Error("Não foi possível gerar o arquivo final da logo.");
      }

      const fileNameWithoutExtension = selectedLogoFile.name.replace(/\.[^.]+$/, "");
      const safeName = sanitizeFileName(fileNameWithoutExtension || "logo");
      const filePath = `logos/${Date.now()}-${safeName}.png`;

      const { error: uploadError } = await supabase.storage
        .from("axon-assets")
        .upload(filePath, blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      if (!publicUrl) {
        throw new Error("Não foi possível obter a URL pública da logo.");
      }

      setSelectedLogoFile(null);
      setLogoPreview(publicUrl);
      updateCompanyField("logo_url", publicUrl);
      return publicUrl;
    } finally {
      setUploadingLogo(false);
    }
  }

  function removeLogo() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedLogoFile(null);
    setLogoPreview("");
    updateCompanyField("logo_url", "");
    setFeedback("Logo removida da configuração local. Salve o perfil para persistir.", "info");
  }

  async function upsertSystemPreferences(payload: PreferencesForm) {
    const currentId = systemPreferences?.id;
    const query = currentId
      ? supabase.from("system_preferences").update(payload).eq("id", currentId)
      : supabase.from("system_preferences").insert(payload);

    const { error } = await query;
    if (error) {
      throw error;
    }
  }

  async function saveCompanyTab() {
    setSavingTab("perfil-corporativo");
    setFeedback("Salvando perfil corporativo...", "info");

    try {
      const logoUrl = await uploadProcessedLogo();
      const companyPayload: ValidCompanyProfilePayload = {
        company_name: companyForm.company_name.trim(),
        cnpj: formatCnpj(companyForm.cnpj),
        logo_url: logoUrl,
        primary_color: companyForm.primary_color || DEFAULT_COMPANY_FORM.primary_color,
        contract_terms: companyForm.contract_terms,
      };

      const currentId = companyProfile?.id;
      const companyQuery = currentId
        ? supabase.from("company_profile").update(companyPayload).eq("id", currentId)
        : supabase.from("company_profile").insert(companyPayload);

      const { error: companyError } = await companyQuery;
      if (companyError) {
        throw companyError;
      }

      const preferencesPayload: PreferencesForm = {
        ...preferencesForm,
        commercial_documents: buildCommercialDocumentsFromForm(companyForm, preferencesForm.commercial_documents),
      };

      await upsertSystemPreferences(preferencesPayload);
      await refreshSettings?.();
      setFeedback("Perfil corporativo salvo com sucesso.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o perfil corporativo.";
      setFeedback(message, "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveLabelsTab() {
    setSavingTab("nomenclaturas");
    setFeedback("Salvando nomenclaturas...", "info");

    try {
      await upsertSystemPreferences(preferencesForm);
      await refreshSettings?.();
      setFeedback("Nomenclaturas salvas com sucesso.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar as nomenclaturas.";
      setFeedback(message, "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveModulesTab() {
    setSavingTab("modulos");
    setFeedback("Salvando módulos...", "info");

    try {
      await upsertSystemPreferences(preferencesForm);
      await refreshSettings?.();
      setFeedback("Módulos salvos com sucesso.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar os módulos.";
      setFeedback(message, "error");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveDocumentsTab() {
    setSavingTab("documentos");
    setFeedback("Salvando documentos comerciais...", "info");

    try {
      const companyPayload: Pick<ValidCompanyProfilePayload, "contract_terms"> = {
        contract_terms: companyForm.contract_terms,
      };

      const currentId = companyProfile?.id;
      const companyQuery = currentId
        ? supabase.from("company_profile").update(companyPayload).eq("id", currentId)
        : supabase.from("company_profile").insert({
            company_name: companyForm.company_name.trim(),
            cnpj: formatCnpj(companyForm.cnpj),
            logo_url: companyForm.logo_url,
            primary_color: companyForm.primary_color || DEFAULT_COMPANY_FORM.primary_color,
            contract_terms: companyForm.contract_terms,
          });

      const { error: companyError } = await companyQuery;
      if (companyError) {
        throw companyError;
      }

      const preferencesPayload: PreferencesForm = {
        ...preferencesForm,
        commercial_documents: buildCommercialDocumentsFromForm(companyForm, preferencesForm.commercial_documents),
      };

      await upsertSystemPreferences(preferencesPayload);
      await refreshSettings?.();
      setFeedback("Documentos comerciais salvos com sucesso.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar os documentos comerciais.";
      setFeedback(message, "error");
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
          className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: companyForm.primary_color || DEFAULT_COMPANY_FORM.primary_color, borderColor: companyForm.primary_color || DEFAULT_COMPANY_FORM.primary_color }}
        >
          {loading ? "Salvando..." : label}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">Configurações AXON</h1>
          <p className="text-sm text-slate-400">Gerencie identidade visual, nomenclaturas, módulos e documentos comerciais.</p>
        </div>

        {statusMessage ? (
          <div
            className={[
              "rounded-2xl border px-4 py-3 text-sm",
              statusType === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "",
              statusType === "error" ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "",
              statusType === "info" ? "text-slate-200" : "",
            ].join(" ")}
            style={statusType === "info" ? { borderColor: themePalette.border, backgroundColor: themePalette.soft } : undefined}
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2">
          {TAB_OPTIONS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="rounded-xl px-4 py-2 text-sm font-medium transition"
                style={selected ? { backgroundColor: companyForm.primary_color || DEFAULT_COMPANY_FORM.primary_color, color: "#ffffff" } : undefined}
              >
                <span className={selected ? "text-white" : "text-slate-300"}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "perfil-corporativo" ? (
          <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Perfil Corporativo</h2>
              <p className="text-sm text-slate-400">Somente campos reais do schema vão para company_profile. Dados complementares ficam em system_preferences.</p>
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
                    className="h-11 w-16 rounded-xl border border-slate-700 bg-slate-950 p-1"
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

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="mb-4 space-y-1">
                <h3 className="font-medium text-white">Logo da empresa</h3>
                <p className="text-sm text-slate-400">Upload para o bucket axon-assets em logos/ com recorte quadrado central.</p>
              </div>

              <div className="flex flex-col gap-5 lg:flex-row">
                <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-700 bg-slate-900">
                  {logoPreview || companyForm.logo_url ? (
                    <img
                      src={logoPreview || companyForm.logo_url}
                      alt="Logo da empresa"
                      className="h-full w-full object-contain"
                      style={{ transform: `scale(${cropScale})` }}
                    />
                  ) : (
                    <span className="px-4 text-center text-sm text-slate-500">Nenhuma logo enviada</span>
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
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800">
                      {companyForm.logo_url || logoPreview ? "Editar logo" : "Enviar logo"}
                    </button>
                    {(companyForm.logo_url || logoPreview) ? (
                      <button type="button" onClick={removeLogo} className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20">
                        Excluir logo
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Ajuste de corte">
                      <input type="range" min="1" max="2.2" step="0.1" value={cropScale} onChange={(event) => setCropScale(Number(event.target.value))} className="w-full accent-emerald-500" />
                    </Field>
                    <Field label="Tamanho final">
                      <input type="range" min="160" max="800" step="20" value={cropSize} onChange={(event) => setCropSize(Number(event.target.value))} className="w-full accent-emerald-500" />
                    </Field>
                  </div>

                  <p className="text-xs text-slate-500">A logo só é enviada quando você salvar o perfil corporativo.</p>
                  {canSaveLogoEdit ? <p className="text-xs text-amber-300">Nova logo pendente de upload.</p> : null}
                </div>
              </div>
            </div>

            <Field label="Cláusulas contratuais padrão">
              <Textarea value={companyForm.contract_terms} onChange={(event) => updateCompanyField("contract_terms", event.target.value)} />
            </Field>

            {renderSaveButton("perfil-corporativo", "Salvar perfil corporativo", saveCompanyTab)}
          </section>
        ) : null}

        {activeTab === "nomenclaturas" ? (
          <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Nomenclaturas</h2>
              <p className="text-sm text-slate-400">Personalize os nomes usados no sistema inteiro.</p>
            </div>

            {renderSaveButton("nomenclaturas", "Salvar nomenclaturas", saveLabelsTab)}

            <div className="space-y-5">
              {LABEL_GROUPS.map((group) => (
                <div key={group.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <h3 className="mb-4 font-medium text-white">{group.title}</h3>
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
          <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Módulos</h2>
              <p className="text-sm text-slate-400">Ative só o que faz sentido para a operação.</p>
            </div>

            {renderSaveButton("modulos", "Salvar módulos", saveModulesTab)}

            <div className="grid gap-4 lg:grid-cols-2">
              {MODULES.map((module) => {
                const enabled = Boolean(preferencesForm.feature_toggles[module.key]);
                return (
                  <div key={module.key} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-medium text-white">{module.title}</h3>
                        <p className="text-sm text-slate-400">{module.description}</p>
                      </div>
                      <ToggleSwitch value={enabled} onChange={(value) => updateFeatureToggle(module.key, value)} activeColor={companyForm.primary_color} />
                    </div>
                  </div>
                );
              })}
            </div>

            {renderSaveButton("modulos", "Salvar módulos", saveModulesTab)}
          </section>
        ) : null}

        {activeTab === "documentos" ? (
          <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Documentos Comerciais</h2>
              <p className="text-sm text-slate-400">Configurações padrão de orçamento, proposta, contrato e rodapés.</p>
            </div>

            {renderSaveButton("documentos", "Salvar documentos comerciais", saveDocumentsTab)}

            <div className="grid gap-4 md:grid-cols-2">
              <ToggleField
                label="Mostrar logo nos orçamentos"
                value={Boolean(preferencesForm.commercial_documents.show_logo_on_quotes)}
                onChange={(value) => updateCommercialDocField("show_logo_on_quotes", value)}
                activeColor={companyForm.primary_color}
              />
              <ToggleField
                label="Mostrar endereço nos orçamentos"
                value={Boolean(preferencesForm.commercial_documents.show_company_address_on_quotes)}
                onChange={(value) => updateCommercialDocField("show_company_address_on_quotes", value)}
                activeColor={companyForm.primary_color}
              />
              <ToggleField
                label="Mostrar contatos nos orçamentos"
                value={Boolean(preferencesForm.commercial_documents.show_company_contacts_on_quotes)}
                onChange={(value) => updateCommercialDocField("show_company_contacts_on_quotes", value)}
                activeColor={companyForm.primary_color}
              />
              <ToggleField
                label="Mostrar assinatura nos orçamentos"
                value={Boolean(preferencesForm.commercial_documents.show_signature_on_quotes)}
                onChange={(value) => updateCommercialDocField("show_signature_on_quotes", value)}
                activeColor={companyForm.primary_color}
              />
            </div>

            <Field label="Texto de abertura do orçamento">
              <Textarea value={String(preferencesForm.commercial_documents.quote_intro_text ?? "")} onChange={(event) => updateCommercialDocField("quote_intro_text", event.target.value)} />
            </Field>

            <Field label="Termos padrão do orçamento">
              <Textarea value={String(preferencesForm.commercial_documents.quote_terms_text ?? "")} onChange={(event) => updateCommercialDocField("quote_terms_text", event.target.value)} />
            </Field>

            <Field label="Contrato padrão">
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
      <span className="block text-sm font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition",
        "placeholder:text-slate-500 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition",
        "focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-[140px] w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition",
        "placeholder:text-slate-500 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20",
        props.className ?? "",
      ].join(" ")}
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
      style={{ backgroundColor: value ? activeColor || "#138946" : "#475569" }}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`} />
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
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <span className="pr-4 text-sm font-medium text-slate-200">{label}</span>
      <ToggleSwitch value={value} onChange={onChange} activeColor={activeColor} />
    </div>
  );
}