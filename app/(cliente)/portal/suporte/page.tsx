"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Paperclip,
  X,
  Download,
  BookOpen,
  ChevronRight,
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

type ServiceOrderOption = {
  id: string;
  label: string;
};

type KBArticle = {
  id: string;
  title: string;
  content: string;
  department: Department;
};

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
  service_order_id: string | null;
  client_id: string | null;
  service_orders?: { quotes?: { title?: string | null } | null } | null;
};

type TicketMessageRow = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_staff?: boolean;
  sender_name?: string;
  ticket_attachments?: AttachmentRow[];
};

export default function ClientSupportPage() {
  const router = useRouter();
  const { systemPreferences, resolvedClientId } = useSettings();

  const supportEnabled = systemPreferences?.feature_toggles?.enable_support ?? true;
  const labels = systemPreferences?.custom_labels;
  const serviceOrderSingular = labels?.entity_service_order_singular || "Projeto";
  const supportMenuLabel = labels?.menu_support || "Suporte";

  // ─── State ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState<"list" | "create">("list");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessageRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [serviceOrderOptions, setServiceOrderOptions] = useState<ServiceOrderOption[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [formAttachedFiles, setFormAttachedFiles] = useState<File[]>([]);

  // KB suggestion state
  const [kbSuggestions, setKbSuggestions] = useState<KBArticle[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [openArticle, setOpenArticle] = useState<KBArticle | null>(null);

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [department, setDepartment] = useState<Department>("support");
  const [priority, setPriority] = useState<TicketPriority>("medium");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const kbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTicket =
    tickets.find((t) => t.id === activeTicketId) || null;

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

  const getDepartmentLabel = (dept: Department) =>
    DEPARTMENTS.find((d) => d.value === dept)?.label || dept;

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  // ─── Data fetching ───────────────────────────────────────────────────────────
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
      .select(
        `id, title, description, status, priority, department,
         sla_deadline, created_at, service_order_id, client_id,
         service_orders ( quotes ( title ) )`
      )
      .eq("client_id", resolvedClientId)
      .order("created_at", { ascending: false });

    setTickets(!error && data ? (data as TicketRow[]) : []);
    setLoading(false);
  }, [resolvedClientId]);

  const fetchServiceOrders = useCallback(async () => {
    if (!resolvedClientId) return;

    // Fetch quotes with their linked service_orders for this client
    const { data, error } = await supabase
      .from("quotes")
      .select("id, title, service_orders(id)")
      .eq("client_id", resolvedClientId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const options: ServiceOrderOption[] = [];
      for (const quote of data as any[]) {
        const serviceOrders = Array.isArray(quote.service_orders)
          ? quote.service_orders
          : quote.service_orders
          ? [quote.service_orders]
          : [];

        for (const so of serviceOrders) {
          if (so?.id) {
            options.push({
              id: so.id,
              label: quote.title || "Projeto sem título",
            });
          }
        }
      }
      setServiceOrderOptions(options);
    }
  }, [resolvedClientId]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    const { data: messagesData, error: messagesError } = await supabase
      .from("ticket_messages")
      .select("id, ticket_id, sender_id, message, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (messagesError || !messagesData) {
      setMessages([]);
      return;
    }

    const senderIds = [...new Set(messagesData.map((m: any) => m.sender_id))];
    const messageIds = messagesData.map((m: any) => m.id);

    const [{ data: profilesData }, { data: attachmentsData }] = await Promise.all([
      senderIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name, role, email")
            .in("id", senderIds)
        : Promise.resolve({ data: [] }),
      messageIds.length
        ? supabase
            .from("ticket_attachments")
            .select("id, message_id, file_url, file_name, file_size")
            .in("message_id", messageIds)
        : Promise.resolve({ data: [] }),
    ]);

    const merged = messagesData.map((msg: any) => {
      const profile = (profilesData || []).find((p: any) => p.id === msg.sender_id);
      return {
        ...msg,
        sender: profile || null,
        ticket_attachments: (attachmentsData || []).filter(
          (att: any) => att.message_id === msg.id
        ),
        is_staff: profile?.role !== "client" && profile?.role !== "student",
        sender_name:
          profile?.full_name ||
          profile?.email?.split("@")[0] ||
          "Usuário",
      };
    });

    setMessages(merged as TicketMessageRow[]);
  }, []);

  const searchKnowledgeBase = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setKbSuggestions([]);
      return;
    }
    setKbLoading(true);
    const { data } = await supabase
      .from("knowledge_base")
      .select("id, title, content, department")
      .ilike("title", `%${query}%`)
      .limit(4);
    setKbSuggestions((data as KBArticle[]) || []);
    setKbLoading(false);
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

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !serviceOrderId || !resolvedClientId) return;

    setIsSubmitting(true);

    const slaHoursMap: Record<TicketPriority, number> = {
      critical: 2,
      high: 4,
      medium: 24,
      low: 48,
    };
    const slaDeadline = new Date(
      Date.now() + slaHoursMap[priority] * 60 * 60 * 1000
    ).toISOString();

    const { data: ticketData, error } = await supabase
      .from("tickets")
      .insert([
        {
          title,
          description,
          service_order_id: serviceOrderId,
          client_id: resolvedClientId,
          department,
          priority,
          status: "open",
          sla_deadline: slaDeadline,
        },
      ])
      .select("id")
      .single();

    if (!error && ticketData) {
      // Upload initial attachments as a system message
      if (formAttachedFiles.length > 0) {
        const { data: msgData } = await supabase
          .from("ticket_messages")
          .insert([
            {
              ticket_id: ticketData.id,
              sender_id: currentUserId,
              message: `[${formAttachedFiles.length} anexo(s) enviado(s) na abertura do chamado]`,
            },
          ])
          .select("id")
          .single();
        if (msgData) {
          await uploadAttachments(formAttachedFiles, ticketData.id, msgData.id);
        }
      }

      setTitle("");
      setDescription("");
      setServiceOrderId("");
      setDepartment("support");
      setPriority("medium");
      setFormAttachedFiles([]);
      setKbSuggestions([]);
      if (formFileInputRef.current) formFileInputRef.current.value = "";
      setView("list");
      await fetchMyTickets();
    }

    setIsSubmitting(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (!newMessage.trim() && attachedFiles.length === 0) ||
      !currentTicket?.id ||
      !currentUserId
    )
      return;

    setIsSending(true);
    const messageText =
      newMessage.trim() ||
      (attachedFiles.length > 0 ? `[${attachedFiles.length} anexo(s)]` : "");

    const { data: msgData, error } = await supabase
      .from("ticket_messages")
      .insert([
        {
          ticket_id: currentTicket.id,
          sender_id: currentUserId,
          message: messageText,
        },
      ])
      .select("id")
      .single();

    if (!error && msgData) {
      if (attachedFiles.length > 0) {
        await uploadAttachments(attachedFiles, currentTicket.id, msgData.id);
      }
      setNewMessage("");
      setAttachedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchMessages(currentTicket.id);
    }
    setIsSending(false);
  };

  // ─── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    getCurrentUser();
  }, [getCurrentUser]);

  useEffect(() => {
    if (!supportEnabled) {
      router.replace("/portal");
      return;
    }
    if (view === "list") fetchMyTickets();
    if (view === "create") fetchServiceOrders();
  }, [supportEnabled, router, view, fetchMyTickets, fetchServiceOrders]);

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

  // KB debounced search on title change
  useEffect(() => {
    if (kbDebounceRef.current) clearTimeout(kbDebounceRef.current);
    kbDebounceRef.current = setTimeout(() => {
      searchKnowledgeBase(title);
    }, 400);
    return () => {
      if (kbDebounceRef.current) clearTimeout(kbDebounceRef.current);
    };
  }, [title, searchKnowledgeBase]);

  if (!supportEnabled) return null;

  // ─── Article reader overlay ──────────────────────────────────────────────────
  if (openArticle) {
    return (
      <div className="flex-1 bg-background p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <button
            onClick={() => setOpenArticle(null)}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Voltar para o chamado
          </button>

          <div className="bg-surface border border-surface/50 p-8 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={18} className="text-cs-gold" />
              <span className="text-xs text-text-secondary uppercase tracking-wider">
                Base de Conhecimento
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {getDepartmentLabel(openArticle.department)}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-6">{openArticle.title}</h2>

            <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed whitespace-pre-wrap">
              {openArticle.content}
            </div>

            <div className="mt-8 pt-6 border-t border-surface/50">
              <p className="text-sm text-text-secondary mb-4">
                Este artigo resolveu seu problema?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setOpenArticle(null)}
                  className="flex items-center gap-2 rounded-lg bg-cs-green text-white py-2 px-5 text-sm font-bold hover:bg-opacity-90 transition-all"
                >
                  Sim, problema resolvido
                </button>
                <button
                  onClick={() => setOpenArticle(null)}
                  className="flex items-center gap-2 rounded-lg border border-surface/50 bg-surface text-text-secondary py-2 px-5 text-sm font-medium hover:text-white transition-all"
                >
                  Não, continuar abrindo chamado
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Create view ─────────────────────────────────────────────────────────────
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
                Abrir Novo Chamado
              </h2>
              <p className="text-text-secondary mt-2">
                Descreva o problema com o máximo de detalhes para agilizar o
                atendimento.
              </p>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-6">
              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Departamento *
                </label>
                <select
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project/Service Order */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {serviceOrderSingular} relacionado *
                </label>
                <select
                  required
                  value={serviceOrderId}
                  onChange={(e) => setServiceOrderId(e.target.value)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                >
                  <option value="">Selecione...</option>
                  {serviceOrderOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title with KB suggestions */}
              <div className="relative">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Resumo do problema *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                  placeholder="Descreva brevemente o que está acontecendo..."
                />

                {/* KB suggestions dropdown */}
                {(kbSuggestions.length > 0 || kbLoading) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface/50 rounded-lg shadow-xl z-10 overflow-hidden">
                    <div className="px-3 py-2 border-b border-surface/50 flex items-center gap-2">
                      <BookOpen size={14} className="text-cs-gold" />
                      <p className="text-[11px] text-text-secondary uppercase tracking-wider">
                        Artigos que podem ajudar
                      </p>
                      {kbLoading && (
                        <Loader2 size={12} className="animate-spin text-cs-gold ml-auto" />
                      )}
                    </div>
                    {kbSuggestions.map((article) => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => setOpenArticle(article)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-background/50 transition-colors text-left group"
                      >
                        <div>
                          <p className="text-sm font-medium text-white group-hover:text-cs-gold transition-colors">
                            {article.title}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {getDepartmentLabel(article.department)}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-text-secondary shrink-0" />
                      </button>
                    ))}
                    <div className="px-4 py-2 border-t border-surface/50">
                      <p className="text-[11px] text-text-secondary">
                        Nenhum artigo resolveu? Continue preenchendo o formulário abaixo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Nível de urgência *
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors"
                >
                  <option value="low">Baixa — pode aguardar</option>
                  <option value="medium">Média — incomoda, mas não paralisa</option>
                  <option value="high">Alta — prejudica o andamento</option>
                  <option value="critical">Crítica — operação parada</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Descrição detalhada *
                </label>
                <textarea
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors resize-none"
                  placeholder="Descreva o que está acontecendo, desde quando e quais passos você já tentou..."
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Anexos (opcional)
                </label>
                <input
                  ref={formFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files)
                      setFormAttachedFiles((prev) => [
                        ...prev,
                        ...Array.from(e.target.files!),
                      ]);
                  }}
                />
                <button
                  type="button"
                  onClick={() => formFileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-surface/80 bg-background/50 px-4 py-3 text-sm text-text-secondary hover:text-white hover:border-cs-gold/50 transition-colors w-full"
                >
                  <Paperclip size={16} />
                  Clique para adicionar arquivos
                </button>
                {formAttachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formAttachedFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 bg-surface border border-surface/50 rounded px-2 py-1 text-xs text-white"
                      >
                        <Paperclip size={12} className="text-cs-gold shrink-0" />
                        <span className="max-w-[140px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setFormAttachedFiles((prev) =>
                              prev.filter((_, idx) => idx !== i)
                            )
                          }
                          className="text-text-secondary hover:text-red-400 transition-colors ml-1"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-6 border-t border-surface/50">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-cs-gold text-black py-3 px-8 font-bold shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    "Enviar Chamado"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-surface/50 shadow-lg">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Ticket className="text-cs-gold" size={28} />
              Central de {supportMenuLabel}
            </h2>
            <p className="text-text-secondary mt-1">
              Acompanhe o status dos seus chamados.
            </p>
          </div>
          <button
            onClick={() => setView("create")}
            className="flex items-center gap-2 rounded-lg bg-cs-gold text-black py-3 px-6 font-bold shadow-lg hover:bg-opacity-90 transition-all"
          >
            <Plus size={20} /> Novo Chamado
          </button>
        </div>

        {/* Active ticket detail */}
        {activeTicketId && currentTicket && (
          <div className="bg-surface border border-surface/50 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                {getStatusBadge(currentTicket.status)}
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-background px-2 py-1 rounded">
                  {priorityLabels[currentTicket.priority]}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded border bg-purple-500/10 text-purple-400 border-purple-500/20">
                  {getDepartmentLabel(currentTicket.department)}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveTicketId(null);
                  setMessages([]);
                }}
                className="flex items-center gap-2 text-text-secondary hover:text-white text-sm transition-colors"
              >
                <X size={16} /> Fechar
              </button>
            </div>

            <h3 className="text-xl font-bold text-white">{currentTicket.title}</h3>
            <p className="text-sm text-text-secondary">
              {currentTicket.description || "Sem descrição."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-text-secondary">
              <div>
                <span className="block text-[10px] uppercase tracking-wider mb-1">
                  {serviceOrderSingular}
                </span>
                <span className="text-white">
                  {currentTicket.service_orders?.quotes?.title || "Não especificado"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider mb-1">
                  Prazo SLA
                </span>
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
              {/* Messages */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white">Histórico</h4>
                <div className="max-h-80 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {messages.length === 0 ? (
                    <p className="text-sm text-text-secondary">
                      Nenhuma mensagem ainda.
                    </p>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          {!isMe && msg.is_staff && (
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className="text-[10px] font-medium text-text-secondary">
                                {msg.sender_name}
                              </span>
                              <span className="text-[8px] bg-cs-green/20 text-cs-green px-1.5 py-0.5 rounded uppercase">
                                Equipe
                              </span>
                            </div>
                          )}
                          <div
                            className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                              isMe
                                ? "bg-cs-gold text-black rounded-tr-sm"
                                : "bg-background border border-surface/50 text-white rounded-tl-sm"
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
                                    className="flex items-center gap-2 text-xs bg-black/10 rounded px-2 py-1.5 hover:bg-black/20 transition-colors"
                                  >
                                    <Download size={12} className="shrink-0" />
                                    <span className="truncate max-w-[160px]">{att.file_name}</span>
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
                          <span className="text-[10px] text-text-secondary mt-1 px-1">
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Reply form */}
              <form onSubmit={handleSendMessage} className="space-y-3">
                <label className="block text-sm font-medium text-text-secondary">
                  Responder
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={5}
                  className="block w-full rounded-lg border border-surface bg-background px-4 py-3 text-white focus:border-cs-gold focus:outline-none focus:ring-1 focus:ring-cs-gold transition-colors resize-none"
                  placeholder="Digite sua mensagem..."
                />

                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 bg-surface border border-surface/50 rounded px-2 py-1 text-xs text-white"
                      >
                        <Paperclip size={12} className="text-cs-gold shrink-0" />
                        <span className="max-w-[100px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachedFiles((prev) =>
                              prev.filter((_, idx) => idx !== i)
                            )
                          }
                          className="text-text-secondary hover:text-red-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border border-surface bg-surface text-text-secondary px-4 py-2.5 text-sm hover:text-white transition-colors"
                  >
                    <Paperclip size={16} /> Anexar
                  </button>
                  <button
                    type="submit"
                    disabled={isSending || (!newMessage.trim() && attachedFiles.length === 0)}
                    className="flex items-center gap-2 rounded-lg bg-cs-gold text-black py-2.5 px-5 font-bold hover:bg-opacity-90 transition-all disabled:opacity-50"
                  >
                    {isSending ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>
                        <Send size={16} /> Enviar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Ticket cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="animate-spin text-cs-gold" size={40} />
            </div>
          ) : tickets.length === 0 ? (
            <div className="col-span-full bg-surface border border-surface/50 rounded-2xl p-12 text-center">
              <Ticket size={48} className="mx-auto text-surface/50 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Nenhum chamado aberto
              </h3>
              <p className="text-text-secondary">
                Tudo funcionando. Se precisar de ajuda, clique em Novo Chamado.
              </p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setActiveTicketId(ticket.id)}
                className={`text-left bg-surface border rounded-2xl p-6 hover:border-cs-gold/30 transition-colors flex flex-col h-full shadow-md ${
                  activeTicketId === ticket.id
                    ? "border-cs-gold/50"
                    : "border-surface/50"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  {getStatusBadge(ticket.status)}
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider bg-background px-2 py-1 rounded">
                    {priorityLabels[ticket.priority]}
                  </span>
                </div>

                <h4 className="text-lg font-bold text-white mb-2 line-clamp-2">
                  {ticket.title}
                </h4>
                <p className="text-sm text-text-secondary mb-4 line-clamp-3 flex-1">
                  {ticket.description}
                </p>

                <div className="pt-4 border-t border-surface/50 mt-auto">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-500/20">
                      {getDepartmentLabel(ticket.department)}
                    </span>
                    <p className="text-[10px] text-text-secondary">
                      {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <p className="text-xs font-medium text-cs-gold truncate mt-2">
                    {ticket.service_orders?.quotes?.title || "Projeto não especificado"}
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