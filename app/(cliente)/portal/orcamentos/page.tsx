"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  ShieldAlert,
  ThumbsDown,
  Timer,
  Truck,
  User,
  Users,
  Wrench,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Quote = {
  id: string;
  title: string;
  status: string;
  final_amount: number;
  client_id: string | null;
  salesperson_id: string | null;
  setup_start_date: string | null;
  setup_end_date: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  teardown_start_date: string | null;
  teardown_end_date: string | null;
  total_equipment_cost: number | null;
  total_labor_cost: number | null;
  total_logistics_cost: number | null;
  // notes: observações internas do admin (leitura para o cliente)
  notes: string | null;
  // client_notes: resposta do cliente (escrita pelo portal, lida pelo admin)
  // Requer coluna TEXT na tabela quotes — adicionar em migration se não existir.
  client_notes: string | null;
  created_at: string;
  salesperson?: { full_name: string; email: string } | null;
};

type QuoteItem = {
  id: string;
  quote_id: string;
  category: "equipment" | "labor" | "logistics";
  description: string;
  quantity: number;
  daily_rate: number;
  days: number;
  total_price: number;
};

type ToastState = { type: "success" | "error"; text: string };
type ActionPanelKey = "approve" | "negotiate" | "postpone" | "reject" | null;

// ─── Constants ────────────────────────────────────────────────────────────────

// Status em que o cliente pode tomar ação
const ACTIONABLE_STATUSES = new Set(["pending_approval", "negotiating"]);

// Statuses que o portal do cliente nunca deve exibir
const HIDDEN_STATUSES = new Set(["draft"]);

// ─── Helpers (fora do componente — sem dependência de estado) ─────────────────

// Retorna boolean simples — type predicate causaria narrowing para `never`
// na negação (!isActionableQuote), já que TypeScript infere o oposto de Quote.
function isActionableQuote(q: Quote | null): boolean {
  return !!q && ACTIONABLE_STATUSES.has(q.status);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalOrcamentosPage() {
  const { resolvedClientId, systemPreferences, companyProfile } = useSettings();

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ type: "success", text: "" });
  const [openActionPanel, setOpenActionPanel] = useState<ActionPanelKey>(null);

  // Form states para cada ação
  const [negotiateMessage, setNegotiateMessage] = useState("");
  const [postponeReason, setPostponeReason] = useState("");
  const [postponeDate, setPostponeDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const toastTimer = useRef<number | null>(null);

  // ─── White-label ────────────────────────────────────────────────────────────

  const labels = systemPreferences?.custom_labels;
  const quoteSingular = labels?.entity_quote_singular || "Orçamento";
  const quotePlural = labels?.entity_quote_plural || "Orçamentos";
  const clientSingular = labels?.entity_client_singular || "Cliente";
  const brandName = companyProfile?.company_name || "ARXUM Systems";
  const brandColor = companyProfile?.primary_color || "#138946";
  const currencyCode = systemPreferences?.currency_code || "BRL";

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToast({ text, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast({ type: "success", text: "" }),
      4500
    );
  }, []);

  const currency = useCallback(
    (value: number | null | undefined) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currencyCode,
      }).format(Number(value || 0)),
    [currencyCode]
  );

  const formatDate = useCallback((value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("pt-BR");
  }, []);

  const formatDateRange = useCallback(
    (start: string | null, end: string | null): string | null => {
      if (!start) return null;
      const startFmt = formatDate(start);
      if (!end || end === start) return startFmt;
      return `${startFmt} → ${formatDate(end)}`;
    },
    [formatDate]
  );

  const translateStatus = useCallback(
    (status: string | null): { label: string; colorClass: string } => {
      const map: Record<string, { label: string; colorClass: string }> = {
        pending_approval: {
          label: "Aguardando sua aprovação",
          colorClass:
            "border-amber-500/20 bg-amber-500/10 text-amber-300",
        },
        negotiating: {
          label: "Em Negociação",
          colorClass:
            "border-blue-500/20 bg-blue-500/10 text-blue-300",
        },
        approved: {
          label: "Aprovado",
          colorClass:
            "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
        },
        postponed: {
          label: "Adiado",
          colorClass:
            "border-orange-500/20 bg-orange-500/10 text-orange-300",
        },
        rejected: {
          label: "Recusado",
          colorClass: "border-red-500/20 bg-red-500/10 text-red-300",
        },
        cancelled: {
          label: "Cancelado",
          colorClass:
            "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
        },
      };
      return (
        map[status || ""] || {
          label: status || "-",
          colorClass: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
        }
      );
    },
    []
  );

  const getStatusBadge = useCallback(
    (status: string | null) => {
      const { label, colorClass } = translateStatus(status);
      return (
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${colorClass}`}
        >
          {label}
        </span>
      );
    },
    [translateStatus]
  );

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchQuotes = useCallback(async () => {
    if (!resolvedClientId) {
      setQuotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from("quotes")
      .select("*, salesperson:profiles(full_name, email)")
      .eq("client_id", resolvedClientId)
      .not("status", "in", `(${[...HIDDEN_STATUSES].map((s) => `"${s}"`).join(",")})`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar orçamentos:", error);
      setQuotes([]);
      showToast(
        "Não foi possível carregar os orçamentos. Tente novamente.",
        "error"
      );
    } else {
      setQuotes((data || []) as Quote[]);
    }
    setLoading(false);
  }, [resolvedClientId, showToast]);

  const fetchItems = useCallback(async (quoteId: string) => {
    setItemsLoading(true);
    const { data, error } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("category", { ascending: true });

    if (error) {
      console.error("Erro ao carregar itens do orçamento:", error);
      setItems([]);
    } else {
      setItems((data || []) as QuoteItem[]);
    }
    setItemsLoading(false);
  }, []);

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Auto-seleciona o primeiro orçamento
  useEffect(() => {
    if (quotes.length > 0 && !selectedId) {
      setSelectedId(quotes[0].id);
    }
  }, [quotes, selectedId]);

  // Ao trocar de orçamento: busca itens, limpa painéis e formulários
  useEffect(() => {
    if (!selectedId) return;
    setItems([]);
    setOpenActionPanel(null);
    setNegotiateMessage("");
    setPostponeReason("");
    setPostponeDate("");
    setRejectReason("");
    void fetchItems(selectedId);
  }, [selectedId, fetchItems]);

  // Realtime — escuta mudanças no orçamento enquanto admin responde
  useEffect(() => {
    if (!resolvedClientId) return;

    const channel = supabase
      .channel(`portal-orcamentos-${resolvedClientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quotes",
          filter: `client_id=eq.${resolvedClientId}`,
        },
        () => void fetchQuotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedClientId, fetchQuotes]);

  // Título dinâmico com indicador de pendências
  useEffect(() => {
    const pending = quotes.filter((q) => q.status === "pending_approval").length;
    document.title =
      pending > 0
        ? `(${pending}) ${quotePlural} pendentes | ${brandName}`
        : `${quotePlural} | ${brandName}`;
  }, [quotes, quotePlural, brandName]);

  // ─── Derivados ──────────────────────────────────────────────────────────────

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedId) || null,
    [quotes, selectedId]
  );

  const summary = useMemo(() => {
    const pending = quotes.filter((q) => q.status === "pending_approval").length;
    const negotiating = quotes.filter((q) => q.status === "negotiating").length;
    const approved = quotes.filter((q) => q.status === "approved").length;
    return { total: quotes.length, pending, negotiating, approved };
  }, [quotes]);

  // Guards reutilizáveis
  const canApprove = useMemo(
    () => isActionableQuote(selectedQuote),
    [selectedQuote]
  );
  const canNegotiate = useMemo(
    () => isActionableQuote(selectedQuote),
    [selectedQuote]
  );
  const canPostpone = useMemo(
    () => isActionableQuote(selectedQuote),
    [selectedQuote]
  );
  const canReject = useMemo(
    () => isActionableQuote(selectedQuote),
    [selectedQuote]
  );

  // Itens agrupados por categoria para a tabela de breakdown
  const groupedItems = useMemo(
    () => ({
      equipment: items.filter((i) => i.category === "equipment"),
      labor: items.filter((i) => i.category === "labor"),
      logistics: items.filter((i) => i.category === "logistics"),
    }),
    [items]
  );

  // ─── Handlers de Ação ───────────────────────────────────────────────────────

  // Aprovar: status → "approved"
  // O admin detecta a mudança e cria a OS automaticamente (arquivo 3).
  const handleApprove = async () => {
    if (!selectedQuote || submitting || !canApprove) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status: "approved" })
        .eq("id", selectedQuote.id);
      if (error) throw error;
      showToast(
        `${quoteSingular} aprovado com sucesso! Nossa equipe entrará em contato para formalizar as condições.`,
        "success"
      );
      setOpenActionPanel(null);
      await fetchQuotes();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Erro inesperado.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Negociar: status → "negotiating" + client_notes com mensagem do cliente
  const handleNegotiate = async () => {
    if (!selectedQuote || submitting || !canNegotiate) return;
    if (!negotiateMessage.trim()) {
      showToast("Descreva o que deseja negociar antes de enviar.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({
          status: "negotiating",
          client_notes: negotiateMessage.trim(),
        })
        .eq("id", selectedQuote.id);
      if (error) throw error;
      showToast(
        "Proposta de negociação enviada. Nossa equipe analisará e retornará em breve.",
        "success"
      );
      setOpenActionPanel(null);
      setNegotiateMessage("");
      await fetchQuotes();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Erro inesperado.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Adiar: status → "postponed" + client_notes com data sugerida e motivo
  const handlePostpone = async () => {
    if (!selectedQuote || submitting || !canPostpone) return;
    if (!postponeReason.trim()) {
      showToast("Informe o motivo do adiamento.", "error");
      return;
    }
    setSubmitting(true);

    const noteContent = [
      "Adiamento solicitado pelo cliente.",
      postponeDate ? `Nova data sugerida: ${formatDate(postponeDate)}` : null,
      `Motivo: ${postponeReason.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { error } = await supabase
        .from("quotes")
        .update({
          status: "postponed",
          client_notes: noteContent,
        })
        .eq("id", selectedQuote.id);
      if (error) throw error;
      showToast(
        "Solicitação de adiamento registrada. Nossa equipe entrará em contato.",
        "success"
      );
      setOpenActionPanel(null);
      setPostponeReason("");
      setPostponeDate("");
      await fetchQuotes();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Erro inesperado.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Recusar: status → "rejected" + client_notes com motivo
  const handleReject = async () => {
    if (!selectedQuote || submitting || !canReject) return;
    if (!rejectReason.trim()) {
      showToast("Informe o motivo da recusa.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({
          status: "rejected",
          client_notes: rejectReason.trim(),
        })
        .eq("id", selectedQuote.id);
      if (error) throw error;
      showToast(
        "Recusa registrada. Lamentamos não ter chegado a um acordo.",
        "success"
      );
      setOpenActionPanel(null);
      setRejectReason("");
      await fetchQuotes();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Erro inesperado.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#0b0d12] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        {/* Toast */}
        {toast.text && (
          <div
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl border px-5 py-4 font-semibold shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 ${
              toast.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                : "border-red-500/30 bg-red-500/15 text-red-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <ShieldAlert size={18} />
            )}
            {toast.text}
          </div>
        )}

        <section className="flex flex-col gap-6">
          {/* ── Header ── */}
          <header className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                      style={{
                        borderColor: `${brandColor}40`,
                        backgroundColor: `${brandColor}14`,
                        color: brandColor,
                      }}
                    >
                      <FileText size={14} />
                      {brandName}
                    </div>
                    {summary.pending > 0 && (
                      <div className="flex animate-pulse items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
                        <Bell size={14} />
                        {summary.pending}{" "}
                        {summary.pending === 1
                          ? `${quoteSingular} aguardando aprovação`
                          : `${quotePlural} aguardando aprovação`}
                      </div>
                    )}
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {quotePlural}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
                    Revise propostas comerciais, aprove, negocie condições ou
                    formalize adiamentos e recusas diretamente pelo portal do{" "}
                    {clientSingular.toLowerCase()}.
                  </p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[460px]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                      Total
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {summary.total}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-amber-400">
                      Pendentes
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-amber-300">
                      {summary.pending}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-blue-400">
                      Negociação
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-blue-300">
                      {summary.negotiating}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400">
                      Aprovados
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-300">
                      {summary.approved}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* ── Body ── */}
          {loading ? (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-12 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-center gap-3 text-zinc-300">
                <Loader2 className="animate-spin" size={22} />
                Carregando {quotePlural.toLowerCase()}...
              </div>
            </section>
          ) : quotes.length === 0 ? (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-10 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
              <FileSearch
                className="mx-auto mb-4 text-zinc-500"
                size={44}
              />
              <h2 className="text-xl font-semibold text-white">
                Nenhum orçamento encontrado
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Não há propostas vinculadas ao seu cadastro no momento.
              </p>
            </section>
          ) : (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              {/* ── Sidebar ── */}
              <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                <div className="border-b border-white/10 px-5 py-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                    {quotePlural}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {summary.total} proposta
                    {summary.total !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="custom-scrollbar max-h-[78vh] overflow-y-auto">
                  {quotes.map((quote) => {
                    const isActive = selectedId === quote.id;
                    const isPending =
                      quote.status === "pending_approval";
                    const isNegotiating = quote.status === "negotiating";
                    return (
                      <button
                        key={quote.id}
                        onClick={() => setSelectedId(quote.id)}
                        style={
                          isActive
                            ? { borderLeft: `3px solid ${brandColor}` }
                            : { borderLeft: "3px solid transparent" }
                        }
                        className={`w-full border-b border-white/[0.08] px-5 py-4 text-left transition last:border-b-0 ${
                          isActive
                            ? "bg-white/[0.07]"
                            : "hover:bg-white/[0.035]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {(isPending || isNegotiating) && (
                                <span
                                  className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${
                                    isPending
                                      ? "bg-amber-400"
                                      : "bg-blue-400"
                                  }`}
                                />
                              )}
                              <p className="line-clamp-2 text-sm font-semibold text-white">
                                {quote.title}
                              </p>
                            </div>
                            {quote.event_start_date && (
                              <p className="mt-1.5 text-xs text-zinc-400">
                                {formatDateRange(
                                  quote.event_start_date,
                                  quote.event_end_date
                                )}
                              </p>
                            )}
                          </div>
                          {getStatusBadge(quote.status)}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-base font-semibold text-white">
                            {currency(quote.final_amount)}
                          </p>
                          {quote.salesperson?.full_name && (
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                              <User size={11} />
                              {quote.salesperson.full_name}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* ── Painel de Detalhes ── */}
              <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                {!selectedQuote ? (
                  <div className="p-8 text-sm italic text-zinc-400">
                    Selecione um orçamento para visualizar os detalhes.
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    {/* Header do detalhe */}
                    <div className="border-b border-white/10 p-6 sm:p-7">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <h2 className="text-2xl font-semibold tracking-tight text-white">
                            {selectedQuote.title}
                          </h2>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-zinc-400">
                            {selectedQuote.salesperson?.full_name && (
                              <span className="flex items-center gap-1.5">
                                <User size={14} />
                                {selectedQuote.salesperson.full_name}
                              </span>
                            )}
                            {selectedQuote.event_start_date && (
                              <span className="flex items-center gap-1.5">
                                <Calendar size={14} />
                                Evento:{" "}
                                {formatDateRange(
                                  selectedQuote.event_start_date,
                                  selectedQuote.event_end_date
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-start gap-3 xl:items-end">
                          <p className="text-3xl font-semibold text-white">
                            {currency(selectedQuote.final_amount)}
                          </p>
                          {getStatusBadge(selectedQuote.status)}
                        </div>
                      </div>
                    </div>

                    {/* Grade interna: conteúdo + painéis */}
                    <div className="grid grid-cols-1 gap-6 p-6 sm:p-7 2xl:grid-cols-[minmax(0,1fr)_340px]">
                      {/* ── Coluna esquerda ── */}
                      <div className="space-y-6">
                        {/* Cronograma */}
                        {(selectedQuote.setup_start_date ||
                          selectedQuote.event_start_date ||
                          selectedQuote.teardown_start_date) && (
                          <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                              Cronograma
                            </h3>
                            <div className="space-y-3">
                              {selectedQuote.setup_start_date && (
                                <div className="flex items-center gap-4 rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                                    <Wrench size={16} />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                                      Montagem
                                    </p>
                                    <p className="mt-0.5 text-sm font-medium text-white">
                                      {formatDateRange(
                                        selectedQuote.setup_start_date,
                                        selectedQuote.setup_end_date
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {selectedQuote.event_start_date && (
                                <div
                                  className="flex items-center gap-4 rounded-xl border px-4 py-3"
                                  style={{
                                    borderColor: `${brandColor}30`,
                                    backgroundColor: `${brandColor}08`,
                                  }}
                                >
                                  <div
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                    style={{
                                      backgroundColor: `${brandColor}20`,
                                    }}
                                  >
                                    <Calendar
                                      size={16}
                                      style={{ color: brandColor }}
                                    />
                                  </div>
                                  <div>
                                    <p
                                      className="text-[10px] font-black uppercase tracking-widest"
                                      style={{ color: brandColor }}
                                    >
                                      Evento
                                    </p>
                                    <p className="mt-0.5 text-sm font-medium text-white">
                                      {formatDateRange(
                                        selectedQuote.event_start_date,
                                        selectedQuote.event_end_date
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {selectedQuote.teardown_start_date && (
                                <div className="flex items-center gap-4 rounded-xl border border-blue-500/10 bg-blue-500/5 px-4 py-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                                    <Truck size={16} />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                                      Desmontagem
                                    </p>
                                    <p className="mt-0.5 text-sm font-medium text-white">
                                      {formatDateRange(
                                        selectedQuote.teardown_start_date,
                                        selectedQuote.teardown_end_date
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </section>
                        )}

                        {/* Planilha de Itens */}
                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                              Composição do Orçamento
                            </h3>
                            {itemsLoading && (
                              <Loader2
                                className="animate-spin text-zinc-500"
                                size={16}
                              />
                            )}
                          </div>

                          {items.length === 0 && !itemsLoading ? (
                            <p className="text-sm italic text-zinc-500">
                              Nenhum item detalhado disponível.
                            </p>
                          ) : (
                            <div className="space-y-5">
                              {/* Tabela de itens reutilizável por categoria */}
                              {(
                                [
                                  {
                                    key: "equipment" as const,
                                    label: "Equipamentos",
                                    icon: (
                                      <Package
                                        size={13}
                                        className="text-emerald-400"
                                      />
                                    ),
                                    labelColor: "text-emerald-400",
                                    rowColor:
                                      "border-emerald-500/20 bg-emerald-500/5",
                                    textColor: "text-emerald-300",
                                    subtotalField:
                                      selectedQuote.total_equipment_cost,
                                  },
                                  {
                                    key: "labor" as const,
                                    label: "Equipe",
                                    icon: (
                                      <Users
                                        size={13}
                                        className="text-amber-400"
                                      />
                                    ),
                                    labelColor: "text-amber-400",
                                    rowColor:
                                      "border-amber-500/20 bg-amber-500/5",
                                    textColor: "text-amber-300",
                                    subtotalField:
                                      selectedQuote.total_labor_cost,
                                  },
                                  {
                                    key: "logistics" as const,
                                    label: "Logística",
                                    icon: (
                                      <Truck
                                        size={13}
                                        className="text-blue-400"
                                      />
                                    ),
                                    labelColor: "text-blue-400",
                                    rowColor:
                                      "border-blue-500/20 bg-blue-500/5",
                                    textColor: "text-blue-300",
                                    subtotalField:
                                      selectedQuote.total_logistics_cost,
                                  },
                                ] as const
                              )
                                .filter(
                                  ({ key }) => groupedItems[key].length > 0
                                )
                                .map(
                                  ({
                                    key,
                                    label,
                                    icon,
                                    labelColor,
                                    rowColor,
                                    textColor,
                                    subtotalField,
                                  }) => (
                                    <div key={key}>
                                      <div
                                        className={`mb-2 flex items-center gap-2`}
                                      >
                                        {icon}
                                        <p
                                          className={`text-[11px] font-black uppercase tracking-widest ${labelColor}`}
                                        >
                                          {label}
                                        </p>
                                      </div>
                                      <div className="overflow-hidden rounded-xl border border-white/[0.07]">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b border-white/[0.07] bg-black/20">
                                              <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                Descrição
                                              </th>
                                              <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                Qtd
                                              </th>
                                              <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                Dias
                                              </th>
                                              <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                Total
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {groupedItems[key].map((item) => (
                                              <tr
                                                key={item.id}
                                                className="border-b border-white/[0.05] last:border-b-0"
                                              >
                                                <td className="px-4 py-3 text-sm text-white">
                                                  {item.description}
                                                </td>
                                                <td className="px-3 py-3 text-center text-sm text-zinc-300">
                                                  {item.quantity}
                                                </td>
                                                <td className="px-3 py-3 text-center text-sm text-zinc-300">
                                                  {item.days}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-semibold text-white">
                                                  {currency(item.total_price)}
                                                </td>
                                              </tr>
                                            ))}
                                            {/* Linha de subtotal por categoria */}
                                            <tr
                                              className={`border-t ${rowColor}`}
                                            >
                                              <td
                                                colSpan={3}
                                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${labelColor}`}
                                              >
                                                Subtotal {label}
                                              </td>
                                              <td
                                                className={`px-4 py-2 text-right text-sm font-bold ${textColor}`}
                                              >
                                                {currency(
                                                  subtotalField ??
                                                    groupedItems[key].reduce(
                                                      (acc, i) =>
                                                        acc +
                                                        Number(i.total_price),
                                                      0
                                                    )
                                                )}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )
                                )}

                              {/* Total geral */}
                              <div className="flex justify-end">
                                <div className="w-72 space-y-2.5 rounded-2xl border border-white/10 bg-black/20 px-6 py-4">
                                  {selectedQuote.total_equipment_cost != null && (
                                    <div className="flex justify-between text-sm text-zinc-400">
                                      <span>Equipamentos</span>
                                      <span>
                                        {currency(
                                          selectedQuote.total_equipment_cost
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {selectedQuote.total_labor_cost != null && (
                                    <div className="flex justify-between text-sm text-zinc-400">
                                      <span>Equipe</span>
                                      <span>
                                        {currency(
                                          selectedQuote.total_labor_cost
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {selectedQuote.total_logistics_cost !=
                                    null && (
                                    <div className="flex justify-between text-sm text-zinc-400">
                                      <span>Logística</span>
                                      <span>
                                        {currency(
                                          selectedQuote.total_logistics_cost
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between border-t border-white/10 pt-2.5 text-base font-bold text-white">
                                    <span>Total</span>
                                    <span>
                                      {currency(selectedQuote.final_amount)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </section>

                        {/* Observações do responsável (admin → cliente) */}
                        {selectedQuote.notes && (
                          <section className="rounded-[24px] border border-blue-500/10 bg-blue-500/5 p-5">
                            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">
                              Observações do Responsável
                            </h3>
                            <p className="text-sm leading-relaxed text-zinc-300">
                              {selectedQuote.notes}
                            </p>
                          </section>
                        )}

                        {/* Feedback enviado pelo cliente (visível após ação) */}
                        {selectedQuote.client_notes &&
                          !isActionableQuote(selectedQuote) && (
                            <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                                Seu Retorno Registrado
                              </h3>
                              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
                                {selectedQuote.client_notes}
                              </p>
                            </section>
                          )}
                      </div>

                      {/* ── Coluna direita: Painéis de Ação ── */}
                      <aside className="space-y-4">
                        {/* Estado não-acionável */}
                        {!isActionableQuote(selectedQuote) ? (
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 text-center">
                            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                              {selectedQuote.status === "approved"
                                ? "✓ Proposta Aprovada"
                                : selectedQuote.status === "rejected"
                                ? "✗ Proposta Recusada"
                                : selectedQuote.status === "postponed"
                                ? "⏸ Adiamento Solicitado"
                                : selectedQuote.status === "cancelled"
                                ? "Cancelado"
                                : "Nenhuma ação disponível"}
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                              {selectedQuote.status === "approved"
                                ? "Nossa equipe está preparando a ordem de serviço e entrará em contato em breve."
                                : "Entre em contato com nosso time comercial para mais informações."}
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* ── Aprovar ── */}
                            <div
                              className={`rounded-[24px] border transition ${
                                openActionPanel === "approve"
                                  ? "border-emerald-500/30 bg-emerald-500/10"
                                  : "border-white/10 bg-white/[0.04]"
                              }`}
                            >
                              <button
                                onClick={() =>
                                  setOpenActionPanel((p) =>
                                    p === "approve" ? null : "approve"
                                  )
                                }
                                className="flex w-full items-center justify-between p-4"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                                    <CheckCircle2 size={20} />
                                  </div>
                                  <div className="text-left">
                                    <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
                                      Aprovar Proposta
                                    </h3>
                                    <p className="text-[11px] text-zinc-500">
                                      Aceitar os termos e valores apresentados
                                    </p>
                                  </div>
                                </div>
                                <ChevronDown
                                  size={18}
                                  className={`text-zinc-500 transition ${
                                    openActionPanel === "approve"
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                              </button>

                              {openActionPanel === "approve" && (
                                <div className="animate-in fade-in slide-in-from-top-2 space-y-4 p-5 pt-0">
                                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                                    <p className="text-xs font-bold text-emerald-300">
                                      Valor total a ser aprovado
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-white">
                                      {currency(selectedQuote.final_amount)}
                                    </p>
                                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                                      Ao confirmar, nossa equipe iniciará a
                                      preparação da ordem de serviço e entrará
                                      em contato para formalizar as condições de
                                      pagamento.
                                    </p>
                                  </div>
                                  <button
                                    onClick={handleApprove}
                                    disabled={submitting}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 p-4 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 disabled:opacity-50"
                                  >
                                    {submitting ? (
                                      <Loader2
                                        className="animate-spin"
                                        size={16}
                                      />
                                    ) : (
                                      <>
                                        <CheckCircle2 size={16} />
                                        Confirmar Aprovação
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* ── Negociar ── */}
                            <div
                              className={`rounded-[24px] border transition ${
                                openActionPanel === "negotiate"
                                  ? "border-blue-500/30 bg-blue-500/10"
                                  : "border-white/10 bg-white/[0.04]"
                              }`}
                            >
                              <button
                                onClick={() =>
                                  setOpenActionPanel((p) =>
                                    p === "negotiate" ? null : "negotiate"
                                  )
                                }
                                className="flex w-full items-center justify-between p-4"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                                    <MessageSquare size={20} />
                                  </div>
                                  <div className="text-left">
                                    <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
                                      Propor Negociação
                                    </h3>
                                    <p className="text-[11px] text-zinc-500">
                                      Sugerir ajustes de escopo, valores ou
                                      condições
                                    </p>
                                  </div>
                                </div>
                                <ChevronDown
                                  size={18}
                                  className={`text-zinc-500 transition ${
                                    openActionPanel === "negotiate"
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                              </button>

                              {openActionPanel === "negotiate" && (
                                <div className="animate-in fade-in slide-in-from-top-2 space-y-4 p-5 pt-0">
                                  {selectedQuote.status === "negotiating" &&
                                    selectedQuote.client_notes && (
                                      <div className="rounded-xl border border-blue-500/10 bg-blue-500/5 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                                          Sua proposta anterior
                                        </p>
                                        <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
                                          {selectedQuote.client_notes}
                                        </p>
                                      </div>
                                    )}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                      O que deseja negociar?
                                    </label>
                                    <textarea
                                      value={negotiateMessage}
                                      onChange={(e) =>
                                        setNegotiateMessage(e.target.value)
                                      }
                                      placeholder="Descreva os ajustes que gostaria de discutir: valores, itens, datas, condições de pagamento..."
                                      className="h-28 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-medium outline-none focus:border-blue-500/50"
                                    />
                                  </div>
                                  <button
                                    onClick={handleNegotiate}
                                    disabled={submitting}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-4 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:opacity-50"
                                  >
                                    {submitting ? (
                                      <Loader2
                                        className="animate-spin"
                                        size={16}
                                      />
                                    ) : (
                                      <>
                                        <MessageSquare size={16} />
                                        Enviar Proposta de Negociação
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* ── Adiar ── */}
                            <div
                              className={`rounded-[24px] border transition ${
                                openActionPanel === "postpone"
                                  ? "border-orange-500/30 bg-orange-500/10"
                                  : "border-white/10 bg-white/[0.04]"
                              }`}
                            >
                              <button
                                onClick={() =>
                                  setOpenActionPanel((p) =>
                                    p === "postpone" ? null : "postpone"
                                  )
                                }
                                className="flex w-full items-center justify-between p-4"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
                                    <Timer size={20} />
                                  </div>
                                  <div className="text-left">
                                    <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
                                      Solicitar Adiamento
                                    </h3>
                                    <p className="text-[11px] text-zinc-500">
                                      Postergar para uma data futura
                                    </p>
                                  </div>
                                </div>
                                <ChevronDown
                                  size={18}
                                  className={`text-zinc-500 transition ${
                                    openActionPanel === "postpone"
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                              </button>

                              {openActionPanel === "postpone" && (
                                <div className="animate-in fade-in slide-in-from-top-2 space-y-4 p-5 pt-0">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                      Nova Data Sugerida{" "}
                                      <span className="normal-case text-zinc-600">
                                        (opcional)
                                      </span>
                                    </label>
                                    <input
                                      type="date"
                                      value={postponeDate}
                                      onChange={(e) =>
                                        setPostponeDate(e.target.value)
                                      }
                                      style={{ colorScheme: "dark" }}
                                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-orange-500/50"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                      Motivo do Adiamento
                                    </label>
                                    <textarea
                                      value={postponeReason}
                                      onChange={(e) =>
                                        setPostponeReason(e.target.value)
                                      }
                                      placeholder="Descreva o motivo do adiamento..."
                                      className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-medium outline-none focus:border-orange-500/50"
                                    />
                                  </div>
                                  <button
                                    onClick={handlePostpone}
                                    disabled={submitting}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 p-4 text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-900/20 transition hover:bg-orange-500 disabled:opacity-50"
                                  >
                                    {submitting ? (
                                      <Loader2
                                        className="animate-spin"
                                        size={16}
                                      />
                                    ) : (
                                      <>
                                        <Timer size={16} />
                                        Confirmar Adiamento
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* ── Recusar ── */}
                            <div
                              className={`rounded-[24px] border transition ${
                                openActionPanel === "reject"
                                  ? "border-red-500/30 bg-red-500/10"
                                  : "border-white/10 bg-white/[0.04]"
                              }`}
                            >
                              <button
                                onClick={() =>
                                  setOpenActionPanel((p) =>
                                    p === "reject" ? null : "reject"
                                  )
                                }
                                className="flex w-full items-center justify-between p-4"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
                                    <ThumbsDown size={20} />
                                  </div>
                                  <div className="text-left">
                                    <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
                                      Recusar Proposta
                                    </h3>
                                    <p className="text-[11px] text-zinc-500">
                                      Declinar formalmente esta proposta
                                    </p>
                                  </div>
                                </div>
                                <ChevronDown
                                  size={18}
                                  className={`text-zinc-500 transition ${
                                    openActionPanel === "reject"
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                              </button>

                              {openActionPanel === "reject" && (
                                <div className="animate-in fade-in slide-in-from-top-2 space-y-4 p-5 pt-0">
                                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                                    <p className="text-[11px] leading-relaxed text-red-300">
                                      ⚠ Esta ação não pode ser desfeita pelo
                                      portal. Entre em contato com nossa equipe
                                      caso queira reverter a recusa.
                                    </p>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                      Motivo da Recusa
                                    </label>
                                    <textarea
                                      value={rejectReason}
                                      onChange={(e) =>
                                        setRejectReason(e.target.value)
                                      }
                                      placeholder="Descreva o motivo da recusa. Seu feedback nos ajuda a melhorar..."
                                      className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-medium outline-none focus:border-red-500/50"
                                    />
                                  </div>
                                  <button
                                    onClick={handleReject}
                                    disabled={submitting}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-4 text-xs font-black uppercase tracking-widest shadow-lg shadow-red-900/20 transition hover:bg-red-500 disabled:opacity-50"
                                  >
                                    {submitting ? (
                                      <Loader2
                                        className="animate-spin"
                                        size={16}
                                      />
                                    ) : (
                                      <>
                                        <ThumbsDown size={16} />
                                        Confirmar Recusa
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </aside>
                    </div>
                  </div>
                )}
              </section>
            </section>
          )}
        </section>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </main>
  );
}