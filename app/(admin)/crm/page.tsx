"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useSettings } from "../../providers/SettingsProvider";
import {
  Target,
  Plus,
  Loader2,
  ArrowLeft,
  Mail,
  Phone,
  DollarSign,
  GripVertical,
  Minimize2,
  Maximize2,
  X,
  Save,
  Trash2,
  FileText,
  FileOutput,
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

interface SettingsContextShape {
  companyProfile?: {
    company_name?: string | null;
    primary_color?: string | null;
  } | null;
  systemPreferences?: {
    custom_labels?: Record<string, string> | null;
  } | null;
}

const STATUS_FLOW: LeadStatus[] = ["new", "contacted", "proposal", "negotiation", "won", "lost"];

function normalizeHexColor(input?: string | null) {
  const value = (input || "").trim();
  const valid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
  return valid ? value : "#138946";
}

function hexToRgba(hex: string, alpha: number) {
  const safe = normalizeHexColor(hex).replace("#", "");
  const normalized = safe.length === 3 ? safe.split("").map((c) => c + c).join("") : safe;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CRMPage() {
  const router = useRouter();
  const { companyProfile, systemPreferences } = useSettings() as SettingsContextShape;

  const customLabels = systemPreferences?.custom_labels ?? {};
  const primaryColor = normalizeHexColor(companyProfile?.primary_color);

  const leadSingular = customLabels.entity_lead_singular || "Lead";
  const leadPlural = customLabels.entity_lead_plural || "Leads";
  const clientSingular = customLabels.entity_client_singular || "Cliente";
  const quoteSingular = customLabels.entity_quote_singular || "Orçamento";
  const crmLabel = customLabels.menu_crm || "CRM / Vendas";

  const columns = useMemo(
    () => [
      {
        id: "new" as LeadStatus,
        title: `Novos ${leadPlural}`,
        bg: "bg-blue-500/10",
        text: "text-blue-400",
      },
      {
        id: "contacted" as LeadStatus,
        title: "Em Contato",
        bg: "bg-purple-500/10",
        text: "text-purple-400",
      },
      {
        id: "proposal" as LeadStatus,
        title: `${quoteSingular} Enviado`,
        bg: "bg-yellow-500/10",
        text: "text-yellow-400",
      },
      {
        id: "negotiation" as LeadStatus,
        title: "Em Negociação",
        bg: "",
        text: "",
      },
      {
        id: "won" as LeadStatus,
        title: "Fechado (Ganho)",
        bg: "",
        text: "",
      },
      {
        id: "lost" as LeadStatus,
        title: "Perdido",
        bg: "bg-red-500/10",
        text: "text-red-400",
      },
    ],
    [leadPlural, quoteSingular]
  );

  const [view, setView] = useState<"board" | "create">("board");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("new");

  useEffect(() => {
    if (view === "board") {
      void fetchLeads();
    }
  }, [view]);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeads((data as Lead[]) || []);
    }

    setLoading(false);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    setPhone(value);
  };

  const resetForm = () => {
    setClientName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setEventType("");
    setEventDate("");
    setEstimatedBudget("");
    setNotes("");
    setLeadStatus("new");
    setEditingLeadId(null);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    setIsSubmitting(true);

    const payload = {
      client_name: clientName,
      company_name: companyName,
      email,
      phone,
      event_type: eventType,
      event_date: eventDate ? new Date(eventDate).toISOString() : null,
      estimated_budget: estimatedBudget ? Number(estimatedBudget) : 0,
      notes,
      status: leadStatus,
    };

    let error = null;

    if (editingLeadId) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", editingLeadId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("leads").insert([payload]);
      error = insertError;
    }

    if (!error) {
      resetForm();
      if (view === "create") setView("board");
      await fetchLeads();
    } else {
      alert(`Erro ao salvar ${leadSingular.toLowerCase()}: ${error.message}`);
    }

    setIsSubmitting(false);
  };

  const handleDeleteLead = async () => {
    if (!editingLeadId) return;
    if (!window.confirm(`Tem certeza que deseja excluir este ${leadSingular.toLowerCase()} permanentemente?`)) return;

    setIsSubmitting(true);
    const { error } = await supabase.from("leads").delete().eq("id", editingLeadId);

    if (!error) {
      resetForm();
      await fetchLeads();
    } else {
      alert(`Erro ao excluir ${leadSingular.toLowerCase()}: ${error.message}`);
    }

    setIsSubmitting(false);
  };

  const handleConvertToQuote = async () => {
    if (!editingLeadId) return;
    setIsConverting(true);

    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .insert([
          {
            company_name: companyName || clientName,
            contact_name: clientName,
            email: email || null,
            phone: phone || null,
            document: "00.000.000/0000-00",
          },
        ])
        .select()
        .single();

      if (clientError) throw clientError;

      const { error: quoteError } = await supabase.from("quotes").insert([
        {
          client_id: clientData.id,
          title: eventType ? `${quoteSingular}: ${eventType}` : `${quoteSingular} - ${clientName}`,
          status: "draft",
        },
      ]);

      if (quoteError) throw quoteError;

      await supabase.from("leads").update({ status: "proposal" }).eq("id", editingLeadId);
      router.push("/orcamentos");
    } catch (error: any) {
      alert(`Erro ao converter ${leadSingular.toLowerCase()}: ${error.message}`);
      setIsConverting(false);
      return;
    }

    setIsConverting(false);
  };

  const openEditModal = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setClientName(lead.client_name || "");
    setCompanyName(lead.company_name || "");
    setEmail(lead.email || "");
    setPhone(lead.phone || "");
    setEventType(lead.event_type || "");
    setEventDate(lead.event_date ? lead.event_date.split("T")[0] : "");
    setEstimatedBudget(lead.estimated_budget?.toString() || "");
    setNotes(lead.notes || "");
    setLeadStatus(
      (STATUS_FLOW.includes((lead.status || "new") as LeadStatus) ? lead.status : "new") as LeadStatus
    );
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOverBoard = (e: React.DragEvent) => {
    e.preventDefault();
    if (!boardRef.current) return;

    const scrollSpeed = 15;
    const threshold = 100;
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x < threshold) boardRef.current.scrollLeft -= scrollSpeed;
    else if (x > rect.width - threshold) boardRef.current.scrollLeft += scrollSpeed;
  };

  const handleDrop = async (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;

    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? { ...lead, status: newStatus } : lead))
    );

    await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const primarySoft = { backgroundColor: hexToRgba(primaryColor, 0.12), color: primaryColor };
  const primarySoftBorder = {
    backgroundColor: hexToRgba(primaryColor, 0.12),
    borderColor: hexToRgba(primaryColor, 0.28),
    color: primaryColor,
  };
  const primaryButton = { backgroundColor: primaryColor };

  if (view === "create") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              resetForm();
              setView("board");
            }}
            className="flex items-center gap-2 text-text-secondary transition-colors hover:text-white"
          >
            <ArrowLeft size={20} /> Voltar para o funil
          </button>
        </div>

        <div className="rounded-lg border border-surface/50 bg-surface p-6">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-medium text-white">
            <Plus size={20} style={{ color: primaryColor }} /> Cadastrar novo {leadSingular}
          </h3>

          <form onSubmit={handleSaveLead} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Nome do contato *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Empresa / Instituição
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                  placeholder="Ex: ARXUM Systems"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                  placeholder="contato@empresa.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Tipo de evento
                </label>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                  placeholder="Ex: Convenção, Festival, Show"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Data prevista
                </label>
                <input
                  type="date"
                  max="2099-12-31"
                  value={eventDate}
                  onChange={(e) => {
                    if (e.target.value.length <= 10) setEventDate(e.target.value);
                  }}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  {quoteSingular} estimado
                </label>
                <input
                  type="number"
                  max="999999999"
                  value={estimatedBudget}
                  onChange={(e) => {
                    if (e.target.value.length <= 10) setEstimatedBudget(e.target.value);
                  }}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-surface/50 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                style={primaryButton}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : `Salvar ${leadSingular}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col space-y-6">
      <div className="flex shrink-0 items-center justify-between rounded-lg border border-surface/50 bg-surface p-4">
        <h3 className="flex items-center gap-2 text-lg font-medium text-white">
          <Target size={20} style={{ color: primaryColor }} /> {crmLabel}
        </h3>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setCompactView(!compactView)}
            className="flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-white"
          >
            {compactView ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            {compactView ? "Visão detalhada" : "Visão compacta"}
          </button>

          <button
            onClick={() => {
              resetForm();
              setView("create");
            }}
            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90"
            style={primaryButton}
          >
            <Plus size={18} /> Adicionar {leadSingular}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" size={32} style={{ color: primaryColor }} />
        </div>
      ) : (
        <div
          ref={boardRef}
          onDragOver={handleDragOverBoard}
          className="custom-scrollbar flex flex-1 gap-4 overflow-x-auto pb-4"
        >
          {columns.map((column) => {
            const isPrimaryColumn = column.id === "negotiation" || column.id === "won";
            const headerStyle = isPrimaryColumn ? primarySoft : undefined;
            const count = leads.filter((lead) => lead.status === column.id).length;

            return (
              <div
                key={column.id}
                className="flex w-80 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-surface/50 bg-surface"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => void handleDrop(e, column.id)}
              >
                <div
                  className={`flex items-center justify-between border-b border-surface/50 p-3 ${column.bg}`}
                  style={headerStyle}
                >
                  <h4 className={`text-sm font-semibold ${column.text}`}>{column.title}</h4>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-text-secondary">
                    {count}
                  </span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {leads
                    .filter((lead) => lead.status === column.id)
                    .map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => openEditModal(lead)}
                        className="group cursor-pointer rounded-md border border-surface/50 bg-background p-4 shadow-sm transition-colors hover:border-surface"
                      >
                        <div className="flex items-start justify-between">
                          <h5 className="text-sm font-medium text-white">{lead.client_name}</h5>
                          <GripVertical
                            size={14}
                            className="shrink-0 cursor-grab text-text-secondary active:cursor-grabbing"
                          />
                        </div>

                        {lead.company_name && (
                          <p className={`text-xs text-text-secondary ${compactView ? "mt-1" : "mb-3"}`}>
                            {lead.company_name}
                          </p>
                        )}

                        {!compactView && (
                          <>
                            {lead.event_type && (
                              <p className="mb-3 text-xs" style={{ color: primaryColor }}>
                                {lead.event_type}
                              </p>
                            )}

                            <div className="space-y-1.5">
                              {lead.phone && (
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                  <Phone size={12} /> {lead.phone}
                                </div>
                              )}

                              {lead.email && (
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                  <Mail size={12} /> <span className="truncate">{lead.email}</span>
                                </div>
                              )}

                              {(lead.estimated_budget || 0) > 0 && (
                                <div
                                  className="mt-2 flex items-center gap-2 border-t border-surface/50 pt-2 text-xs font-medium"
                                  style={{ color: primaryColor }}
                                >
                                  <DollarSign size={12} /> {formatCurrency(Number(lead.estimated_budget || 0))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in-95 duration-200 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-surface/50 bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface/50 bg-background/50 p-6">
              <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                <Target size={24} style={{ color: primaryColor }} /> Ficha da oportunidade
              </h2>

              <button onClick={resetForm} className="text-text-secondary transition-colors hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-lead-form" onSubmit={handleSaveLead} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Nome do contato *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Empresa / Instituição
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">E-mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Tipo de evento
                    </label>
                    <input
                      type="text"
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Data prevista
                    </label>
                    <input
                      type="date"
                      max="2099-12-31"
                      value={eventDate}
                      onChange={(e) => {
                        if (e.target.value.length <= 10) setEventDate(e.target.value);
                      }}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      {quoteSingular} estimado
                    </label>
                    <input
                      type="number"
                      max="999999999"
                      value={estimatedBudget}
                      onChange={(e) => {
                        if (e.target.value.length <= 10) setEstimatedBudget(e.target.value);
                      }}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Fase do funil
                    </label>
                    <select
                      value={leadStatus}
                      onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                    >
                      {columns.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 flex items-center gap-2 text-sm font-medium text-text-secondary">
                      <FileText size={14} /> Anotações / Histórico
                    </label>
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="block w-full resize-none rounded-md border border-surface bg-background px-3 py-2 text-white transition-colors focus:outline-none focus:ring-1"
                      placeholder={`Registre aqui briefing, necessidades do ${clientSingular.toLowerCase()} e observações comerciais...`}
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-surface/50 bg-background/50 p-6">
              <button
                type="button"
                onClick={handleDeleteLead}
                disabled={isSubmitting || isConverting}
                className="flex items-center gap-2 text-sm font-medium text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
              >
                <Trash2 size={18} /> Excluir
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleConvertToQuote}
                  disabled={isSubmitting || isConverting}
                  className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
                  style={primarySoftBorder}
                >
                  {isConverting ? <Loader2 className="animate-spin" size={16} /> : <FileOutput size={16} />}
                  Converter em {quoteSingular}
                </button>

                <button
                  type="submit"
                  form="edit-lead-form"
                  disabled={isSubmitting || isConverting}
                  className="flex items-center gap-2 rounded-md px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                  style={primaryButton}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}