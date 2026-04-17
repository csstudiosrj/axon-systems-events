"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Target, Plus, Loader2, ArrowLeft, Mail, Phone, Calendar, DollarSign, GripVertical } from "lucide-react";

const COLUMNS =[
  { id: "new", title: "Novos Leads", color: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-400" },
  { id: "contacted", title: "Em Contato", color: "border-purple-500/30", bg: "bg-purple-500/10", text: "text-purple-400" },
  { id: "proposal", title: "Proposta Enviada", color: "border-yellow-500/30", bg: "bg-yellow-500/10", text: "text-yellow-400" },
  { id: "negotiation", title: "Em Negociação", color: "border-cs-gold/30", bg: "bg-cs-gold/10", text: "text-cs-gold" },
  { id: "won", title: "Fechado (Ganho)", color: "border-cs-green/30", bg: "bg-cs-green/10", text: "text-cs-green" },
  { id: "lost", title: "Perdido", color: "border-red-500/30", bg: "bg-red-500/10", text: "text-red-400" }
];

export default function CRMPage() {
  const[view, setView] = useState<"board" | "create">("board");
  const[leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Formulário
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const[estimatedBudget, setEstimatedBudget] = useState("");

  useEffect(() => {
    if (view === "board") fetchLeads();
  }, [view]);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (!error && data) setLeads(data);
    setLoading(false);
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;
    
    setIsSubmitting(true);
    const { error } = await supabase
      .from("leads")
      .insert([{ 
        client_name: clientName,
        company_name: companyName,
        email,
        phone,
        event_type: eventType,
        event_date: eventDate ? new Date(eventDate).toISOString() : null,
        estimated_budget: estimatedBudget ? Number(estimatedBudget) : 0,
        status: "new"
      }]);

    if (!error) {
      setClientName(""); setCompanyName(""); setEmail(""); setPhone(""); setEventType(""); setEventDate(""); setEstimatedBudget("");
      setView("board");
    } else {
      alert("Erro ao cadastrar lead: " + error.message);
    }
    setIsSubmitting(false);
  };

  // Funções de Drag and Drop (Arrastar e Soltar)
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    
    // Atualiza a UI imediatamente (Optimistic Update)
    setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead));

    // Atualiza no banco de dados
    await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setView("board")}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Voltar para o Funil
          </button>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
            <Plus className="text-cs-green" size={20} />
            Cadastrar Novo Lead (Oportunidade)
          </h3>
          
          <form onSubmit={handleCreateLead} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Nome do Contato *</label>
                <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Empresa / Instituição</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: Agência XYZ" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="joao@agencia.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Telefone / WhatsApp</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Tipo de Evento</label>
                <input type="text" value={eventType} onChange={(e) => setEventType(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: Convenção, Show, Lançamento" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Data Prevista</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-1">Orçamento Estimado (Budget)</label>
                <input type="number" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="R$ 0,00" />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-surface/50">
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Salvar Lead"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg shrink-0">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Target className="text-cs-green" size={20} />
          Funil de Vendas (CRM)
        </h3>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
        >
          <Plus size={18} /> Adicionar Lead
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-cs-green" size={32} />
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(column => (
            <div 
              key={column.id} 
              className="flex-shrink-0 w-80 flex flex-col bg-surface border border-surface/50 rounded-lg overflow-hidden"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Header da Coluna */}
              <div className={`p-3 border-b border-surface/50 flex justify-between items-center ${column.bg}`}>
                <h4 className={`font-semibold text-sm ${column.text}`}>{column.title}</h4>
                <span className="bg-background text-text-secondary text-xs py-0.5 px-2 rounded-full font-medium">
                  {leads.filter(l => l.status === column.id).length}
                </span>
              </div>

              {/* Área de Cards */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {leads.filter(l => l.status === column.id).map(lead => (
                  <div 
                    key={lead.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className="bg-background border border-surface/50 p-4 rounded-md cursor-grab active:cursor-grabbing hover:border-cs-green/50 transition-colors shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-white text-sm">{lead.client_name}</h5>
                      <GripVertical size={14} className="text-text-secondary" />
                    </div>
                    
                    {lead.company_name && <p className="text-xs text-text-secondary mb-3">{lead.company_name}</p>}
                    {lead.event_type && <p className="text-xs text-cs-gold mb-3">{lead.event_type}</p>}
                    
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
                      {lead.estimated_budget > 0 && (
                        <div className="flex items-center gap-2 text-xs text-cs-green font-medium mt-2 pt-2 border-t border-surface/50">
                          <DollarSign size={12} /> {formatCurrency(lead.estimated_budget)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}