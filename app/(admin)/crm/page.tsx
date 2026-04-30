"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  ArrowLeft,
  DollarSign,
  FileOutput,
  FileText,
  GripVertical,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  Phone,
  Plus,
  Save,
  Target,
  Trash2,
  X,
} from "lucide-react";

type LeadStatus = "new" | "contacted" | "proposal" | "negotiation" | "won" | "lost";

interface Lead {
  id: string;
  client_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  event_type: string | null;
  event_date: string | null;
  estimated_budget: number | null;
  notes: string | null;
  status: LeadStatus | string | null;
  created_at?: string | null;
}

interface CustomLabels {
  menu_crm?: string;
  entity_client_singular?: string;
  entity_client_plural?: string;
  entity_lead_singular?: string;
  entity_lead_plural?: string;
  entity_quote_singular?: string;
  entity_quote_plural?: string;
  entity_proposal_singular?: string;
  entity_proposal_plural?: string;
  entity_salesperson_singular?: string;
  entity_salesperson_plural?: string;
  [key: string]: string | undefined;
}

interface CompanyProfileRecord {
  company_name?: string | null;
  primary_color?: string | null;
}

interface SystemPreferencesRecord {
  custom_labels?: CustomLabels | null;
}

interface SettingsContextShape {
  companyProfile?: CompanyProfileRecord | null;
  systemPreferences?: SystemPreferencesRecord | null;
}

const STATUS_COLUMNS: Array<{
  id: LeadStatus;
  title: (labels: CustomLabels) => string;
  colorClass: string;
}> = [
  {
    id: "new",
    title: (labels) => `Novos ${labels.entity_lead_plural || "Leads"}`,
    colorClass: "text-blue-400",
  },
  {
    id: "contacted",
    title: () => "Em Contato",
    colorClass: "text-purple-400",
  },
  {
    id: "proposal",
    title: (labels) => `${labels.entity_quote_singular || "Orçamento"} Enviado`,
    colorClass: "text-yellow-400",
  },
  {
    id: "negotiation",
    title: () => "Em Negociação",
    colorClass: "text-cs-gold",
  },
  {
    id: "won",
    title: () => "Fechado (Ganho)",
    colorClass: "text-cs-green",
  },
  {
    id: "lost",
    title: () => "Perdido",
    colorClass: "text-red-400",
  },
];

function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getErrorMessage(error: any) {
  console.error("🔥 ERRO DO SUPABASE:", error);
  if (error?.message) return error.message;
  if (error?.details) return error.details;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

export default function CRMPage() {
  const router = useRouter();
  const { companyProfile, systemPreferences } = useSettings() as SettingsContextShape;

  const labels = systemPreferences?.custom_labels ?? {};
  const leadSingular = labels.entity_lead_singular || "Lead";
  const leadPlural = labels.entity_lead_plural || "Leads";
  const clientSingular = labels.entity_client_singular || "Cliente";
  const clientPlural = labels.entity_client_plural || "Clientes";
  const quoteSingular = labels.entity_quote_singular || "Orçamento";
  const quotePlural = labels.entity_quote_plural || "Orçamentos";
  const crmTitle = labels.menu_crm || "CRM / Vendas";

  const [viewMode, setViewMode] = useState<"board" | "create">("board");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [compactView, setCompactView] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("new");

  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLeads([]);
      setLoading(false);
      return;
    }

    setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setEditingLeadId(null);
    setClientName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setEventType("");
    setEventDate("");
    setEstimatedBudget("");
    setNotes("");
    setLeadStatus("new");
  };

  const openCreateMode = () => {
    resetForm();
    setViewMode("create");
  };

  const openBoardMode = () => {
    resetForm();
    setViewMode("board");
  };

  const openEditModal = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setClientName(lead.client_name || "");
    setCompanyName(lead.company_name || "");
    setEmail(lead.email || "");
    setPhone(lead.phone || "");
    setEventType(lead.event_type || "");
    setEventDate(lead.event_date ? lead.event_date.slice(0, 10) : "");
    setEstimatedBudget(lead.estimated_budget ? String(lead.estimated_budget) : "");
    setNotes(lead.notes || "");
    setLeadStatus((lead.status as LeadStatus) || "new");
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      alert(`Preencha o nome do ${clientSingular.toLowerCase()}.`);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      client_name: clientName || null,
      company_name: companyName || null,
      email: email || null,
      phone: phone || null,
      event_type: eventType || null,
      event_date: eventDate || null,
      estimated_budget: estimatedBudget ? Number(estimatedBudget) : null,
      notes: notes || null,
      status: leadStatus,
    };

    try {
      if (editingLeadId) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editingLeadId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert([payload]);
        if (error) throw error;
      }

      await fetchLeads();
      openBoardMode();
    } catch (error) {
      alert(`Erro ao salvar ${leadSingular.toLowerCase()}: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!editingLeadId) return;

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir este ${leadSingular.toLowerCase()}?`
    );

    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("leads").delete().eq("id", editingLeadId);
      if (error) throw error;

      await fetchLeads();
      resetForm();
    } catch (error) {
      alert(`Erro ao excluir ${leadSingular.toLowerCase()}: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToQuote = async () => {
    if (!editingLeadId) return;

    setIsConverting(true);

    try {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("company_name", companyName || clientName)
        .limit(1)
        .maybeSingle();

      let clientId = existingClient?.id;

      if (!clientId) {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert([
            {
              company_name: companyName || clientName,
              contact_name: clientName || null,
              email: email || null,
              phone: phone || null,
              document: "00000000000000",
            },
          ])
          .select("id")
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      }

      const { error: quoteError } = await supabase.from("quotes").insert([
        {
          client_id: clientId,
          title: eventType
            ? `${quoteSingular} - ${eventType}`
            : `${quoteSingular} - ${clientName || companyName}`,
          status: "draft",
        },
      ]);

      if (quoteError) throw quoteError;

      const { error: leadError } = await supabase
        .from("leads")
        .update({ status: "proposal" })
        .eq("id", editingLeadId);

      if (leadError) throw leadError;

      await fetchLeads();
      resetForm();
      router.push("/orcamentos");
    } catch (error) {
      alert(`Erro ao converter em ${quoteSingular.toLowerCase()}: ${getErrorMessage(error)}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, leadId: string) => {
    event.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOverBoard = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const leftEdge = rect.left + 120;
    const rightEdge = rect.right - 120;

    if (event.clientX < leftEdge) {
      boardRef.current.scrollLeft -= 18;
    } else if (event.clientX > rightEdge) {
      boardRef.current.scrollLeft += 18;
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, newStatus: LeadStatus) => {
    event.preventDefault();

    const leadId = event.dataTransfer.getData("leadId");
    if (!leadId) return;

    const previous = [...leads];
    const updated = leads.map((lead) =>
      lead.id === leadId ? { ...lead, status: newStatus } : lead
    );
    setLeads(updated);

    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);

    if (error) {
      console.error(error);
      setLeads(previous);
      alert(`Erro ao mover ${leadSingular.toLowerCase()}: ${getErrorMessage(error)}`);
    }
  };

  const groupedColumns = STATUS_COLUMNS.map((column) => ({
    ...column,
    cards: leads.filter((lead) => (lead.status || "new") === column.id),
  }));

  if (viewMode === "create") {
    return (
      <div className="relative mx-auto max-w-5xl space-y-6 pb-12">
        <div className="flex items-center justify-between rounded-lg border border-surface/50 bg-surface p-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium text-white">
              <Target className="text-cs-green" size={20} />
              Novo {leadSingular}
            </h3>
            <p className="mt-1 text-xs text-text-secondary">
              Cadastre um novo {leadSingular.toLowerCase()} no funil comercial.
            </p>
          </div>

          <button
            type="button"
            onClick={openBoardMode}
            className="flex items-center gap-2 rounded-md border border-surface/50 bg-background px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>

        <div className="rounded-lg border border-surface/50 bg-surface p-6">
          <form onSubmit={handleSaveLead} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Nome do contato
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  placeholder={`Nome do ${clientSingular.toLowerCase()}`}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Empresa / Instituição
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  placeholder={`Nome do ${clientSingular.toLowerCase()} ou empresa`}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  placeholder="contato@email.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  placeholder="(21) 99999-9999"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Tipo de evento
                </label>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  placeholder="Festival, show, feira..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Data do evento
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {quoteSingular} estimado
                </label>
                <input
                  type="number"
                  value={estimatedBudget}
                  onChange={(e) => setEstimatedBudget(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Status inicial
                </label>
                <select
                  value={leadStatus}
                  onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}
                  className="block w-full cursor-pointer rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                >
                  {STATUS_COLUMNS.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.title(labels)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Observações comerciais
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="block w-full resize-none rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  placeholder={`Contexto, briefing e necessidades do ${clientSingular.toLowerCase()}.`}
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-surface/50 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md bg-cs-green px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar {leadSingular}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-full max-w-[calc(100vw-2rem)] flex-col space-y-6 pb-6">
      <div className="flex items-center justify-between rounded-lg border border-surface/50 bg-surface p-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-medium text-white">
            <Target className="text-cs-green" size={20} />
            {crmTitle}
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            Gerencie {leadPlural.toLowerCase()}, andamento comercial e conversão em {quotePlural.toLowerCase()}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCompactView((prev) => !prev)}
            className="flex items-center gap-2 rounded-md border border-surface/50 bg-background px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface"
          >
            {compactView ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            {compactView ? "Expandir" : "Compactar"}
          </button>

          <button
            type="button"
            onClick={openCreateMode}
            className="flex items-center gap-2 rounded-md bg-cs-green px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-opacity-90"
          >
            <Plus size={18} />
            Novo {leadSingular}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-surface/50 bg-surface p-10">
          <Loader2 className="animate-spin text-cs-green" size={32} />
        </div>
      ) : (
        <div
          ref={boardRef}
          onDragOver={handleDragOverBoard}
          className="custom-scrollbar flex flex-1 gap-4 overflow-x-auto pb-2"
        >
          {groupedColumns.map((column) => (
            <div
              key={column.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void handleDrop(e, column.id)}
              className="flex h-full min-w-[320px] max-w-[320px] flex-col rounded-lg border border-surface/50 bg-surface"
            >
              <div className="flex items-center justify-between border-b border-surface/50 p-4">
                <div>
                  <h4 className={`text-sm font-bold ${column.colorClass}`}>{column.title(labels)}</h4>
                  <p className="mt-1 text-xs text-text-secondary">
                    {column.cards.length} item(ns)
                  </p>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
                {column.cards.length === 0 ? (
                  <div className="rounded-md border border-dashed border-surface/50 bg-background p-4 text-xs text-text-secondary">
                    Nenhum {leadSingular.toLowerCase()} nesta etapa.
                  </div>
                ) : (
                  column.cards.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onClick={() => openEditModal(lead)}
                      className="cursor-pointer rounded-md border border-surface/50 bg-background p-4 transition-colors hover:border-cs-green/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="text-sm font-semibold text-white">
                            {lead.client_name || `Sem nome de ${clientSingular.toLowerCase()}`}
                          </h5>
                          {lead.company_name && (
                            <p className="mt-1 text-xs text-text-secondary">{lead.company_name}</p>
                          )}
                        </div>

                        <GripVertical size={14} className="mt-1 shrink-0 text-text-secondary" />
                      </div>

                      {!compactView && (
                        <div className="mt-3 space-y-2">
                          {lead.event_type && (
                            <p className="text-xs text-cs-gold">{lead.event_type}</p>
                          )}

                          {lead.phone && (
                            <div className="flex items-center gap-2 text-xs text-text-secondary">
                              <Phone size={12} />
                              <span>{lead.phone}</span>
                            </div>
                          )}

                          {lead.email && (
                            <div className="flex items-center gap-2 text-xs text-text-secondary">
                              <Mail size={12} />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}

                          {typeof lead.estimated_budget === "number" && (
                            <div className="flex items-center gap-2 text-xs font-medium text-cs-green">
                              <DollarSign size={12} />
                              <span>{formatCurrency(lead.estimated_budget)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-surface/50 bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface/50 p-4">
              <div>
                <h3 className="text-lg font-medium text-white">
                  Editar {leadSingular}
                </h3>
                <p className="mt-1 text-xs text-text-secondary">
                  Atualize dados do {leadSingular.toLowerCase()} e acompanhe a conversão.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-surface/50 bg-background p-2 text-text-secondary transition-colors hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-6 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Nome do contato
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Empresa / Instituição
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Tipo de evento
                  </label>
                  <input
                    type="text"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Data do evento
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {quoteSingular} estimado
                  </label>
                  <input
                    type="number"
                    value={estimatedBudget}
                    onChange={(e) => setEstimatedBudget(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Etapa do funil
                  </label>
                  <select
                    value={leadStatus}
                    onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}
                    className="block w-full cursor-pointer rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                  >
                    {STATUS_COLUMNS.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.title(labels)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Observações comerciais
                  </label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="block w-full resize-none rounded-md border border-surface bg-background px-3 py-2 text-sm text-white focus:border-cs-green focus:outline-none"
                    placeholder={`Anotações internas sobre este ${leadSingular.toLowerCase()}.`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-surface/50 pt-4 md:flex-row md:items-center md:justify-between">
                <button
                  type="button"
                  onClick={handleDeleteLead}
                  disabled={isSubmitting || isConverting}
                  className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Excluir
                </button>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleConvertToQuote}
                    disabled={isSubmitting || isConverting}
                    className="flex items-center gap-2 rounded-md border border-cs-gold/20 bg-cs-gold/10 px-4 py-2 text-sm font-medium text-cs-gold transition-colors hover:bg-cs-gold/20 disabled:opacity-50"
                  >
                    {isConverting ? <Loader2 className="animate-spin" size={16} /> : <FileOutput size={16} />}
                    Converter em {quoteSingular}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || isConverting}
                    className="flex items-center gap-2 rounded-md bg-cs-green px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}