"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useSettings } from "@/app/providers/SettingsProvider";
import { 
  Target, Plus, Loader2, ArrowLeft, Mail, Phone, 
  DollarSign, GripVertical, Minimize2, Maximize2, 
  X, Save, Trash2, FileText, FileOutput, Check, AlertCircle 
} from "lucide-react";

// --- TIPAGENS ---
interface Lead {
  id: string;
  client_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  event_type: string | null;
  event_date: string | null;
  estimated_budget: number;
  notes: string | null;
  status: string;
  created_at: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

const COLUMNS = [
  { id: "new", color: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-400" },
  { id: "contacted", color: "border-purple-500/30", bg: "bg-purple-500/10", text: "text-purple-400" },
  { id: "proposal", color: "border-yellow-500/30", bg: "bg-yellow-500/10", text: "text-yellow-400" },
  { id: "negotiation", color: "border-cs-gold/30", bg: "bg-cs-gold/10", text: "text-cs-gold" },
  { id: "won", color: "border-cs-green/30", bg: "bg-cs-green/10", text: "text-cs-green" },
  { id: "lost", color: "border-red-500/30", bg: "bg-red-500/10", text: "text-red-400" }
];

export default function CRMPage() {
  const router = useRouter();
  const { systemPreferences } = useSettings();

  // --- LABELS DINÂMICAS ---
  const custom_labels = systemPreferences?.custom_labels || {};
  const crmLabel = custom_labels.menu_crm || "CRM / Vendas";
  const leadSingular = custom_labels.entity_lead_singular || "Lead";
  const leadPlural = custom_labels.entity_lead_plural || "Leads";
  const clientSingular = custom_labels.entity_client_singular || "Cliente";
  const quoteSingular = custom_labels.entity_quote_singular || "Orçamento";

  const [view, setView] = useState<"board" | "create">("board");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Estados do Formulário
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [leadStatus, setLeadStatus] = useState("new");

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (!error && data) setLeads(data as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (view === "board") fetchLeads();
  }, [view, fetchLeads]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    setPhone(value);
  };

  const resetForm = () => {
    setClientName(""); setCompanyName(""); setEmail(""); setPhone(""); 
    setEventType(""); setEventDate(""); setEstimatedBudget(""); setNotes(""); setLeadStatus("new");
    setEditingLeadId(null);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;
    
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
      status: leadStatus
    };

    const { error } = editingLeadId 
      ? await supabase.from("leads").update(payload).eq("id", editingLeadId)
      : await supabase.from("leads").insert([payload]);

    if (!error) {
      showToast(`${leadSingular} salvo com sucesso.`, "success");
      resetForm();
      if (view === "create") setView("board");
      fetchLeads();
    } else {
      showToast(`Erro ao salvar ${leadSingular.toLowerCase()}: ${error.message}`, "error");
    }
    setIsSubmitting(false);
  };

  const handleDeleteLead = async () => {
    if (!editingLeadId) return;
    
    setIsSubmitting(true);
    const { error } = await supabase.from("leads").delete().eq("id", editingLeadId);
    
    if (!error) {
      showToast(`${leadSingular} excluído com sucesso.`, "success");
      resetForm();
      fetchLeads();
    } else {
      showToast(`Erro ao excluir: ${error.message}`, "error");
    }
    setIsSubmitting(false);
  };

  const handleConvertToQuote = async () => {
    if (!editingLeadId) return;
    setIsConverting(true);

    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .insert([{
          company_name: companyName || clientName,
          contact_name: clientName,
          email: email || null,
          phone: phone || null,
          document: "Pendente" 
        }])
        .select()
        .single();

      if (clientError) throw clientError;

      const { error: quoteError } = await supabase
        .from("quotes")
        .insert([{
          client_id: clientData.id,
          title: eventType ? `${quoteSingular}: ${eventType}` : `${quoteSingular} - ${clientName}`,
          status: "draft"
        }]);

      if (quoteError) throw quoteError;

      await supabase.from("leads").update({ status: "proposal" }).eq("id", editingLeadId);

      showToast(`${leadSingular} convertido em ${quoteSingular.toLowerCase()} com sucesso.`, "success");
      router.push("/orcamentos");

    } catch (error: any) {
      showToast(`Erro na conversão: ${error.message}`, "error");
      setIsConverting(false);
    }
  };

  const openEditModal = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setClientName(lead.client_name || "");
    setCompanyName(lead.company_name || "");
    setEmail(lead.email || "");
    setPhone(lead.phone || "");
    setEventType(lead.event_type || "");
    setEventDate(lead.event_date ? lead.event_date.split('T')[0] : "");
    setEstimatedBudget(lead.estimated_budget?.toString() || "");
    setNotes(lead.notes || "");
    setLeadStatus(lead.status || "new");
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

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead));
    await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getColumnTitle = (colId: string) => {
    const titles: Record<string, string> = {
      new: `Novos ${leadPlural}`,
      contacted: "Em Contato",
      proposal: `${quoteSingular} Enviado`,
      negotiation: "Em Negociação",
      won: "Fechado (Ganho)",
      lost: "Perdido"
    };
    return titles[colId] || colId;
  };

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => { resetForm(); setView("board"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para o Funil de {leadPlural}
          </button>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
            <Plus className="text-cs-green" size={20} /> Cadastrar Novo {leadSingular}
          </h3>
          
          <form onSubmit={handleSaveLead} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Nome do Contato Principal *</label>
                <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Empresa / Instituição</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: Agência XYZ" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">E-mail de Contato</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="contato@empresa.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Telefone / WhatsApp</label>
                <input type="text" value={phone} onChange={handlePhoneChange} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Tipo de Evento / Necessidade</label>
                <input type="text" value={eventType} onChange={(e) => setEventType(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: Convenção, Treinamento" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Data Prevista</label>
                <input type="date" max="2099-12-31" value={eventDate} onChange={(e) => { if (e.target.value.length <= 10) setEventDate(e.target.value); }} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-1">{quoteSingular} Estimado (Budget)</label>
                <input type="number" max="999999999" value={estimatedBudget} onChange={(e) => { if (e.target.value.length <= 10) setEstimatedBudget(e.target.value); }} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="R$ 0,00" />
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-surface/50">
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : `Salvar ${leadSingular}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col relative">
      {/* Sistema de Toasts Premium */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-md shadow-lg flex items-center gap-2 border animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'bg-cs-green/10 border-cs-green/20 text-cs-green' : 
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
          'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg shrink-0">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Target className="text-cs-green" size={20} /> {crmLabel}
        </h3>
        <div className="flex items-center gap-4">
          <button onClick={() => setCompactView(!compactView)} className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-white transition-colors">
            {compactView ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            {compactView ? "Visão Detalhada" : "Visão Compacta"}
          </button>
          <button onClick={() => { resetForm(); setView("create"); }} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all">
            <Plus size={18} /> Adicionar {leadSingular}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-cs-green" size={32} />
        </div>
      ) : (
        <div ref={boardRef} onDragOver={handleDragOverBoard} className="flex-1 flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {COLUMNS.map(column => (
            <div key={column.id} className="flex-shrink-0 w-80 flex flex-col bg-surface border border-surface/50 rounded-lg overflow-hidden" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, column.id)}>
              <div className={`p-3 border-b border-surface/50 flex justify-between items-center ${column.bg}`}>
                <h4 className={`font-semibold text-sm ${column.text}`}>{getColumnTitle(column.id)}</h4>
                <span className="bg-background text-text-secondary text-xs py-0.5 px-2 rounded-full font-medium">{leads.filter(l => l.status === column.id).length}</span>
              </div>

              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {leads.filter(l => l.status === column.id).map(lead => (
                  <div 
                    key={lead.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onClick={() => openEditModal(lead)}
                    className="bg-background border border-surface/50 p-4 rounded-md cursor-pointer hover:border-cs-green/50 transition-colors shadow-sm group"
                  >
                    <div className="flex justify-between items-start">
                      <h5 className="font-medium text-white text-sm group-hover:text-cs-green transition-colors">{lead.client_name}</h5>
                      <GripVertical size={14} className="text-text-secondary shrink-0 cursor-grab active:cursor-grabbing" />
                    </div>
                    
                    {lead.company_name && <p className={`text-xs text-text-secondary ${compactView ? 'mt-1' : 'mb-3'}`}>{lead.company_name}</p>}
                    
                    {!compactView && (
                      <>
                        {lead.event_type && <p className="text-xs text-cs-gold mb-3">{lead.event_type}</p>}
                        <div className="space-y-1.5">
                          {lead.phone && <div className="flex items-center gap-2 text-xs text-text-secondary"><Phone size={12} /> {lead.phone}</div>}
                          {lead.email && <div className="flex items-center gap-2 text-xs text-text-secondary"><Mail size={12} /> <span className="truncate">{lead.email}</span></div>}
                          {lead.estimated_budget > 0 && <div className="flex items-center gap-2 text-xs text-cs-green font-medium mt-2 pt-2 border-t border-surface/50"><DollarSign size={12} /> {formatCurrency(lead.estimated_budget)}</div>}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalhes / Edição do Lead */}
      {editingLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-6 border-b border-surface/50 bg-background/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Target className="text-cs-green" size={24} /> Ficha do(a) {leadSingular}
              </h2>
              <button onClick={resetForm} className="text-text-secondary hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="edit-lead-form" onSubmit={handleSaveLead} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Nome do Contato Principal *</label>
                    <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Empresa / Instituição</label>
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">E-mail</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Telefone / WhatsApp</label>
                    <input type="text" value={phone} onChange={handlePhoneChange} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Tipo de Evento / Necessidade</label>
                    <input type="text" value={eventType} onChange={(e) => setEventType(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Data Prevista</label>
                    <input type="date" max="2099-12-31" value={eventDate} onChange={(e) => { if (e.target.value.length <= 10) setEventDate(e.target.value); }} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">{quoteSingular} Estimado (Budget)</label>
                    <input type="number" max="999999999" value={estimatedBudget} onChange={(e) => { if (e.target.value.length <= 10) setEstimatedBudget(e.target.value); }} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Fase do Funil de Vendas</label>
                    <select value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors">
                      {COLUMNS.map(col => (
                        <option key={col.id} value={col.id}>{getColumnTitle(col.id)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                      <FileText size={14} /> Anotações e Histórico de Reuniões
                    </label>
                    <textarea 
                      rows={4} 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors resize-none" 
                      placeholder={`Registre aqui os detalhes do briefing, necessidades do ${clientSingular.toLowerCase()}, links de referência e próximos passos...`}
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-surface/50 bg-background/50 flex justify-between items-center shrink-0">
              <button 
                type="button"
                onClick={handleDeleteLead}
                disabled={isSubmitting || isConverting}
                className="flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                <Trash2 size={18} /> Excluir {leadSingular}
              </button>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={handleConvertToQuote}
                  disabled={isSubmitting || isConverting}
                  className="flex items-center gap-2 rounded-md bg-cs-gold/20 text-cs-gold border border-cs-gold/30 py-2 px-4 text-sm font-medium hover:bg-cs-gold/30 transition-all disabled:opacity-50"
                >
                  {isConverting ? <Loader2 className="animate-spin" size={16} /> : <FileOutput size={16} />}
                  Converter em {quoteSingular}
                </button>
                <button 
                  type="submit"
                  form="edit-lead-form"
                  disabled={isSubmitting || isConverting}
                  className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}