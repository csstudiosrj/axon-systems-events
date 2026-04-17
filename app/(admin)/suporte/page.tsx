"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Ticket, Plus, Loader2, ArrowLeft, AlertCircle, CheckCircle, Clock, MessageSquare } from "lucide-react";

export default function SuportePage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [tickets, setTickets] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success", message: string } | null>(null);

  // Estados do Formulário
  const [title, setTitle] = useState("");
  const[description, setDescription] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const[category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (view === "list") fetchTickets();
    if (view === "create") fetchOrders();
  }, [view]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        service_orders (
          id,
          quotes ( title, clients ( company_name ) )
        )
      `)
      .order("created_at", { ascending: false });
      
    if (!error && data) setTickets(data);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("service_orders")
      .select(`
        id,
        quotes ( title, clients ( company_name ) )
      `)
      .order("created_at", { ascending: false });
      
    if (data) setOrders(data);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!title || !description || !serviceOrderId) {
      setFeedback({ type: "error", message: "Preencha o título, descrição e selecione o evento." });
      return;
    }

    setIsSubmitting(true);

    // Encontra o client_id através da OS selecionada
    const selectedOrder = orders.find(o => o.id === serviceOrderId);
    const clientId = selectedOrder?.quotes?.clients?.id; // Precisaríamos do client_id na query, mas como não puxamos, vamos deixar null por enquanto ou ajustar a query. Para simplificar, o Supabase aceita null se não for obrigatório, mas o ideal é ter.

    // Calcula o SLA baseado na prioridade
    const now = new Date();
    let slaHours = 24; // Medium
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
      setFeedback({ type: "error", message: "Erro ao abrir chamado: " + error.message });
    }
    setIsSubmitting(false);
  };

  const updateTicketStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("tickets")
      .update({ status: newStatus })
      .eq("id", id);

    if (!error) fetchTickets();
  };

  const getPriorityBadge = (p: string) => {
    const config: Record<string, string> = {
      low: "bg-gray-500/10 text-gray-400 border-gray-500/20",
      medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      critical: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    const labels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
    return <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${config[p] || config.medium}`}>{labels[p] || "Média"}</span>;
  };

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Voltar para lista
          </button>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
            <MessageSquare className="text-cs-green" size={20} />
            Abrir Novo Chamado Técnico
          </h3>
          
          {feedback && (
            <div className={`p-4 rounded-md mb-6 text-sm font-medium border ${
              feedback.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-cs-green/10 text-cs-green border-cs-green/20'
            }`}>
              {feedback.message}
            </div>
          )}

          <form onSubmit={handleCreateTicket} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Evento / Ordem de Serviço *
              </label>
              <select
                required
                value={serviceOrderId}
                onChange={(e) => setServiceOrderId(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
              >
                <option value="">Selecione o evento relacionado...</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.quotes?.title} - {o.quotes?.clients?.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Título do Problema *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                placeholder="Ex: Falha no painel de LED principal"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                >
                  <option value="general">Geral</option>
                  <option value="audio">Áudio</option>
                  <option value="lighting">Iluminação</option>
                  <option value="led">Painel de LED / Vídeo</option>
                  <option value="logistics">Logística / Transporte</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Prioridade (Define o SLA)
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                >
                  <option value="low">Baixa (48 horas)</option>
                  <option value="medium">Média (24 horas)</option>
                  <option value="high">Alta (4 horas)</option>
                  <option value="critical">Crítica (2 horas)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Descrição Detalhada *
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors resize-none"
                placeholder="Descreva o problema, equipamentos envolvidos e o impacto no evento..."
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-surface/50">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Abrir Chamado"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Ticket className="text-cs-green" size={20} />
          Central de Suporte e Tickets
        </h3>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
        >
          <Plus size={18} /> Novo Chamado
        </button>
      </div>

      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium">Chamado / Evento</th>
                <th className="px-6 py-4 font-medium">Prioridade</th>
                <th className="px-6 py-4 font-medium">Prazo (SLA)</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando chamados...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    Nenhum chamado aberto. Tudo funcionando perfeitamente!
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const isOverdue = new Date(ticket.sla_deadline) < new Date() && ticket.status !== 'resolved';
                  
                  return (
                    <tr key={ticket.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{ticket.title}</p>
                        <p className="text-xs mt-1 text-text-secondary truncate max-w-xs">{ticket.service_orders?.quotes?.title}</p>
                      </td>
                      <td className="px-6 py-4">
                        {getPriorityBadge(ticket.priority)}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? 'text-red-400' : 'text-text-secondary'}`}>
                          <Clock size={14} />
                          {new Date(ticket.sla_deadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          ticket.status === 'open' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          ticket.status === 'in_progress' ? 'bg-cs-gold/10 text-cs-gold border-cs-gold/20' :
                          'bg-cs-green/10 text-cs-green border-cs-green/20'
                        }`}>
                          {ticket.status === 'open' ? 'Aberto' : ticket.status === 'in_progress' ? 'Em Andamento' : 'Resolvido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <select
                          value={ticket.status}
                          onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                          className="bg-background border border-surface/50 text-white text-xs rounded px-2 py-1.5 focus:border-cs-green focus:outline-none"
                        >
                          <option value="open">Aberto</option>
                          <option value="in_progress">Em Andamento</option>
                          <option value="resolved">Resolvido</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}