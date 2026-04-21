"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { Ticket, Loader2, ArrowLeft, Clock, CheckCircle, AlertCircle, MessageSquare, Send, User } from "lucide-react";

export default function SuportePage() {
  const[view, setView] = useState<"list" | "details">("list");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados do Ticket Ativo (Chat)
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const[messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === "list") fetchTickets();
    getCurrentUser();
  }, [view]);

  // Rola o chat para baixo sempre que uma nova mensagem chega
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setCurrentUserId(session.user.id);
  };

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        clients (company_name, contact_name),
        service_orders ( quotes ( title ) )
      `)
      .order("created_at", { ascending: false });
      
    if (!error && data) setTickets(data);
    setLoading(false);
  };

  const openTicketDetails = async (ticket: any) => {
    setLoading(true);
    setActiveTicket(ticket);
    await fetchMessages(ticket.id);
    setView("details");
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("ticket_messages")
      .select(`
        *,
        sender:profiles!ticket_messages_sender_id_fkey(full_name, role, email)
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
      
    if (data) setMessages(data);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket || !currentUserId) return;

    setIsSending(true);
    const { error } = await supabase.from("ticket_messages").insert([{
      ticket_id: activeTicket.id,
      sender_id: currentUserId,
      message: newMessage.trim()
    }]);

    if (!error) {
      setNewMessage("");
      await fetchMessages(activeTicket.id);
      
      // Se o ticket estava "Aberto", muda automaticamente para "Em Andamento" ao responder
      if (activeTicket.status === 'open') {
        await updateTicketStatus(activeTicket.id, 'in_progress');
      }
    }
    setIsSending(false);
  };

  const updateTicketStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("tickets").update({ status: newStatus }).eq("id", id);
    if (!error) {
      if (activeTicket && activeTicket.id === id) {
        setActiveTicket({ ...activeTicket, status: newStatus });
      }
      fetchTickets();
    }
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

  // ---------------------------------------------------------------------------
  // VISÃO: DETALHES DO TICKET (CHAT)
  // ---------------------------------------------------------------------------
  if (view === "details" && activeTicket) {
    const isOverdue = new Date(activeTicket.sla_deadline) < new Date() && activeTicket.status !== 'resolved';

    return (
      <div className="space-y-6 max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <button onClick={() => setView("list")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para Chamados
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">Status do Chamado:</span>
            <select
              value={activeTicket.status}
              onChange={(e) => updateTicketStatus(activeTicket.id, e.target.value)}
              className="bg-surface border border-surface/50 text-white text-sm rounded-md px-4 py-2 focus:border-cs-green focus:outline-none font-bold cursor-pointer"
            >
              <option value="open">Aberto (Aguardando)</option>
              <option value="in_progress">Em Andamento</option>
              <option value="resolved">Resolvido</option>
            </select>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          
          {/* Coluna Esquerda: Informações do Ticket */}
          <div className="lg:col-span-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-surface border border-surface/50 p-6 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-surface border border-surface/50 px-2 py-1 rounded text-[10px] font-mono text-text-secondary uppercase">
                  #{activeTicket.id.split('-')[0]}
                </span>
                {getPriorityBadge(activeTicket.priority)}
              </div>
              
              <h2 className="text-xl font-bold text-white mb-2">{activeTicket.title}</h2>
              <p className="text-sm text-text-secondary mb-6">{activeTicket.description}</p>

              <div className="space-y-4 border-t border-surface/50 pt-4">
                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Cliente</p>
                  <p className="text-sm font-medium text-white">{activeTicket.clients?.company_name || 'Não informado'}</p>
                  <p className="text-xs text-text-secondary">{activeTicket.clients?.contact_name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Evento / OS</p>
                  <p className="text-sm font-medium text-cs-gold">{activeTicket.service_orders?.quotes?.title || 'Avulso'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Prazo de Resolução (SLA)</p>
                  <div className={`flex items-center gap-1.5 text-sm font-medium ${isOverdue ? 'text-red-400' : 'text-cs-green'}`}>
                    <Clock size={14} />
                    {new Date(activeTicket.sla_deadline).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {isOverdue && <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded ml-2">VENCIDO</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Chat / Linha do Tempo */}
          <div className="lg:col-span-2 bg-surface border border-surface/50 rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b border-surface/50 bg-background/50 shrink-0">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <MessageSquare className="text-cs-green" size={18} />
                Histórico de Atendimento
              </h3>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6 bg-background/20">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                  <MessageSquare size={48} className="mb-4 opacity-20" />
                  <p>Nenhuma resposta ainda.</p>
                  <p className="text-xs mt-1">Envie a primeira mensagem para iniciar o atendimento.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  const isClient = msg.sender?.role === 'client' || msg.sender?.role === 'student';
                  
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-medium text-text-secondary">
                          {msg.sender?.full_name || msg.sender?.email?.split('@')[0] || 'Usuário'}
                        </span>
                        {!isClient && <span className="text-[8px] bg-cs-green/20 text-cs-green px-1.5 py-0.5 rounded uppercase">Staff</span>}
                        <span className="text-[10px] text-surface/80">•</span>
                        <span className="text-[10px] text-text-secondary">
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                        isMe 
                          ? 'bg-cs-green text-white rounded-tr-sm' 
                          : isClient 
                            ? 'bg-surface border border-surface/50 text-white rounded-tl-sm'
                            : 'bg-surface border border-cs-green/30 text-white rounded-tl-sm'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Nova Mensagem */}
            <div className="p-4 bg-background/50 border-t border-surface/50 shrink-0">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  type="text"
                  required
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua resposta para o cliente..."
                  className="flex-1 rounded-full border border-surface bg-background px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green text-sm transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                  className="w-12 h-12 rounded-full bg-cs-green text-white flex items-center justify-center hover:bg-opacity-90 transition-all disabled:opacity-50 shrink-0"
                >
                  {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} className="ml-1" />}
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VISÃO: LISTA GERAL DE TICKETS
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Ticket className="text-cs-green" size={20} />
            Central de Suporte e Tickets
          </h3>
          <p className="text-xs text-text-secondary mt-1">Atendimento ao cliente e resolução de problemas operacionais.</p>
        </div>
      </div>

      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium">Chamado / Evento</th>
                <th className="px-6 py-4 font-medium">Cliente</th>
                <th className="px-6 py-4 font-medium">Prioridade</th>
                <th className="px-6 py-4 font-medium">Prazo (SLA)</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center"><Loader2 className="animate-spin mx-auto mb-2 text-cs-green" size={24} /></td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-text-secondary">Nenhum chamado aberto. Tudo funcionando perfeitamente!</td></tr>
              ) : (
                tickets.map((ticket) => {
                  const isOverdue = new Date(ticket.sla_deadline) < new Date() && ticket.status !== 'resolved';
                  
                  return (
                    <tr 
                      key={ticket.id} 
                      onClick={() => openTicketDetails(ticket)}
                      className="hover:bg-background/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-white">{ticket.title}</p>
                        <p className="text-xs mt-1 text-cs-gold truncate max-w-xs">{ticket.service_orders?.quotes?.title || 'Avulso'}</p>
                        <p className="text-[10px] text-text-secondary mt-1 uppercase">#{ticket.id.split('-')[0]}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{ticket.clients?.company_name || 'Não informado'}</p>
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