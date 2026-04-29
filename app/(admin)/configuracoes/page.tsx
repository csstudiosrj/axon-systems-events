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
  Palette,
  Save,
  Settings,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
type SettingsTab = "perfil" | "nomenclaturas" | "modulos" | "documentos";

interface CompanyForm {
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

type CustomLabels = Record<string, string>;
type FeatureToggles = Record<string, boolean>;
type CommercialDocuments = Record<string, string | boolean>;

interface PreferencesForm {
  custom_labels: CustomLabels;
  feature_toggles: FeatureToggles;
  commercial_documents: CommercialDocuments;
}

interface Toast {
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

// --- VALORES PADRÃO ---
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
};

const MODULES =[
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

// --- FUNÇÕES UTILITÁRIAS ---
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

export default function ConfiguracoesPage() {
  const { companyProfile, systemPreferences, refreshSettings } = useSettings() as any;

  const [activeTab, setActiveTab] = useState<SettingsTab>("perfil");
  const[companyForm, setCompanyForm] = useState<CompanyForm>(DEFAULT_COMPANY_FORM);
  const[preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    custom_labels: { ...DEFAULT_CUSTOM_LABELS },
    feature_toggles: { ...DEFAULT_FEATURE_TOGGLES },
    commercial_documents: { ...DEFAULT_COMMERCIAL_DOCUMENTS },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Estados de Upload de Logo
  const [logoPreview, setLogoPreview] = useState("");
  const[selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Estados de IBGE
  const [states, setStates] = useState<IbgeState[]>([]);
  const[cities, setCities] = useState<IbgeCity[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    if (companyProfile) {
      setCompanyForm({
        company_name: companyProfile.company_name || "",
        cnpj: companyProfile.cnpj || "",
        logo_url: companyProfile.logo_url || "",
        primary_color: companyProfile.primary_color || "#138946",
        contract_terms: companyProfile.contract_terms || "",
        legal_name: companyProfile.legal_name || "",
        trade_name: companyProfile.trade_name || "",
        website: companyProfile.website || "",
        contact_email: companyProfile.contact_email || "",
        phone_landline: companyProfile.phone_landline || "",
        phone_mobile: companyProfile.phone_mobile || "",
        whatsapp_number: companyProfile.whatsapp_number || "",
        zipcode: companyProfile.zipcode || "",
        street: companyProfile.street || "",
        street_number: companyProfile.street_number || "",
        complement: companyProfile.complement || "",
        district: companyProfile.district || "",
        city: companyProfile.city || "",
        state: companyProfile.state || "",
        country: companyProfile.country || "Brasil",
        proposal_footer: companyProfile.proposal_footer || "",
        invoice_footer: companyProfile.invoice_footer || "",
      });
      setLogoPreview(companyProfile.logo_url || "");
    }

    if (systemPreferences) {
      setPreferencesForm({
        custom_labels: { ...DEFAULT_CUSTOM_LABELS, ...(systemPreferences.custom_labels || {}) },
        feature_toggles: { ...DEFAULT_FEATURE_TOGGLES, ...(systemPreferences.feature_toggles || {}) },
        commercial_documents: { ...DEFAULT_COMMERCIAL_DOCUMENTS, ...(systemPreferences.commercial_documents || {}) },
      });
    }
  }, [companyProfile, systemPreferences]);

  useEffect(() => {
    setLoadingStates(true);
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados")
      .then((r) => r.json())
      .then((data: IbgeState[]) => setStates([...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))))
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  },[]);

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
    };
  },[]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const setField = <K extends keyof CompanyForm>(field: K, value: CompanyForm[K]) => {
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  };

  const masked = (field: keyof CompanyForm, fmt: (v: string) => string) => {
    return (e: ChangeEvent<HTMLInputElement>) => setField(field, fmt(e.target.value) as CompanyForm[keyof CompanyForm]);
  };

  // --- LÓGICA DE UPLOAD ---
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
    if (!selectedLogoFile) return companyForm.logo_url;

    const safeName = sanitizeFileName(selectedLogoFile.name.replace(/\.[^.]+$/, "") || "logo");
    const path = `logos/${Date.now()}-${safeName}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("axon-assets")
      .upload(path, selectedLogoFile, { contentType: "image/png", upsert: true });

    if (uploadErr) throw uploadErr;

    const { data } = supabase.storage.from("axon-assets").getPublicUrl(path);
    if (!data.publicUrl) throw new Error("URL pública não gerada.");

    setSelectedLogoFile(null);
    return data.publicUrl;
  };

  // --- LÓGICA DE SALVAMENTO ---
  const saveCompanyProfile = async () => {
    setIsSubmitting(true);
    try {
      const logoUrl = await uploadLogo();
      const payload = { ...companyForm, logo_url: logoUrl };

      const { data: existing } = await supabase.from("company_profile").select("id").limit(1).single();

      if (existing?.id) {
        const { error } = await supabase.from("company_profile").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_profile").insert(payload);
        if (error) throw error;
      }

      await refreshSettings?.();
      showToast("Perfil corporativo salvo com sucesso.", "success");
    } catch (error: any) {
      showToast(`Erro ao salvar perfil: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const savePreferences = async () => {
    setIsSubmitting(true);
    try {
      const { data: existing } = await supabase.from("system_preferences").select("id").limit(1).single();

      if (existing?.id) {
        const { error } = await supabase.from("system_preferences").update(preferencesForm).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_preferences").insert(preferencesForm);
        if (error) throw error;
      }

      await refreshSettings?.();
      showToast("Configurações salvas com sucesso.", "success");
    } catch (error: any) {
      showToast(`Erro ao salvar configurações: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    if (activeTab === "perfil") {
      saveCompanyProfile();
    } else {
      savePreferences();
    }
  };

  return (
    <div className="space-y-6 relative max-w-6xl mx-auto pb-12">
      {/* Toast System */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md shadow-lg flex items-center gap-2 border ${
            toast.type === "success"
              ? "bg-cs-green/10 border-cs-green/20 text-cs-green"
              : toast.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-500"
              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
          }`}
        >
          {toast.type === "success" ? <Check size={18} /> : toast.type === "error" ? <X size={18} /> : <Settings size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Settings className="text-cs-green" size={20} />
            Configurações Globais
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Gerencie o perfil da empresa, módulos ativos e nomenclaturas do sistema.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Salvar Alterações
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface/50 pb-4 overflow-x-auto custom-scrollbar">
        {[
          { id: "perfil", label: "Perfil Corporativo", icon: Building2 },
          { id: "nomenclaturas", label: "Nomenclaturas", icon: Type },
          { id: "modulos", label: "Módulos", icon: LayoutGrid },
          { id: "documentos", label: "Documentos Comerciais", icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SettingsTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-cs-green/10 text-cs-green border border-cs-green/20"
                : "text-text-secondary hover:text-white hover:bg-surface border border-transparent"
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-surface border border-surface/50 rounded-lg p-6">
        {activeTab === "perfil" && (
          <div className="space-y-8">
            {/* Logo e Identidade Visual */}
            <div>
              <h4 className="text-sm font-bold text-white border-b border-surface/50 pb-2 mb-4 flex items-center gap-2">
                <Palette size={16} className="text-cs-gold" /> Identidade Visual
              </h4>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-32 h-32 rounded-lg border border-dashed border-surface/50 bg-background flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs text-text-secondary text-center px-4">Nenhuma logo</span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => selectLogo(e.target.files?.[0])}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs flex items-center gap-1 bg-surface border border-surface/50 px-3 py-1.5 rounded hover:bg-background transition-colors text-white"
                    >
                      <Upload size={14} /> {logoPreview ? "Trocar" : "Enviar"}
                    </button>
                    {logoPreview && (
                      <button
                        onClick={removeLogo}
                        className="text-xs flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1.5 rounded hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-4 w-full">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Cor Primária (Hexadecimal)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={companyForm.primary_color}
                        onChange={(e) => setField("primary_color", e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <input
                        type="text"
                        value={companyForm.primary_color}
                        onChange={(e) => setField("primary_color", e.target.value)}
                        className="block w-full max-w-xs rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dados da Empresa */}
            <div>
              <h4 className="text-sm font-bold text-white border-b border-surface/50 pb-2 mb-4 flex items-center gap-2">
                <Building2 size={16} className="text-cs-green" /> Dados da Empresa
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    value={companyForm.trade_name}
                    onChange={(e) => setField("trade_name", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Razão Social</label>
                  <input
                    type="text"
                    value={companyForm.legal_name}
                    onChange={(e) => setField("legal_name", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={companyForm.cnpj}
                    onChange={masked("cnpj", formatCnpj)}
                    placeholder="00.000.000/0000-00"
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">E-mail de Contato</label>
                  <input
                    type="email"
                    value={companyForm.contact_email}
                    onChange={(e) => setField("contact_email", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Telefone Fixo</label>
                  <input
                    type="text"
                    value={companyForm.phone_landline}
                    onChange={masked("phone_landline", formatPhone)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={companyForm.whatsapp_number}
                    onChange={masked("whatsapp_number", formatPhone)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Website</label>
                  <input
                    type="text"
                    value={companyForm.website}
                    onChange={(e) => setField("website", e.target.value)}
                    placeholder="https://..."
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h4 className="text-sm font-bold text-white border-b border-surface/50 pb-2 mb-4">Endereço</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">CEP</label>
                  <input
                    type="text"
                    value={companyForm.zipcode}
                    onChange={masked("zipcode", formatCep)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Logradouro</label>
                  <input
                    type="text"
                    value={companyForm.street}
                    onChange={(e) => setField("street", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Número</label>
                  <input
                    type="text"
                    value={companyForm.street_number}
                    onChange={(e) => setField("street_number", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Complemento</label>
                  <input
                    type="text"
                    value={companyForm.complement}
                    onChange={(e) => setField("complement", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Bairro</label>
                  <input
                    type="text"
                    value={companyForm.district}
                    onChange={(e) => setField("district", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Estado</label>
                  <select
                    value={companyForm.state}
                    onChange={(e) => {
                      setField("state", e.target.value);
                      setField("city", "");
                    }}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer"
                  >
                    <option value="">Selecione</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.sigla}>
                        {s.nome} ({s.sigla})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Cidade</label>
                  <select
                    value={companyForm.city}
                    onChange={(e) => setField("city", e.target.value)}
                    disabled={!companyForm.state || loadingCities}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Selecione</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "nomenclaturas" && (
          <div className="space-y-6">
            <p className="text-sm text-text-secondary mb-4">
              Personalize como os menus e entidades são chamados no sistema para se adequar ao vocabulário da sua operação.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.keys(DEFAULT_CUSTOM_LABELS).map((key) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {key.replace("menu_", "Menu: ").replace("entity_", "Entidade: ").replace(/_/g, " ")}
                  </label>
                  <input
                    type="text"
                    value={preferencesForm.custom_labels[key] || ""}
                    onChange={(e) =>
                      setPreferencesForm((prev) => ({
                        ...prev,
                        custom_labels: { ...prev.custom_labels, [key]: e.target.value },
                      }))
                    }
                    placeholder={DEFAULT_CUSTOM_LABELS[key]}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "modulos" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODULES.map((mod) => {
              const isActive = preferencesForm.feature_toggles[mod.key] ?? true;
              return (
                <div key={mod.key} className="flex items-center justify-between p-4 bg-background border border-surface/50 rounded-lg">
                  <div>
                    <h5 className="text-sm font-bold text-white">{mod.title}</h5>
                    <p className="text-xs text-text-secondary mt-0.5">{mod.desc}</p>
                  </div>
                  <button
                    onClick={() =>
                      setPreferencesForm((prev) => ({
                        ...prev,
                        feature_toggles: { ...prev.feature_toggles, [mod.key]: !isActive },
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isActive ? "bg-cs-green" : "bg-surface"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "show_logo_on_quotes", label: "Exibir Logo nos Orçamentos" },
                { key: "show_company_address_on_quotes", label: "Exibir Endereço nos Orçamentos" },
                { key: "show_company_contacts_on_quotes", label: "Exibir Contatos nos Orçamentos" },
                { key: "show_signature_on_quotes", label: "Exibir Campo de Assinatura" },
              ].map((toggle) => {
                const isActive = Boolean(preferencesForm.commercial_documents[toggle.key]);
                return (
                  <div key={toggle.key} className="flex items-center justify-between p-4 bg-background border border-surface/50 rounded-lg">
                    <span className="text-sm font-medium text-white">{toggle.label}</span>
                    <button
                      onClick={() =>
                        setPreferencesForm((prev) => ({
                          ...prev,
                          commercial_documents: { ...prev.commercial_documents, [toggle.key]: !isActive },
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isActive ? "bg-cs-green" : "bg-surface"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isActive ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Texto de Abertura Padrão (Orçamentos)</label>
                <textarea
                  rows={3}
                  value={String(preferencesForm.commercial_documents.quote_intro_text || "")}
                  onChange={(e) =>
                    setPreferencesForm((prev) => ({
                      ...prev,
                      commercial_documents: { ...prev.commercial_documents, quote_intro_text: e.target.value },
                    }))
                  }
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Termos e Condições Padrão (Orçamentos)</label>
                <textarea
                  rows={4}
                  value={String(preferencesForm.commercial_documents.quote_terms_text || "")}
                  onChange={(e) =>
                    setPreferencesForm((prev) => ({
                      ...prev,
                      commercial_documents: { ...prev.commercial_documents, quote_terms_text: e.target.value },
                    }))
                  }
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Cláusulas Contratuais Padrão</label>
                <textarea
                  rows={5}
                  value={companyForm.contract_terms}
                  onChange={(e) => setField("contract_terms", e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Rodapé de Propostas (PDF)</label>
                  <textarea
                    rows={2}
                    value={companyForm.proposal_footer}
                    onChange={(e) => setField("proposal_footer", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Rodapé de Faturas (PDF)</label>
                  <textarea
                    rows={2}
                    value={companyForm.invoice_footer}
                    onChange={(e) => setField("invoice_footer", e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}