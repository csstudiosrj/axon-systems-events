"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";

type SettingsTab = "perfil-corporativo" | "nomenclaturas" | "modulos" | "documentos";

type CompanyForm = {
  company_name: string;
  legal_name: string;
  trade_name: string;
  cnpj: string;
  website: string;
  contact_email: string;
  phone_landline: string;
  phone_mobile: string;
  whatsapp_number: string;
  logo_url: string;
  primary_color: string;
  zipcode: string;
  street: string;
  street_number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  country: string;
  contract_terms: string;
  proposal_footer: string;
  invoice_footer: string;
};

type PreferencesForm = {
  custom_labels: Record<string, string>;
  feature_toggles: Record<string, boolean>;
  commercial_documents: Record<string, string | boolean>;
};

const DEFAULT_COMPANY_FORM: CompanyForm = {
  company_name: "",
  legal_name: "",
  trade_name: "",
  cnpj: "",
  website: "",
  contact_email: "",
  phone_landline: "",
  phone_mobile: "",
  whatsapp_number: "",
  logo_url: "",
  primary_color: "#138946",
  zipcode: "",
  street: "",
  street_number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  country: "Brasil",
  contract_terms: "",
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
];

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
];

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function buildThemeColorCss(color: string) {
  return `:root{--primary-brand:${color};}`;
}

export default function ConfiguracoesPage() {
  const {
    companyProfile,
    systemPreferences,
    refreshSettings,
    setToast,
  } = useSettings() as any;

  const [activeTab, setActiveTab] = useState<SettingsTab>("perfil-corporativo");
  const [companyForm, setCompanyForm] = useState<CompanyForm>(DEFAULT_COMPANY_FORM);
  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    custom_labels: DEFAULT_CUSTOM_LABELS,
    feature_toggles: DEFAULT_FEATURE_TOGGLES,
    commercial_documents: DEFAULT_COMMERCIAL_DOCUMENTS,
  });
  const [savingTab, setSavingTab] = useState<SettingsTab | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropSize, setCropSize] = useState(320);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCompanyForm({
      ...DEFAULT_COMPANY_FORM,
      ...companyProfile,
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
      commercial_documents: {
        ...DEFAULT_COMMERCIAL_DOCUMENTS,
        ...(systemPreferences?.commercial_documents ?? {}),
      },
    });
  }, [companyProfile, systemPreferences]);

  useEffect(() => {
    const color = companyForm.primary_color || "#138946";
    const styleTagId = "company-theme-preview";
    let styleTag = document.getElementById(styleTagId);
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleTagId;
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = buildThemeColorCss(color);
    return () => {
      const existing = document.getElementById(styleTagId);
      if (existing) existing.innerHTML = "";
    };
  }, [companyForm.primary_color]);

  const canSaveLogoEdit = useMemo(() => !!selectedLogoFile, [selectedLogoFile]);

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

  function handleSelectLogo(file?: File | null) {
    if (!file) return;
    setSelectedLogoFile(file);
    const localUrl = URL.createObjectURL(file);
    setLogoPreview(localUrl);
  }

  async function uploadProcessedLogo() {
    if (!selectedLogoFile) return companyForm.logo_url;

    setUploadingLogo(true);
    try {
      const img = document.createElement("img");
      const tempUrl = URL.createObjectURL(selectedLogoFile);
      img.src = tempUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const size = cropSize;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível preparar a imagem.");

      const shortestSide = Math.min(img.width, img.height);
      const sourceSize = shortestSide / cropScale;
      const sx = (img.width - sourceSize) / 2;
      const sy = (img.height - sourceSize) / 2;
      ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (!blob) throw new Error("Não foi possível gerar a imagem final.");

      const safeName = sanitizeFileName(selectedLogoFile.name.replace(/\.[^.]+$/, ""));
      const filePath = `logos/${Date.now()}-${safeName}.png`;
      const { error: uploadError } = await supabase.storage
        .from("axon-assets")
        .upload(filePath, blob, {
          upsert: true,
          contentType: "image/png",
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("axon-assets").getPublicUrl(filePath);
      const publicUrl = data?.publicUrl ?? "";
      setCompanyForm((prev) => ({ ...prev, logo_url: publicUrl }));
      setLogoPreview(publicUrl);
      setSelectedLogoFile(null);
      URL.revokeObjectURL(tempUrl);
      return publicUrl;
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    updateCompanyField("logo_url", "");
    setLogoPreview("");
    setSelectedLogoFile(null);
    setToast?.({ title: "Logo removida", description: "A logo foi removida da configuração atual." });
  }

  async function saveCompanyTab() {
    setSavingTab("perfil-corporativo");
    try {
      const logoUrl = await uploadProcessedLogo();
      const payload = {
        ...companyForm,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      };

      const currentId = companyProfile?.id;
      const query = currentId
        ? supabase.from("company_profile").update(payload).eq("id", currentId)
        : supabase.from("company_profile").insert(payload);

      const { error } = await query;
      if (error) throw error;

      await refreshSettings?.();
      setToast?.({ title: "Perfil salvo", description: "As informações da empresa foram atualizadas." });
    } catch (error: any) {
      setToast?.({ title: "Erro ao salvar", description: error?.message || "Não foi possível salvar o perfil corporativo." });
    } finally {
      setSavingTab(null);
    }
  }

  async function saveLabelsTab() {
    setSavingTab("nomenclaturas");
    try {
      const payload = {
        custom_labels: preferencesForm.custom_labels,
        feature_toggles: preferencesForm.feature_toggles,
        commercial_documents: preferencesForm.commercial_documents,
      };

      const currentId = systemPreferences?.id;
      const query = currentId
        ? supabase.from("system_preferences").update(payload).eq("id", currentId)
        : supabase.from("system_preferences").insert(payload);

      const { error } = await query;
      if (error) throw error;

      await refreshSettings?.();
      setToast?.({ title: "Nomenclaturas salvas", description: "Os nomes do sistema foram atualizados." });
    } catch (error: any) {
      setToast?.({ title: "Erro ao salvar", description: error?.message || "Não foi possível salvar as nomenclaturas." });
    } finally {
      setSavingTab(null);
    }
  }

  async function saveModulesTab() {
    setSavingTab("modulos");
    try {
      const payload = {
        custom_labels: preferencesForm.custom_labels,
        feature_toggles: preferencesForm.feature_toggles,
        commercial_documents: preferencesForm.commercial_documents,
      };

      const currentId = systemPreferences?.id;
      const query = currentId
        ? supabase.from("system_preferences").update(payload).eq("id", currentId)
        : supabase.from("system_preferences").insert(payload);

      const { error } = await query;
      if (error) throw error;

      await refreshSettings?.();
      setToast?.({ title: "Módulos salvos", description: "A disponibilidade dos módulos foi atualizada." });
    } catch (error: any) {
      setToast?.({ title: "Erro ao salvar", description: error?.message || "Não foi possível salvar os módulos." });
    } finally {
      setSavingTab(null);
    }
  }

  async function saveDocumentsTab() {
    setSavingTab("documentos");
    try {
      const companyPayload = {
        contract_terms: companyForm.contract_terms,
        proposal_footer: companyForm.proposal_footer,
        invoice_footer: companyForm.invoice_footer,
        updated_at: new Date().toISOString(),
      };

      const companyQuery = companyProfile?.id
        ? supabase.from("company_profile").update(companyPayload).eq("id", companyProfile.id)
        : supabase.from("company_profile").insert({ ...DEFAULT_COMPANY_FORM, ...companyPayload });

      const { error: companyError } = await companyQuery;
      if (companyError) throw companyError;

      const preferencesPayload = {
        custom_labels: preferencesForm.custom_labels,
        feature_toggles: preferencesForm.feature_toggles,
        commercial_documents: preferencesForm.commercial_documents,
      };

      const preferencesQuery = systemPreferences?.id
        ? supabase.from("system_preferences").update(preferencesPayload).eq("id", systemPreferences.id)
        : supabase.from("system_preferences").insert(preferencesPayload);

      const { error: preferencesError } = await preferencesQuery;
      if (preferencesError) throw preferencesError;

      await refreshSettings?.();
      setToast?.({ title: "Documentos salvos", description: "As configurações comerciais foram atualizadas." });
    } catch (error: any) {
      setToast?.({ title: "Erro ao salvar", description: error?.message || "Não foi possível salvar os documentos." });
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
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: companyForm.primary_color || "#138946" }}
        >
          {loading ? "Salvando..." : label}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Personalização do sistema</h1>
        <p className="mt-1 text-sm text-slate-600">Ajuste a identidade, os nomes, os módulos e os documentos usados no dia a dia.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          ["perfil-corporativo", "Perfil Corporativo"],
          ["nomenclaturas", "Nomenclaturas"],
          ["modulos", "Módulos"],
          ["documentos", "Documentos Comerciais"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as SettingsTab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === key ? "text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            style={activeTab === key ? { backgroundColor: companyForm.primary_color || "#138946" } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "perfil-corporativo" && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Perfil Corporativo</h2>
            <p className="text-sm text-slate-600">Esses dados podem ser usados em propostas, contratos, faturas e demais materiais do sistema.</p>
          </div>

          {renderSaveButton("perfil-corporativo", "Salvar perfil corporativo", saveCompanyTab)}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome exibido da empresa">
              <input value={companyForm.company_name} onChange={(e) => updateCompanyField("company_name", e.target.value)} className="input" />
            </Field>
            <Field label="Nome fantasia">
              <input value={companyForm.trade_name} onChange={(e) => updateCompanyField("trade_name", e.target.value)} className="input" />
            </Field>
            <Field label="Razão social">
              <input value={companyForm.legal_name} onChange={(e) => updateCompanyField("legal_name", e.target.value)} className="input" />
            </Field>
            <Field label="CNPJ">
              <input value={companyForm.cnpj} onChange={(e) => updateCompanyField("cnpj", e.target.value)} className="input" />
            </Field>
            <Field label="Site">
              <input value={companyForm.website} onChange={(e) => updateCompanyField("website", e.target.value)} className="input" placeholder="https://..." />
            </Field>
            <Field label="E-mail de contato">
              <input value={companyForm.contact_email} onChange={(e) => updateCompanyField("contact_email", e.target.value)} className="input" />
            </Field>
            <Field label="Telefone fixo">
              <input value={companyForm.phone_landline} onChange={(e) => updateCompanyField("phone_landline", e.target.value)} className="input" />
            </Field>
            <Field label="Celular">
              <input value={companyForm.phone_mobile} onChange={(e) => updateCompanyField("phone_mobile", e.target.value)} className="input" />
            </Field>
            <Field label="WhatsApp">
              <input value={companyForm.whatsapp_number} onChange={(e) => updateCompanyField("whatsapp_number", e.target.value)} className="input" />
            </Field>
            <Field label="Cor principal do sistema">
              <div className="flex items-center gap-3">
                <input type="color" value={companyForm.primary_color} onChange={(e) => updateCompanyField("primary_color", e.target.value)} className="h-11 w-16 rounded border border-slate-300 bg-white p-1" />
                <input value={companyForm.primary_color} onChange={(e) => updateCompanyField("primary_color", e.target.value)} className="input" />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="CEP">
              <input value={companyForm.zipcode} onChange={(e) => updateCompanyField("zipcode", e.target.value)} className="input" />
            </Field>
            <Field label="Cidade">
              <input value={companyForm.city} onChange={(e) => updateCompanyField("city", e.target.value)} className="input" />
            </Field>
            <Field label="Estado">
              <input value={companyForm.state} onChange={(e) => updateCompanyField("state", e.target.value)} className="input" />
            </Field>
            <Field label="Endereço">
              <input value={companyForm.street} onChange={(e) => updateCompanyField("street", e.target.value)} className="input" />
            </Field>
            <Field label="Número">
              <input value={companyForm.street_number} onChange={(e) => updateCompanyField("street_number", e.target.value)} className="input" />
            </Field>
            <Field label="Complemento">
              <input value={companyForm.complement} onChange={(e) => updateCompanyField("complement", e.target.value)} className="input" />
            </Field>
            <Field label="Bairro">
              <input value={companyForm.district} onChange={(e) => updateCompanyField("district", e.target.value)} className="input" />
            </Field>
            <Field label="País">
              <input value={companyForm.country} onChange={(e) => updateCompanyField("country", e.target.value)} className="input" />
            </Field>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <h3 className="font-medium text-slate-900">Logo da empresa</h3>
              <p className="text-sm text-slate-600">No primeiro envio você já pode ajustar corte e tamanho. Depois disso, pode editar ou excluir.</p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
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
                    onChange={(e) => handleSelectLogo(e.target.files?.[0] ?? null)}
                  />
                  <button type="button" className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
                    {companyForm.logo_url || logoPreview ? "Editar logo" : "Enviar logo"}
                  </button>
                  {(companyForm.logo_url || logoPreview) && (
                    <button type="button" className="secondary-btn" onClick={removeLogo}>
                      Excluir logo
                    </button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Ajuste de corte">
                    <input type="range" min="1" max="2.2" step="0.1" value={cropScale} onChange={(e) => setCropScale(Number(e.target.value))} className="w-full" />
                  </Field>
                  <Field label="Tamanho final">
                    <input type="range" min="160" max="800" step="20" value={cropSize} onChange={(e) => setCropSize(Number(e.target.value))} className="w-full" />
                  </Field>
                </div>

                <p className="text-xs text-slate-500">A imagem final será enviada já ajustada para uso no sistema.</p>
                {canSaveLogoEdit && <p className="text-xs text-amber-600">Você selecionou uma nova logo. Salve o perfil para concluir o envio.</p>}
              </div>
            </div>
          </div>

          {renderSaveButton("perfil-corporativo", "Salvar perfil corporativo", saveCompanyTab)}
        </div>
      )}

      {activeTab === "nomenclaturas" && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Nomenclaturas</h2>
            <p className="text-sm text-slate-600">Escolha os termos que melhor representam o seu negócio para refletir isso no sistema inteiro.</p>
          </div>

          {renderSaveButton("nomenclaturas", "Salvar nomenclaturas", saveLabelsTab)}

          <div className="space-y-6">
            {LABEL_GROUPS.map((group) => (
              <div key={group.title} className="space-y-4 rounded-xl border border-slate-200 p-4">
                <h3 className="font-medium text-slate-900">{group.title}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {group.fields.map((field) => (
                    <Field key={field} label={field.replace(/_/g, " ")}>
                      <input
                        value={preferencesForm.custom_labels[field] ?? ""}
                        onChange={(e) => updateLabelField(field, e.target.value)}
                        className="input"
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {renderSaveButton("nomenclaturas", "Salvar nomenclaturas", saveLabelsTab)}
        </div>
      )}

      {activeTab === "modulos" && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Módulos</h2>
            <p className="text-sm text-slate-600">Ative apenas o que fará parte da operação do cliente para manter o sistema direto e objetivo.</p>
          </div>

          {renderSaveButton("modulos", "Salvar módulos", saveModulesTab)}

          <div className="grid gap-4 md:grid-cols-2">
            {MODULES.map((module) => {
              const enabled = !!preferencesForm.feature_toggles[module.key];
              return (
                <div key={module.key} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-medium text-slate-900">{module.title}</h3>
                      <p className="text-sm text-slate-600">{module.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateFeatureToggle(module.key, !enabled)}
                      className={`relative h-7 w-12 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                      aria-pressed={enabled}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {renderSaveButton("modulos", "Salvar módulos", saveModulesTab)}
        </div>
      )}

      {activeTab === "documentos" && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Documentos Comerciais</h2>
            <p className="text-sm text-slate-600">Defina o conteúdo padrão e as informações que devem aparecer em orçamentos, propostas, contratos e documentos do processo comercial.</p>
          </div>

          {renderSaveButton("documentos", "Salvar documentos comerciais", saveDocumentsTab)}

          <div className="grid gap-4 md:grid-cols-2">
            <ToggleField
              label="Mostrar logo nos orçamentos"
              value={!!preferencesForm.commercial_documents.show_logo_on_quotes}
              onChange={(value) => updateCommercialDocField("show_logo_on_quotes", value)}
            />
            <ToggleField
              label="Mostrar endereço nos orçamentos"
              value={!!preferencesForm.commercial_documents.show_company_address_on_quotes}
              onChange={(value) => updateCommercialDocField("show_company_address_on_quotes", value)}
            />
            <ToggleField
              label="Mostrar contatos nos orçamentos"
              value={!!preferencesForm.commercial_documents.show_company_contacts_on_quotes}
              onChange={(value) => updateCommercialDocField("show_company_contacts_on_quotes", value)}
            />
            <ToggleField
              label="Mostrar assinatura nos orçamentos"
              value={!!preferencesForm.commercial_documents.show_signature_on_quotes}
              onChange={(value) => updateCommercialDocField("show_signature_on_quotes", value)}
            />
          </div>

          <Field label="Texto de abertura do orçamento">
            <textarea value={String(preferencesForm.commercial_documents.quote_intro_text ?? "")} onChange={(e) => updateCommercialDocField("quote_intro_text", e.target.value)} className="textarea" />
          </Field>

          <Field label="Termos padrão do orçamento">
            <textarea value={String(preferencesForm.commercial_documents.quote_terms_text ?? "")} onChange={(e) => updateCommercialDocField("quote_terms_text", e.target.value)} className="textarea" />
          </Field>

          <Field label="Contrato padrão">
            <textarea value={companyForm.contract_terms} onChange={(e) => updateCompanyField("contract_terms", e.target.value)} className="textarea" />
          </Field>

          <Field label="Modelo de proposta">
            <textarea value={String(preferencesForm.commercial_documents.default_proposal_template ?? "")} onChange={(e) => updateCommercialDocField("default_proposal_template", e.target.value)} className="textarea" />
          </Field>

          <Field label="Rodapé de proposta">
            <textarea value={companyForm.proposal_footer} onChange={(e) => updateCompanyField("proposal_footer", e.target.value)} className="textarea" />
          </Field>

          <Field label="Rodapé de fatura">
            <textarea value={companyForm.invoice_footer} onChange={(e) => updateCompanyField("invoice_footer", e.target.value)} className="textarea" />
          </Field>

          <Field label="Observações operacionais padrão">
            <textarea value={String(preferencesForm.commercial_documents.default_operational_notes ?? "")} onChange={(e) => updateCommercialDocField("default_operational_notes", e.target.value)} className="textarea" />
          </Field>

          {renderSaveButton("documentos", "Salvar documentos comerciais", saveDocumentsTab)}
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #cbd5e1;
          background: white;
          padding: 0.7rem 0.9rem;
          font-size: 0.95rem;
          color: #0f172a;
        }
        .input:focus,
        .textarea:focus {
          outline: none;
          border-color: ${companyForm.primary_color || "#138946"};
          box-shadow: 0 0 0 3px color-mix(in srgb, ${companyForm.primary_color || "#138946"} 18%, transparent);
        }
        .textarea {
          min-height: 140px;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #cbd5e1;
          background: white;
          padding: 0.9rem;
          font-size: 0.95rem;
          color: #0f172a;
        }
        .secondary-btn {
          border-radius: 0.75rem;
          border: 1px solid #cbd5e1;
          background: white;
          padding: 0.65rem 0.95rem;
          font-size: 0.9rem;
          font-weight: 500;
          color: #0f172a;
        }
        .secondary-btn:hover {
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 rounded-full transition ${value ? "bg-emerald-500" : "bg-slate-300"}`}
        aria-pressed={value}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}