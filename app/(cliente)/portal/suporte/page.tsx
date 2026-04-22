"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { Ticket, Plus, Loader2, ArrowLeft, MessageSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function ClientSupportPage() {
  const[view, setView] = useState<"list" | "create">("list");
  const[tickets, setTickets] = useState<any[]>([]);
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const[isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Formulário
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (view === "list") fetchMyTickets();
    if (view === "create") fetchMyServiceOrders();
  }, [view]);

  const fetchMyTickets = async () => {
    setLoading(true);
    // Em um ambiente real, filtraríamos pelo client_id do usuário logado.
    // Para o protótipo, buscaremos os chamados recentes para demonstração.
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        service_orders (
          quotes ( title )
        )
      `)
      .order("created_at", { ascending: false });
      
    if (!error && data) setTickets(data);
    setLoading(false);
  };

  const fetchMyServiceOrders = async () => {
    // Busca os eventos (OS) ativos para o cliente vincular o chamado
    const { data } = await supabase
      .from("service_orders")
      .select(`
        id,
        quotes ( title )
      `)
      .order("created_at", { ascending: false });
      
    if (data) setServiceOrders(data);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !serviceOrderId) return;

    setIsSubmitting(true);

    // Cálculo automático de SLA baseado na prioridade escolhida pelo cliente
    const now = new Date();
    let slaHours = 24;
    if (priority === 'critical') slaHours = 2;
    if (priority === 'high') slaHours = 4;
    if (priority === 'low') slaHours = 48;
    
    const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("tickets")
      .insert([{
        title,
        description,
        service_order_id: serviceOrderId,
        category,
        priority,
        status: "open",
        sla_deadline: slaDeadline
      }]);

    if (!error) {
      setTitle("");
      setDescription("");
      setServiceOrderId("");
      setCategory("general");
      setPriority("medium");
      setView("list");
    } else {
      alert("Erro ao abrir chamado: " + error.message);
    }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'resolved':
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cs-green/10 text-cs-green border border-cs-green/20"><CheckCircle size={14} /> Resolvido</span>;
      case 'in_progress':
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cs-gold/10 text-cs-gold border border-cs-gold/20"><Clock size={14} /> Em Andamento</span>;
      default:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20"><AlertCircle size={14} /> Aberto</span>;
    }
  };

  if (view === "create") {
    return (
      <div className="flex-1 bg-background p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <button 
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Voltar para Meus Chamados
          </button>

          <div className="bg-surface border border-surface/50 p-8 rounded-2xl shadow-lg">
            <div className="mb-8 border-b border-surface/50 pb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <MessageSquare className="text-cs-gold" size={28} />
                Abrir Chamado Técnico
              </h2>
              <p className="text-text-secondary mt-2">
                Relate o problema com o máximo de detalhes. Nossa equipe técnica será notificada imediatamente.
              </p>
            </div>
            
            <form onSubmit={handleCreateTicket} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Qual evento está apresentando problema? *
                </label>
                <select
                  required
                  value={serviceOrderId}
                  onChange={(e) => setServiceOrderId(e.target.value)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                >
                  <option value="">Selecione o evento...</option>
                  {serviceOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.quotes?.title || 'Evento sem título'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Resumo do Problema *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                  placeholder="Ex: Microfone sem fio falhando"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                  >
                    <option value="general">Geral</option>
                    <option value="audio">Áudio</option>
                    <option value="lighting">Iluminação</option>
                    <option value="led">Painel de LED / Vídeo</option>
                    <option value="logistics">Logística / Transporte</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Nível de Urgência
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                  >
                    <option value="low">Baixa (Pode aguardar)</option>
                    <option value="medium">Média (Incomoda, mas não para o evento)</option>
                    <option value="high">Alta (Prejudica o andamento)</option>
                    <option value="critical">Crítica (Evento parado)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Descrição Detalhada *
                </label>
                <textarea
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors resize-none"
                  placeholder="Descreva o que está acontecendo, quais equipamentos estão envolvidos e desde quando o problema começou..."
                />
              </div>

              <div className="flex justify-end pt-6 border-t border-surface/50">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-cs-gold text-black py-3 px-8 font-bold shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Enviar Chamado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-surface/50 shadow-lg">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Ticket className="text-cs-gold" size={28} />
              Central de Suporte
            </h2>
            <p className="text-text-secondary mt-1">Acompanhe o status dos seus chamados técnicos.</p>
          </div>
          <button
            onClick={() => setView("create")}
            className="flex items-center gap-2 rounded-lg bg-cs-gold text-black py-3 px-6 font-bold shadow-lg hover:bg-opacity-90 transition-all"
          >
            <Plus size={20} /> Novo Chamado
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="animate-spin text-cs-gold" size={40} />
            </div>
          ) : tickets.length === 0 ? (
            <div className="col-span-full bg-surface border border-surface/50 rounded-2xl p-12 text-center">
              <Ticket size={48} className="mx-auto text-surface/50 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Nenhum chamado aberto</h3>
              <p className="text-text-secondary">Seus eventos estão ocorrendo perfeitamente. Se precisar de ajuda, clique em Novo Chamado.</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="bg-surface border border-surface/50 rounded-2xl p-6 hover:border-cs-gold/30 transition-colors flex flex-col h-full shadow-md">
                <div className="flex justify-between items-start mb-4">
                  {getStatusBadge(ticket.status)}
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-background px-2 py-1 rounded">
                    {ticket.priority === 'critical' ? 'Crítica' : ticket.priority === 'high' ? 'Alta' : ticket.priority === 'low' ? 'Baixa' : 'Média'}
                  </span>
                </div>
                
                <h4 className="text-lg font-bold text-white mb-2 line-clamp-2">{ticket.title}</h4>
                <p className="text-sm text-text-secondary mb-4 line-clamp-3 flex-1">
                  {ticket.description}
                </p>
                
                <div className="pt-4 border-t border-surface/50 mt-auto">
                  <p className="text-xs font-medium text-cs-gold truncate mb-1">
                    {ticket.service_orders?.quotes?.title || 'Evento não especificado'}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    Aberto em {new Date(ticket.created_at).toLocaleDateString('pt-BR')} às {new Date(ticket.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}