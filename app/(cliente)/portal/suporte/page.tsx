"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useSettings } from "../../../providers/SettingsProvider";
import {
  Ticket,
  Loader2,
  ArrowLeft,
  Clock,
  MessageSquare,
  Send,
  Plus,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

type TicketStatus = "open" | "in_progress" | "resolved";
type TicketPriority = "low" | "medium" | "high" | "critical";

type QuoteRow = {
  id: string;
  title: string | null;
};

type TicketRow = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  sla_deadline: string | null;
  created_at: string;
  service_order_id: string | null;
  client_id: string | null;
  service_orders?: {
    quotes?: {
      title?: string | null;
    } | null;
  } | null;
};

type TicketMessageRow = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

export default function ClientSupportPage() {
  const router = useRouter();
  const { systemPreferences, resolvedClientId } = useSettings();

  const supportEnabled = systemPreferences?.feature_toggles?.enable_support ?? true;
  const labels = systemPreferences?.custom_labels;
  const clientSingular = labels?.entity_client_singular || "Cliente";
  const supportMenuLabel = labels?.menu_support || "Suporte";

  const [view, setView] = useState<"list" | "create">("list");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessageRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<TicketPriority>("medium");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const statusLabels: Record<TicketStatus, string> = {
    open: "Aberto",
    in_progress: "Em Andamento",
    resolved: "Resolvido",
  };

  const priorityLabels: Record<TicketPriority, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };

  const currentTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === activeTicketId) || null,
    [tickets, activeTicketId]
  );

  const getCurrentUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      router.replace("/acesso");
      return;
    }

    setCurrentUserId(session.user.id);
  }, [router]);

  const fetchMyTickets = useCallback(async () => {
    if (!resolvedClientId) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("tickets")
      .select(`
        id,
        title,
        description,
        status,
        priority,
        sla_deadline,
        created_at,
        service_order_id,
        client_id,
        service_orders (
          quotes ( title )
        )
      `)
      .eq("client_id", resolvedClientId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTickets(data as TicketRow[]);
    } else {
      setTickets([]);
    }

    setLoading(false);
  }, [resolvedClientId]);

  const fetchMyQuotes = useCallback(async () => {
    if (!resolvedClientId) {
      setQuotes([]);
      return;
    }

    const { data, error } = await supabase
      .from("quotes")
      .select("id, title")
      .eq("client_id", resolvedClientId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setQuotes(data as QuoteRow[]);
    } else {
      setQuotes([]);
    }
  }, [resolvedClientId]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    const { data, error } = await supabase
      .from("ticket_messages")
      .select("id, ticket_id, sender_id, message, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as TicketMessageRow[]);
    } else {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    getCurrentUser();
  }, [getCurrentUser]);

  useEffect(() => {
    if (!supportEnabled) {
      router.replace("/portal");
      return;
    }

    if (view === "list") {
      fetchMyTickets();
    }

    if (view === "create") {
      fetchMyQuotes();
    }
  }, [supportEnabled, router, view, fetchMyTickets, fetchMyQuotes]);

  useEffect(() => {
    if (!currentTicket?.id) return;

    fetchMessages(currentTicket.id);

    const channel = supabase
      .channel(`client-ticket-${currentTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${currentTicket.id}`,
        },
        async () => {
          await fetchMessages(currentTicket.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTicket?.id, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openTicket = (ticketId: string) => {
    setActiveTicketId(ticketId);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !serviceOrderId || !resolvedClientId) return;

    setIsSubmitting(true);

    const now = new Date();
    let slaHours = 24;

    if (priority === "critical") slaHours = 2;
    if (priority === "high") slaHours = 4;
    if (priority === "low") slaHours = 48;

    const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("tickets").insert([
      {
        title,
        description,
        service_order_id: serviceOrderId,
        client_id: resolvedClientId,
        category,
        priority,
        status: "open",
        sla_deadline: slaDeadline,
      },
    ]);

    if (!error) {
      setTitle("");
      setDescription("");
      setServiceOrderId("");
      setCategory("general");
      setPriority("medium");
      setView("list");
      await fetchMyTickets();
    }

    setIsSubmitting(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !currentTicket?.id || !currentUserId) return;

    setIsSending(true);

    const { error } = await supabase.from("ticket_messages").insert([
      {
        ticket_id: currentTicket.id,
        sender_id: currentUserId,
        message: newMessage.trim(),
      },
    ]);

    if (!error) {
      setNewMessage("");
      await fetchMessages(currentTicket.id);
    }

    setIsSending(false);
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "resolved":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cs-green/10 text-cs-green border border-cs-green/20">
            <CheckCircle size={14} /> {statusLabels.resolved}
          </span>
        );
      case "in_progress":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cs-gold/10 text-cs-gold border border-cs-gold/20">
            <Clock size={14} /> {statusLabels.in_progress}
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle size={14} /> {statusLabels.open}
          </span>
        );
    }
  };

  if (!supportEnabled) {
    return null;
  }

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
                  Qual orçamento/evento está apresentando problema? *
                </label>
                <select
                  required
                  value={serviceOrderId}
                  onChange={(e) => setServiceOrderId(e.target.value)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                >
                  <option value="">Selecione...</option>
                  {quotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {quote.title || "Evento sem título"}
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
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
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
              Central de {supportMenuLabel}
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

        {activeTicketId && currentTicket && (
          <div className="bg-surface border border-surface/50 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                {getStatusBadge(currentTicket.status)}
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-background px-2 py-1 rounded">
                  {priorityLabels[currentTicket.priority]}
                </span>
              </div>

              <button
                onClick={() => setActiveTicketId(null)}
                className="flex items-center gap-2 text-text-secondary hover:text-white"
              >
                <ArrowLeft size={16} /> Fechar
              </button>
            </div>

            <h3 className="text-xl font-bold text-white">{currentTicket.title}</h3>
            <p className="text-sm text-text-secondary">{currentTicket.description || "Sem descrição."}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-text-secondary">
              <div>
                <span className="block text-[10px] uppercase tracking-wider mb-1">Evento</span>
                <span className="text-white">
                  {currentTicket.service_orders?.quotes?.title || "Evento não especificado"}
                </span>
              </div>

              <div>
                <span className="block text-[10px] uppercase tracking-wider mb-1">SLA</span>
                <span className="text-white">
                  {currentTicket.sla_deadline
                    ? new Date(currentTicket.sla_deadline).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "Não definido"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-surface/50">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">Histórico</h4>
                <div className="max-h-80 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {messages.length === 0 ? (
                    <p className="text-sm text-text-secondary">Nenhuma mensagem ainda.</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                          msg.sender_id === currentUserId
                            ? "ml-auto bg-cs-green text-white rounded-tr-sm"
                            : "bg-background border border-surface/50 text-white rounded-tl-sm"
                        }`}
                      >
                        {msg.message}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form onSubmit={handleSendMessage} className="space-y-3">
                <label className="block text-sm font-medium text-text-secondary">Responder</label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={5}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors resize-none"
                  placeholder={`Digite sua resposta para ${clientSingular.toLowerCase()}...`}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSending || !newMessage.trim()}
                    className="flex items-center gap-2 rounded-lg bg-cs-gold text-black py-3 px-6 font-bold shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50"
                  >
                    {isSending ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>
                        <Send size={18} /> Enviar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="animate-spin text-cs-gold" size={40} />
            </div>
          ) : tickets.length === 0 ? (
            <div className="col-span-full bg-surface border border-surface/50 rounded-2xl p-12 text-center">
              <Ticket size={48} className="mx-auto text-surface/50 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Nenhum chamado aberto</h3>
              <p className="text-text-secondary">
                Seus eventos estão ocorrendo perfeitamente. Se precisar de ajuda, clique em Novo Chamado.
              </p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket.id)}
                className="text-left bg-surface border border-surface/50 rounded-2xl p-6 hover:border-cs-gold/30 transition-colors flex flex-col h-full shadow-md"
              >
                <div className="flex justify-between items-start mb-4">
                  {getStatusBadge(ticket.status)}
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-background px-2 py-1 rounded">
                    {priorityLabels[ticket.priority]}
                  </span>
                </div>

                <h4 className="text-lg font-bold text-white mb-2 line-clamp-2">{ticket.title}</h4>
                <p className="text-sm text-text-secondary mb-4 line-clamp-3 flex-1">
                  {ticket.description}
                </p>

                <div className="pt-4 border-t border-surface/50 mt-auto">
                  <p className="text-xs font-medium text-cs-gold truncate mb-1">
                    {ticket.service_orders?.quotes?.title || "Evento não especificado"}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    Aberto em {new Date(ticket.created_at).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(ticket.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}