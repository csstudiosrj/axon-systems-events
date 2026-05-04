"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useSettings } from "../../providers/SettingsProvider";
import {
  Ticket,
  Loader2,
  ArrowLeft,
  Clock,
  MessageSquare,
  Send,
  Paperclip,
  X,
  Download,
  Filter,
  Circle,
} from "lucide-react";

type TicketStatus = "open" | "in_progress" | "resolved";
type TicketPriority = "low" | "medium" | "high" | "critical";
type Department = "support" | "financial" | "commercial" | "administrative" | "hr";

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "support", label: "Suporte" },
  { value: "financial", label: "Financeiro" },
  { value: "commercial", label: "Comercial" },
  { value: "administrative", label: "Administrativo" },
  { value: "hr", label: "RH" },
];

type AttachmentRow = {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
};

type TicketRow = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  department: Department;
  sla_deadline: string | null;
  created_at: string;
  clients?: { company_name?: string | null; contact_name?: string | null } | null;
  service_orders?: { quotes?: { title?: string | null } | null } | null;
};

type TicketMessageRow = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender?: { full_name?: string | null; role?: string | null; email?: string | null } | null;
  ticket_attachments?: AttachmentRow[];
};

export default function SuportePage() {
  const router = useRouter();
  const { systemPreferences } = useSettings();

  const supportEnabled = systemPreferences?.feature_toggles?.enable_support ?? true;
  const labels = systemPreferences?.custom_labels;
  const clientSingular = labels?.entity_client_singular || "Cliente";
  const serviceOrderSingular = labels?.entity_service_order_singular || "Projeto";
  const supportMenuLabel = labels?.menu_support || "Suporte";

  const [view, setView] = useState<"list" | "details">("list");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");

  const [activeTicket, setActiveTicket] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<TicketMessageRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [lastViewedMap, setLastViewedMap] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const statusOptions = [
    { value: "open" as TicketStatus, label: "Aberto (Aguardando)" },
    { value: "in_progress" as TicketStatus, label: "Em Andamento" },
    { value: "resolved" as TicketStatus, label: "Resolvido" },
  ];

  const getDepartmentLabel = (dept: Department) =>
    DEPARTMENTS.find((d) => d.value === dept)?.label || dept;

  const getStatusBadgeClass = (status: TicketStatus) => {
    if (status === "open") return "bg-red-500/10 text-red-400 border-red-500/20";
    if (status === "in_progress") return "bg-cs-gold/10 text-cs-gold border-cs-gold/20";
    return "bg-cs-green/10 text-cs-green border-cs-green/20";
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    const config: Record<TicketPriority, string> = {
      low: "bg-gray-500/10 text-gray-400 border-gray-500/20",
      medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      critical: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return (
      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${config[priority]}`}>
        {priorityLabels[priority]}
      </span>
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCurrentUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) setCurrentUserId(session.user.id);
  }, []);

  const loadLastViewedMap = useCallback(() => {
    try {
      const stored = localStorage.getItem("ticket_last_viewed_admin");
      if (stored) setLastViewedMap(JSON.parse(stored));
    } catch {}
  }, []);

  const markTicketAsViewed = useCallback((ticketId: string) => {
    const now = new Date().toISOString();
    setLastViewedMap((prev) => {
      const updated = { ...prev, [ticketId]: now };
      try {
        localStorage.setItem("ticket_last_viewed_admin", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoadingList(true);
    setPageError(null);

    const { data, error } = await supabase
      .from("tickets")
      .select(
        `id, title, description, status, priority, department,
         sla_deadline, created_at,
         clients ( company_name, contact_name ),
         service_orders ( quotes ( title ) )`
      )
      .order("created_at", { ascending: false });

    if (error) {
      setPageError("Não foi possível carregar os chamados.");
      setTickets([]);
    } else {
      setTickets((data as TicketRow[]) || []);
    }
    setLoadingList(false);
  }, []);

  const fetchMessages = useCallback(async (ticketId: string) => {
    const { data, error } = await supabase
      .from("ticket_messages")
      .select(
        `id, ticket_id, sender_id, message, created_at,
         sender:profiles!ticket_messages_sender_id_fkey(full_name, role, email),
         ticket_attachments(id, file_url, file_name, file_size)`
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (!error) setMessages((data as TicketMessageRow[]) || []);
  }, []);

  const openTicketDetails = useCallback(
    async (ticket: TicketRow) => {
      setLoadingDetails(true);
      setActiveTicket(ticket);
      setMessages([]);
      setAttachedFiles([]);
      setNewMessage("");
      setView("details");
      markTicketAsViewed(ticket.id);
      await fetchMessages(ticket.id);
      setLoadingDetails(false);
    },
    [fetchMessages, markTicketAsViewed]
  );

  const updateTicketStatus = useCallback(async (id: string, newStatus: TicketStatus) => {
    const { error } = await supabase
      .from("tickets")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) return;
    setActiveTicket((prev) => (prev?.id === id ? { ...prev, status: newStatus } : prev));
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  }, []);

  const uploadAttachments = useCallback(
    async (files: File[], ticketId: string, messageId: string) => {
      for (const file of files) {
        const filePath = `tickets/${ticketId}/${messageId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("files-main")
          .upload(filePath, file);
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("files-main")
            .getPublicUrl(filePath);
          await supabase.from("ticket_attachments").insert({
            ticket_id: ticketId,
            message_id: messageId,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
          });
        }
      }
    },
    []
  );

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (
        (!newMessage.trim() && attachedFiles.length === 0) ||
        !activeTicket?.id ||
        !currentUserId
      )
        return;

      setIsSending(true);
      const messageText =
        newMessage.trim() ||
        (attachedFiles.length > 0 ? `[${attachedFiles.length} anexo(s)]` : "");

      const { data: msgData, error } = await supabase
        .from("ticket_messages")
        .insert([{ ticket_id: activeTicket.id, sender_id: currentUserId, message: messageText }])
        .select("id")
        .single();

      if (!error && msgData) {
        if (attachedFiles.length > 0) {
          await uploadAttachments(attachedFiles, activeTicket.id, msgData.id);
        }
        setNewMessage("");
        setAttachedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchMessages(activeTicket.id);
        if (activeTicket.status === "open") {
          await updateTicketStatus(activeTicket.id, "in_progress");
        }
      }
      setIsSending(false);
    },
    [
      newMessage,
      attachedFiles,
      activeTicket,
      currentUserId,
      fetchMessages,
      updateTicketStatus,
      uploadAttachments,
    ]
  );

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterDepartment !== "all" && t.department !== filterDepartment) return false;
    return true;
  });

  useEffect(() => {
    getCurrentUser();
    loadLastViewedMap();
  }, [getCurrentUser, loadLastViewedMap]);

  useEffect(() => {
    if (!supportEnabled) {
      router.replace("/admin");
      return;
    }
    if (view === "list") fetchTickets();
  }, [supportEnabled, router, view, fetchTickets]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeTicket?.id) return;
    const channel = supabase
      .channel(`admin-ticket-messages-${activeTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${activeTicket.id}`,
        },
        async () => {
          await fetchMessages(activeTicket.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTicket?.id, fetchMessages]);

  if (!supportEnabled) return null;

  // ─── Details view ────────────────────────────────────────────────────────────
  if (view === "details" && activeTicket) {
    const isOverdue =
      !!activeTicket.sla_deadline &&
      new Date(activeTicket.sla_deadline) < new Date() &&
      activeTicket.status !== "resolved";

    return (
      <div className="space-y-6 max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between shrink-0">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar para {supportMenuLabel}
          </button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">Status:</span>
            <select
              value={activeTicket.status}
              onChange={(e) =>
                updateTicketStatus(activeTicket.id, e.target.value as TicketStatus)
              }
              className="bg-surface border border-surface/50 text-white text-sm rounded-md px-4 py-2 focus:border-cs-green focus:outline-none font-bold cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Left — ticket info */}
          <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-surface border border-surface/50 p-6 rounded-lg">
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="bg-background px-2 py-1 rounded text-[10px] font-mono text-text-secondary uppercase">
                  #{activeTicket.id.split("-")[0]}
                </span>
                {getPriorityBadge(activeTicket.priority)}
                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border bg-purple-500/10 text-purple-400 border-purple-500/20">
                  {getDepartmentLabel(activeTicket.department)}
                </span>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">{activeTicket.title}</h2>
              <p className="text-sm text-text-secondary mb-6">
                {activeTicket.description || "Sem descrição."}
              </p>

              <div className="space-y-4 border-t border-surface/50 pt-4">
                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">
                    {clientSingular}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {activeTicket.clients?.company_name || "Não informado"}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {activeTicket.clients?.contact_name || ""}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">
                    {serviceOrderSingular}
                  </p>
                  <p className="text-sm font-medium text-cs-gold">
                    {activeTicket.service_orders?.quotes?.title || "Não vinculado"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">
                    Prazo SLA
                  </p>
                  <div
                    className={`flex items-center gap-1.5 text-sm font-medium ${
                      isOverdue ? "text-red-400" : "text-cs-green"
                    }`}
                  >
                    <Clock size={14} />
                    {activeTicket.sla_deadline
                      ? new Date(activeTicket.sla_deadline).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "Não definido"}
                    {isOverdue && (
                      <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded ml-1">
                        VENCIDO
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">
                    Aberto em
                  </p>
                  <p className="text-sm text-white">
                    {new Date(activeTicket.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — chat */}
          <div className="lg:col-span-2 bg-surface border border-surface/50 rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b border-surface/50 bg-background/50 shrink-0">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <MessageSquare className="text-cs-green" size={18} />
                Histórico de Atendimento
              </h3>
            </div>

            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6 bg-background/20">
              {loadingDetails ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 size={28} className="animate-spin text-cs-green" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                  <MessageSquare size={48} className="mb-4 opacity-20" />
                  <p>Nenhuma mensagem ainda.</p>
                  <p className="text-xs mt-1">
                    Envie a primeira mensagem para iniciar o atendimento.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  const isClient =
                    msg.sender?.role === "client" || msg.sender?.role === "student";
                  const senderName =
                    msg.sender?.full_name ||
                    msg.sender?.email?.split("@")[0] ||
                    "Usuário";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-medium text-text-secondary">
                          {senderName}
                        </span>
                        {!isClient && (
                          <span className="text-[8px] bg-cs-green/20 text-cs-green px-1.5 py-0.5 rounded uppercase">
                            Staff
                          </span>
                        )}
                        <span className="text-[10px] text-surface/80">•</span>
                        <span className="text-[10px] text-text-secondary">
                          {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                          isMe
                            ? "bg-cs-green text-white rounded-tr-sm"
                            : isClient
                            ? "bg-surface border border-surface/50 text-white rounded-tl-sm"
                            : "bg-surface border border-cs-green/30 text-white rounded-tl-sm"
                        }`}
                      >
                        {msg.message}

                        {msg.ticket_attachments && msg.ticket_attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.ticket_attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs bg-black/20 rounded px-2 py-1.5 hover:bg-black/30 transition-colors"
                              >
                                <Download size={12} className="shrink-0" />
                                <span className="truncate max-w-[180px]">{att.file_name}</span>
                                {att.file_size && (
                                  <span className="opacity-60 shrink-0 ml-auto">
                                    {formatFileSize(att.file_size)}
                                  </span>
                                )}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-background/50 border-t border-surface/50 shrink-0">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-surface border border-surface/50 rounded px-2 py-1 text-xs text-white"
                    >
                      <Paperclip size={12} className="text-cs-green shrink-0" />
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button
                        onClick={() =>
                          setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-text-secondary hover:text-red-400 transition-colors ml-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua resposta..."
                  className="flex-1 rounded-full border border-surface bg-background px-4 py-3 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green text-sm transition-colors"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files)
                      setAttachedFiles((prev) => [
                        ...prev,
                        ...Array.from(e.target.files!),
                      ]);
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivo"
                  className="w-12 h-12 rounded-full border border-surface bg-surface text-text-secondary hover:text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <Paperclip size={18} />
                </button>

                <button
                  type="submit"
                  disabled={
                    isSending || (!newMessage.trim() && attachedFiles.length === 0)
                  }
                  className="w-12 h-12 rounded-full bg-cs-green text-white flex items-center justify-center hover:bg-opacity-90 transition-all disabled:opacity-50 shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Send size={18} className="ml-0.5" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Ticket className="text-cs-green" size={20} />
            Central de {supportMenuLabel}
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Gerenciamento de chamados e atendimento ao {clientSingular.toLowerCase()}.
          </p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-surface border border-surface/50 rounded-lg px-3 py-2">
          <Filter size={14} className="text-text-secondary" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Todos os status</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-surface border border-surface/50 rounded-lg px-3 py-2">
          <Filter size={14} className="text-text-secondary" />
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
          >
            <option value="all">Todos os departamentos</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Chamado</th>
                <th className="px-6 py-4 font-medium">
                  {clientSingular} / {serviceOrderSingular}
                </th>
                <th className="px-6 py-4 font-medium">Departamento</th>
                <th className="px-6 py-4 font-medium">Prioridade</th>
                <th className="px-6 py-4 font-medium">Prazo SLA</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-surface/50">
              {loadingList ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <Loader2 className="animate-spin mx-auto text-cs-green" size={24} />
                  </td>
                </tr>
              ) : pageError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-red-400">
                    {pageError}
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                    Nenhum chamado encontrado.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  const isOverdue =
                    !!ticket.sla_deadline &&
                    new Date(ticket.sla_deadline) < new Date() &&
                    ticket.status !== "resolved";
                  const isUnread = !lastViewedMap[ticket.id] && ticket.status !== "resolved";

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => openTicketDetails(ticket)}
                      className="hover:bg-background/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <Circle size={8} className="text-cs-green fill-cs-green shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-white">{ticket.title}</p>
                            <p className="text-[10px] text-text-secondary mt-1 uppercase">
                              #{ticket.id.split("-")[0]}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-medium text-white">
                          {ticket.clients?.company_name || "Não informado"}
                        </p>
                        <p className="text-xs text-cs-gold truncate max-w-[160px]">
                          {ticket.service_orders?.quotes?.title || "Não vinculado"}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border bg-purple-500/10 text-purple-400 border-purple-500/20">
                          {getDepartmentLabel(ticket.department)}
                        </span>
                      </td>

                      <td className="px-6 py-4">{getPriorityBadge(ticket.priority)}</td>

                      <td className="px-6 py-4">
                        <div
                          className={`flex items-center gap-1.5 text-xs font-medium ${
                            isOverdue ? "text-red-400" : "text-text-secondary"
                          }`}
                        >
                          <Clock size={14} />
                          {ticket.sla_deadline
                            ? new Date(ticket.sla_deadline).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Não definido"}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(
                            ticket.status
                          )}`}
                        >
                          {statusLabels[ticket.status]}
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