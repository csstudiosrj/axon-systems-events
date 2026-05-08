"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import {
  FileText, Plus, Loader2, ArrowLeft, Trash2, Save, Printer,
  Edit, Calendar, User, Search, Check, X, DollarSign, CreditCard,
  MessageSquare, ClipboardList, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useSettings } from "../../providers/SettingsProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  company_name: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Quote {
  id: string;
  title: string;
  status: string;
  final_amount: number;
  client_id: string;
  salesperson_id: string;
  setup_start_date: string | null;
  setup_end_date: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  teardown_start_date: string | null;
  teardown_end_date: string | null;
  // notes: campo do admin (visível ao cliente no portal)
  notes: string | null;
  // client_notes: resposta do cliente (gravada pelo portal do cliente)
  client_notes: string | null;
  clients?: Client;
  salesperson?: Profile;
}

interface QuoteItem {
  id: string;
  category: "equipment" | "labor" | "logistics";
  description: string;
  quantity: number | string;
  daily_rate: number | string;
  days: number | string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  daily_rate: number;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:            { label: "Rascunho",          className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  pending_approval: { label: "Aguardando Cliente", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  negotiating:      { label: "Em Negociação",      className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  approved:         { label: "Aprovado",            className: "bg-cs-green/10 text-cs-green border-cs-green/20" },
  postponed:        { label: "Adiado",              className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  rejected:         { label: "Recusado",            className: "bg-red-500/10 text-red-400 border-red-500/20" },
  cancelled:        { label: "Cancelado",           className: "bg-zinc-700/10 text-zinc-500 border-zinc-700/20" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrcamentosPage() {
  const { systemPreferences } = useSettings();
  const labels = systemPreferences?.custom_labels || {};
  const currencyCode = systemPreferences?.currency_code || "BRL";

  const quoteSingular     = labels.entity_quote_singular     || "Orçamento";
  const quotePlural       = labels.entity_quote_plural       || "Orçamentos";
  const clientSingular    = labels.entity_client_singular    || "Cliente";
  const salespersonSingular = labels.entity_salesperson_singular || "Responsável Comercial";

  // ─── View state ─────────────────────────────────────────────────────────────

  const [view, setView] = useState<"list" | "create">("list");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [salesTeam, setSalesTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // ─── Form state ─────────────────────────────────────────────────────────────

  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  const [setupStart, setSetupStart]       = useState("");
  const [setupEnd, setSetupEnd]           = useState("");
  const [eventStart, setEventStart]       = useState("");
  const [eventEnd, setEventEnd]           = useState("");
  const [teardownStart, setTeardownStart] = useState("");
  const [teardownEnd, setTeardownEnd]     = useState("");
  const [items, setItems] = useState<QuoteItem[]>([]);

  // ─── Modal: Aprovação + Financeiro + OS ────────────────────────────────────

  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedQuoteForApproval, setSelectedQuoteForApproval] = useState<Quote | null>(null);
  const [installments, setInstallments] = useState<number>(1);
  const [firstDueDate, setFirstDueDate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");

  // ─── Modal: Negociação com cliente ──────────────────────────────────────────

  const [negotiationModalOpen, setNegotiationModalOpen] = useState(false);
  const [selectedQuoteForNegotiation, setSelectedQuoteForNegotiation] = useState<Quote | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [isRespondingNegotiation, setIsRespondingNegotiation] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const formatCurrency = useCallback(
    (value: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currencyCode,
      }).format(value),
    [currencyCode]
  );

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select("*, clients(company_name), salesperson:profiles(full_name, email)")
      .order("created_at", { ascending: false });

    if (!error && data) setQuotes(data as Quote[]);
    setLoading(false);
  }, []);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, company_name")
      .order("company_name");
    if (data) setClients(data as Client[]);
  }, []);

  const fetchInventory = useCallback(async () => {
    const { data } = await supabase.from("equipment").select("*").order("name");
    if (data) setInventory(data as InventoryItem[]);
  }, []);

  const fetchSalesTeam = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["super_admin", "admin", "commercial"]);
    if (data) setSalesTeam(data as Profile[]);
  }, []);

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (view === "list") {
      void fetchQuotes();
      resetForm();
    }
    if (view === "create") {
      void fetchClients();
      void fetchInventory();
      void fetchSalesTeam();
    }
  }, [view, fetchQuotes, fetchClients, fetchInventory, fetchSalesTeam]);

  // Realtime: detecta aprovações do cliente e atualizações de negociação
  useEffect(() => {
    const channel = supabase
      .channel("admin-orcamentos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes" },
        () => void fetchQuotes()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchQuotes]);

  // Fecha dropdown de cliente ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Form helpers ────────────────────────────────────────────────────────────

  const resetForm = () => {
    setEditQuoteId(null);
    setTitle("");
    setClientId("");
    setClientSearchTerm("");
    setSalespersonId("");
    setSetupStart(""); setSetupEnd("");
    setEventStart(""); setEventEnd("");
    setTeardownStart(""); setTeardownEnd("");
    setItems([]);
  };

  const handleEditQuote = async (quote: Quote) => {
    setLoading(true);
    setEditQuoteId(quote.id);
    setTitle(quote.title);
    setClientId(quote.client_id || "");
    setClientSearchTerm(quote.clients?.company_name || "");
    setSalespersonId(quote.salesperson_id || "");

    const localDate = (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };

    setSetupStart(localDate(quote.setup_start_date));
    setSetupEnd(localDate(quote.setup_end_date));
    setEventStart(localDate(quote.event_start_date));
    setEventEnd(localDate(quote.event_end_date));
    setTeardownStart(localDate(quote.teardown_start_date));
    setTeardownEnd(localDate(quote.teardown_end_date));

    const { data } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: true });

    if (data) {
      setItems(
        data.map((item) => ({
          id: item.id,
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          daily_rate: item.daily_rate,
          days: item.days,
        }))
      );
    }

    setView("create");
    setLoading(false);
  };

  // ─── Motor de Aprovação: Financeiro + OS ────────────────────────────────────

  const openApprovalModal = (quote: Quote) => {
    setSelectedQuoteForApproval(quote);
    setFirstDueDate(
      quote.event_start_date
        ? quote.event_start_date.split("T")[0]
        : new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
    );
    setInstallments(1);
    setPaymentMethod("pix");
    setApprovalModalOpen(true);
  };

  const handleStatusChange = (quote: Quote, newStatus: string) => {
    if (newStatus === "approved") {
      openApprovalModal(quote);
    } else {
      void updateQuoteStatus(quote.id, newStatus);
    }
  };

  // Cria: financial_transactions (parcelas) + service_order (OS) automaticamente
  const processApprovalAndFinance = async () => {
    if (!selectedQuoteForApproval || !firstDueDate) return;
    setIsSubmitting(true);

    try {
      const quote = selectedQuoteForApproval;
      const amountPerInstallment = quote.final_amount / installments;

      // 1. Parcelas financeiras
      const transactions = Array.from({ length: installments }, (_, i) => {
        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        return {
          description: `${quote.title} — Parcela ${i + 1}/${installments}`,
          type: "income",
          category: "Venda de Serviços",
          amount: amountPerInstallment,
          status: "pending",
          due_date: dueDate.toISOString().split("T")[0],
          client_id: quote.client_id,
          quote_id: quote.id,
          installment_number: i + 1,
          total_installments: installments,
          payment_method: paymentMethod,
          source: "quote_approval",
        };
      });

      const { error: financeError } = await supabase
        .from("financial_transactions")
        .insert(transactions);
      if (financeError) throw financeError;

      // 2. Criação automática da OS (service_order)
      const { error: osError } = await supabase
        .from("service_orders")
        .insert({
          quote_id: quote.id,
          client_id: quote.client_id,
          salesperson_id: quote.salesperson_id,
          title: quote.title,
          status: "scheduled",
          start_date: quote.event_start_date
            ? quote.event_start_date.split("T")[0]
            : null,
          end_date: quote.event_end_date
            ? quote.event_end_date.split("T")[0]
            : null,
          setup_start_date: quote.setup_start_date,
          setup_end_date: quote.setup_end_date,
          teardown_start_date: quote.teardown_start_date,
          teardown_end_date: quote.teardown_end_date,
          total_amount: quote.final_amount,
          source: "quote_approval",
        });
      if (osError) throw osError;

      // 3. Atualiza status do orçamento
      const { error: quoteError } = await supabase
        .from("quotes")
        .update({ status: "approved" })
        .eq("id", quote.id);
      if (quoteError) throw quoteError;

      showToast(
        `${quoteSingular} aprovado — OS e financeiro criados com sucesso.`,
        "success"
      );
      setApprovalModalOpen(false);
      void fetchQuotes();
    } catch (err: unknown) {
      showToast(
        `Erro: ${err instanceof Error ? err.message : "Erro inesperado."}`,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateQuoteStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("quotes")
      .update({ status: newStatus })
      .eq("id", id);
    if (!error) {
      showToast("Status atualizado.", "success");
      void fetchQuotes();
    } else {
      showToast("Erro ao atualizar status.", "error");
    }
  };

  // ─── Motor de Negociação ────────────────────────────────────────────────────

  const openNegotiationModal = (quote: Quote) => {
    setSelectedQuoteForNegotiation(quote);
    setAdminResponse(quote.notes || "");
    setNegotiationModalOpen(true);
  };

  // Responde ao cliente (mantém "negotiating", atualiza notes)
  const handleRespondNegotiation = async () => {
    if (!selectedQuoteForNegotiation || isRespondingNegotiation) return;
    setIsRespondingNegotiation(true);
    const { error } = await supabase
      .from("quotes")
      .update({ notes: adminResponse.trim() || null })
      .eq("id", selectedQuoteForNegotiation.id);

    if (error) {
      showToast(`Erro ao salvar resposta: ${error.message}`, "error");
    } else {
      showToast("Resposta enviada ao cliente.", "success");
      setNegotiationModalOpen(false);
      void fetchQuotes();
    }
    setIsRespondingNegotiation(false);
  };

  // Aprova diretamente do painel de negociação
  const handleApproveFromNegotiation = async () => {
    if (!selectedQuoteForNegotiation) return;
    // Salva resposta do admin antes de abrir modal de aprovação
    if (adminResponse.trim()) {
      await supabase
        .from("quotes")
        .update({ notes: adminResponse.trim() })
        .eq("id", selectedQuoteForNegotiation.id);
    }
    setNegotiationModalOpen(false);
    openApprovalModal(selectedQuoteForNegotiation);
  };

  // Recusa do painel de negociação
  const handleRejectFromNegotiation = async () => {
    if (!selectedQuoteForNegotiation || isRespondingNegotiation) return;
    setIsRespondingNegotiation(true);
    const { error } = await supabase
      .from("quotes")
      .update({
        status: "rejected",
        notes: adminResponse.trim() || null,
      })
      .eq("id", selectedQuoteForNegotiation.id);

    if (error) {
      showToast(`Erro: ${error.message}`, "error");
    } else {
      showToast("Proposta recusada formalmente.", "success");
      setNegotiationModalOpen(false);
      void fetchQuotes();
    }
    setIsRespondingNegotiation(false);
  };

  // ─── Planilha de itens ───────────────────────────────────────────────────────

  const addItem = (category: QuoteItem["category"]) => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), category, description: "", quantity: 1, daily_rate: 0, days: 1 },
    ]);
  };

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((item) => item.id !== id));

  const updateItem = (id: string, field: string, value: string | number) =>
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );

  const handleDescriptionChange = (id: string, value: string) => {
    const found = inventory.find(
      (eq) => eq.name.toLowerCase() === value.toLowerCase()
    );
    if (found) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, description: value, daily_rate: found.daily_rate }
            : item
        )
      );
    } else {
      updateItem(id, "description", value);
    }
  };

  const calculateDaysDiff = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 1;
    const diff = Math.ceil(
      Math.abs(new Date(endStr).getTime() - new Date(startStr).getTime()) /
        86400000
    );
    return diff === 0 ? 1 : diff;
  };

  const eventDays = calculateDaysDiff(eventStart, eventEnd);
  const totalDays = calculateDaysDiff(
    setupStart || eventStart,
    teardownEnd || eventEnd
  );

  const calculateTotals = () => {
    let equipment = 0, labor = 0, logistics = 0;
    items.forEach((item) => {
      const total =
        (Number(item.quantity) || 0) *
        (Number(item.daily_rate) || 0) *
        (Number(item.days) || 0);
      if (item.category === "equipment") equipment += total;
      if (item.category === "labor") labor += total;
      if (item.category === "logistics") logistics += total;
    });
    return { equipment, labor, logistics, final: equipment + labor + logistics };
  };

  const totals = calculateTotals();

  // ─── Salvar orçamento ────────────────────────────────────────────────────────

  const handleSaveQuote = async () => {
    if (!title || !clientId || !salespersonId || items.length === 0) {
      showToast(
        `Preencha título, ${clientSingular.toLowerCase()}, ${salespersonSingular.toLowerCase()} e adicione ao menos um item.`,
        "error"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const validateDate = (dateStr: string) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) throw new Error("Data inválida no cronograma.");
        return d.toISOString();
      };

      const payload = {
        title,
        client_id: clientId,
        salesperson_id: salespersonId,
        setup_start_date: validateDate(setupStart),
        setup_end_date: validateDate(setupEnd),
        event_start_date: validateDate(eventStart),
        event_end_date: validateDate(eventEnd),
        teardown_start_date: validateDate(teardownStart),
        teardown_end_date: validateDate(teardownEnd),
        total_equipment_cost: totals.equipment,
        total_labor_cost: totals.labor,
        total_logistics_cost: totals.logistics,
        final_amount: totals.final,
      };

      let currentQuoteId = editQuoteId;

      if (editQuoteId) {
        await supabase.from("quotes").update(payload).eq("id", editQuoteId);
        await supabase.from("quote_items").delete().eq("quote_id", editQuoteId);
      } else {
        const { data: quoteData, error: quoteError } = await supabase
          .from("quotes")
          .insert([{ ...payload, status: "draft" }])
          .select()
          .single();
        if (quoteError) throw quoteError;
        currentQuoteId = quoteData.id;
      }

      const itemsToInsert = items.map((item) => ({
        quote_id: currentQuoteId,
        category: item.category,
        description: item.description,
        quantity: Number(item.quantity),
        daily_rate: Number(item.daily_rate),
        days: Number(item.days),
        total_price:
          Number(item.quantity) *
          Number(item.daily_rate) *
          Number(item.days),
      }));

      const { error: itemsError } = await supabase
        .from("quote_items")
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;

      showToast(`${quoteSingular} salvo com sucesso.`, "success");
      setView("list");
    } catch (err: unknown) {
      showToast(
        `Erro ao salvar: ${err instanceof Error ? err.message : "Erro inesperado."}`,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.company_name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md shadow-lg flex items-center gap-2 border ${
            toast.type === "success"
              ? "bg-cs-green/10 border-cs-green/20 text-cs-green"
              : "bg-red-500/10 border-red-500/20 text-red-500"
          }`}
        >
          {toast.type === "success" ? <Check size={18} /> : <X size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* ── Modal: Aprovação + Financeiro + OS ── */}
      {approvalModalOpen && selectedQuoteForApproval && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-surface border border-surface/50 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-background p-4 border-b border-surface/50 flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                <DollarSign className="text-cs-green" size={18} />
                Condições de Pagamento + OS
              </h3>
              <button
                onClick={() => setApprovalModalOpen(false)}
                className="text-text-secondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-cs-green/10 border border-cs-green/20 rounded-lg p-4 text-center">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">
                  Valor Total Aprovado
                </p>
                <p className="text-2xl font-extrabold text-cs-green">
                  {formatCurrency(selectedQuoteForApproval.final_amount)}
                </p>
              </div>

              {/* Aviso OS */}
              <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
                <ClipboardList size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300">
                  Uma <strong>Ordem de Serviço</strong> com status{" "}
                  <em>Agendada</em> será criada automaticamente ao confirmar.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Forma de Pagamento
                  </label>
                  <div className="relative">
                    <CreditCard
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="block w-full rounded-md border border-surface bg-background pl-10 pr-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer"
                    >
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto Bancário</option>
                      <option value="transfer">Transferência (TED/DOC)</option>
                      <option value="credit_card">Cartão de Crédito</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Parcelamento
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 10, 12].map((num) => (
                        <option key={num} value={num}>
                          {num}x de{" "}
                          {formatCurrency(
                            selectedQuoteForApproval.final_amount / num
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      1º Vencimento
                    </label>
                    <input
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                      style={{ colorScheme: "dark" }}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-background p-4 border-t border-surface/50 flex justify-end gap-3">
              <button
                onClick={() => setApprovalModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={processApprovalAndFinance}
                disabled={isSubmitting || !firstDueDate}
                className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Check size={16} />
                )}
                Confirmar — Criar OS e Financeiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Negociação com Cliente ── */}
      {negotiationModalOpen && selectedQuoteForNegotiation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-surface border border-surface/50 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-background p-4 border-b border-surface/50 flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                <MessageSquare className="text-amber-400" size={18} />
                Painel de Negociação
              </h3>
              <button
                onClick={() => setNegotiationModalOpen(false)}
                className="text-text-secondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Proposta do cliente */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                  Proposta do Cliente
                </p>
                {selectedQuoteForNegotiation.client_notes ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <p className="text-sm text-zinc-200 whitespace-pre-line leading-relaxed">
                      {selectedQuoteForNegotiation.client_notes}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary italic">
                    O cliente não enviou uma mensagem de negociação.
                  </p>
                )}
              </div>

              {/* Resposta do admin */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                  Sua Resposta{" "}
                  <span className="normal-case font-normal text-zinc-600">
                    (visível ao cliente no portal)
                  </span>
                </label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  rows={4}
                  placeholder="Descreva sua contra-proposta, ajuste de condições ou confirmação..."
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white text-sm focus:border-cs-green focus:outline-none resize-none"
                />
              </div>

              {/* Resumo do orçamento */}
              <div className="flex items-center justify-between rounded-lg border border-surface/50 bg-background px-4 py-3">
                <div>
                  <p className="text-xs text-text-secondary">
                    {selectedQuoteForNegotiation.title}
                  </p>
                  <p className="text-sm font-bold text-white">
                    {selectedQuoteForNegotiation.clients?.company_name}
                  </p>
                </div>
                <p className="text-lg font-extrabold text-cs-green">
                  {formatCurrency(selectedQuoteForNegotiation.final_amount)}
                </p>
              </div>
            </div>

            <div className="bg-background p-4 border-t border-surface/50 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setNegotiationModalOpen(false)}
                disabled={isRespondingNegotiation}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors disabled:opacity-50"
              >
                Fechar
              </button>
              <button
                onClick={handleRejectFromNegotiation}
                disabled={isRespondingNegotiation}
                className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 py-2 px-4 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {isRespondingNegotiation ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <X size={14} />
                )}
                Recusar Proposta
              </button>
              <button
                onClick={handleRespondNegotiation}
                disabled={isRespondingNegotiation}
                className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 py-2 px-4 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
              >
                {isRespondingNegotiation ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <MessageSquare size={14} />
                )}
                Responder e Manter Negociação
              </button>
              <button
                onClick={handleApproveFromNegotiation}
                disabled={isRespondingNegotiation}
                className="flex items-center gap-1.5 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white hover:bg-opacity-90 transition-all disabled:opacity-50"
              >
                <Check size={14} />
                Aprovar e Processar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View: Formulário de criação/edição ── */}
      {view === "create" ? (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
          <datalist id="inventory-equipment">
            {inventory
              .filter((eq) => !["logistics", "labor"].includes(eq.category))
              .map((eq) => (
                <option key={eq.id} value={eq.name} />
              ))}
          </datalist>
          <datalist id="inventory-labor">
            {inventory
              .filter((eq) => eq.category === "labor")
              .map((eq) => (
                <option key={eq.id} value={eq.name} />
              ))}
          </datalist>
          <datalist id="inventory-logistics">
            {inventory
              .filter((eq) => eq.category === "logistics")
              .map((eq) => (
                <option key={eq.id} value={eq.name} />
              ))}
          </datalist>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
            >
              <ArrowLeft size={20} /> Voltar para lista
            </button>
            <button
              onClick={handleSaveQuote}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              {editQuoteId
                ? `Atualizar ${quoteSingular}`
                : `Salvar ${quoteSingular}`}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna esquerda: dados gerais + cronograma */}
            <div className="lg:col-span-1 space-y-6">
              {/* Dados Gerais */}
              <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
                <h3 className="text-md font-bold text-white border-b border-surface/50 pb-2 flex items-center gap-2">
                  <FileText size={18} className="text-cs-green" /> Dados Gerais
                </h3>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Título do Evento / {quoteSingular} *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  />
                </div>

                {/* Busca de cliente com dropdown */}
                <div ref={clientDropdownRef} className="relative">
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {clientSingular} *
                  </label>
                  <div className="flex items-center border border-surface bg-background rounded-md px-3 py-2 focus-within:border-cs-green focus-within:ring-1 focus-within:ring-cs-green transition-colors">
                    <Search size={14} className="text-text-secondary mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder={`Buscar ${clientSingular.toLowerCase()}...`}
                      value={clientSearchTerm}
                      onChange={(e) => {
                        setClientSearchTerm(e.target.value);
                        setIsClientDropdownOpen(true);
                        setClientId("");
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      className="bg-transparent border-none outline-none text-white text-sm w-full"
                    />
                    {clientId && (
                      <Check size={14} className="text-cs-green shrink-0 ml-2" />
                    )}
                  </div>
                  {isClientDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-surface border border-surface/50 rounded-md shadow-2xl max-h-60 overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-text-secondary text-center">
                          Nenhum registro encontrado.
                        </div>
                      ) : (
                        filteredClients.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setClientId(c.id);
                              setClientSearchTerm(c.company_name);
                              setIsClientDropdownOpen(false);
                            }}
                            className="px-4 py-2.5 text-sm text-white hover:bg-cs-green/20 hover:text-cs-green cursor-pointer border-b border-surface/50 last:border-0 transition-colors"
                          >
                            {c.company_name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-2">
                    <User size={14} /> {salespersonSingular} *
                  </label>
                  <select
                    value={salespersonId}
                    onChange={(e) => setSalespersonId(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {salesTeam.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cronograma */}
              <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
                <h3 className="text-md font-bold text-white border-b border-surface/50 pb-2 flex items-center gap-2">
                  <Calendar size={18} className="text-cs-gold" /> Cronograma
                </h3>
                <style
                  dangerouslySetInnerHTML={{
                    __html: `input[type="datetime-local"] { color-scheme: dark; }`,
                  }}
                />

                {(
                  [
                    { label: "1. Montagem (Load-in)", color: "text-cs-gold", start: setupStart, setStart: setSetupStart, end: setupEnd, setEnd: setSetupEnd },
                    { label: "2. Evento",              color: "text-cs-green", start: eventStart, setStart: setEventStart, end: eventEnd, setEnd: setEventEnd },
                    { label: "3. Desmontagem (Load-out)", color: "text-blue-400", start: teardownStart, setStart: setTeardownStart, end: teardownEnd, setEnd: setTeardownEnd },
                  ] as const
                ).map(({ label, color, start, setStart, end, setEnd }, idx) => (
                  <div
                    key={idx}
                    className={`space-y-3 ${idx < 2 ? "border-b border-surface/50 pb-4" : ""}`}
                  >
                    <p className={`text-xs font-bold uppercase tracking-wider ${color}`}>
                      {label}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["Início", "Término"] as const).map((lbl, i) => (
                        <div key={lbl}>
                          <label className="block text-[10px] text-text-secondary mb-1">
                            {lbl}
                          </label>
                          <input
                            type="datetime-local"
                            max="2099-12-31T23:59"
                            value={i === 0 ? start : end}
                            onChange={(e) => {
                              if (e.target.value.length <= 16)
                                i === 0 ? setStart(e.target.value) : setEnd(e.target.value);
                            }}
                            className="block w-full rounded border border-surface bg-background px-2 py-1.5 text-white focus:border-cs-green focus:outline-none text-xs cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna direita: planilha de custos */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-6">
                <div className="flex items-center justify-between border-b border-surface/50 pb-2">
                  <h3 className="text-lg font-medium text-white">
                    Planilha de Custos
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addItem("equipment")}
                      className="text-xs bg-cs-green/10 text-cs-green px-3 py-1.5 rounded hover:bg-cs-green/20 transition-colors"
                    >
                      + Equipamento
                    </button>
                    <button
                      onClick={() => addItem("labor")}
                      className="text-xs bg-cs-gold/10 text-cs-gold px-3 py-1.5 rounded hover:bg-cs-gold/20 transition-colors"
                    >
                      + Equipe
                    </button>
                    <button
                      onClick={() => addItem("logistics")}
                      className="text-xs bg-blue-500/10 text-blue-500 px-3 py-1.5 rounded hover:bg-blue-500/20 transition-colors"
                    >
                      + Logística
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <p className="text-center text-text-secondary py-8 text-sm">
                      Nenhum item adicionado. Use os botões acima para começar.
                    </p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 bg-background p-3 rounded-md border border-surface/50"
                      >
                        <div className="w-16 shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                              item.category === "equipment"
                                ? "bg-cs-green/10 text-cs-green"
                                : item.category === "labor"
                                ? "bg-cs-gold/10 text-cs-gold"
                                : "bg-blue-500/10 text-blue-500"
                            }`}
                          >
                            {item.category === "equipment"
                              ? "Equip"
                              : item.category === "labor"
                              ? "Equipe"
                              : "Log"}
                          </span>
                        </div>

                        <div className="flex-1">
                          <label className="text-[10px] text-text-secondary block mb-1">
                            Descrição
                          </label>
                          <input
                            type="text"
                            list={`inventory-${item.category}`}
                            placeholder="Buscar ou digitar..."
                            value={item.description}
                            onChange={(e) =>
                              handleDescriptionChange(item.id, e.target.value)
                            }
                            className="w-full bg-transparent border-b border-surface text-white focus:border-cs-green focus:outline-none px-1 py-1 text-sm"
                          />
                        </div>

                        <div className="w-16 shrink-0">
                          <label className="text-[10px] text-text-secondary block mb-1">
                            Qtd
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, "quantity", e.target.value)
                            }
                            className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green text-sm text-center"
                          />
                        </div>

                        <div className="w-24 shrink-0">
                          <label className="text-[10px] text-text-secondary block mb-1">
                            Diária (R$)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.daily_rate}
                            onChange={(e) =>
                              updateItem(item.id, "daily_rate", e.target.value)
                            }
                            className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green text-sm text-right"
                          />
                        </div>

                        <div className="w-20 shrink-0">
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] text-text-secondary">
                              Dias
                            </label>
                            {eventStart && eventEnd && (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItem(item.id, "days", eventDays)
                                  }
                                  title={`${eventDays} Dias de Evento`}
                                  className="text-[8px] bg-cs-green/20 text-cs-green px-1 rounded hover:bg-cs-green hover:text-white transition-colors"
                                >
                                  E
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItem(item.id, "days", totalDays)
                                  }
                                  title={`${totalDays} Dias Totais`}
                                  className="text-[8px] bg-cs-gold/20 text-cs-gold px-1 rounded hover:bg-cs-gold hover:text-white transition-colors"
                                >
                                  T
                                </button>
                              </div>
                            )}
                          </div>
                          <input
                            type="number"
                            min="1"
                            value={item.days}
                            onChange={(e) =>
                              updateItem(item.id, "days", e.target.value)
                            }
                            className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green text-sm text-center"
                          />
                        </div>

                        <div className="w-28 text-right shrink-0">
                          <label className="text-[10px] text-text-secondary block mb-1">
                            Total
                          </label>
                          <span className="font-bold text-white text-sm block py-1">
                            {formatCurrency(
                              (Number(item.quantity) || 0) *
                                (Number(item.daily_rate) || 0) *
                                (Number(item.days) || 0)
                            )}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-end pb-1 ml-2">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-surface hover:text-red-500 transition-colors p-1 rounded hover:bg-red-500/10"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Totais */}
              <div className="bg-surface border border-surface/50 p-6 rounded-lg flex justify-end">
                <div className="w-72 space-y-3">
                  <div className="flex justify-between text-sm text-text-secondary">
                    <span>Equipamentos:</span>
                    <span>{formatCurrency(totals.equipment)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-text-secondary">
                    <span>Equipe:</span>
                    <span>{formatCurrency(totals.labor)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-text-secondary border-b border-surface/50 pb-3">
                    <span>Logística:</span>
                    <span>{formatCurrency(totals.logistics)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-extrabold text-white pt-2">
                    <span>Total:</span>
                    <span className="text-cs-green">
                      {formatCurrency(totals.final)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── View: Lista de orçamentos ── */
        <>
          <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
            <div>
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <FileText className="text-cs-green" size={20} />
                Gestão de {quotePlural}
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Crie propostas, gerencie status, negocie com clientes e gere OS automaticamente.
              </p>
            </div>
            <button
              onClick={() => setView("create")}
              className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
            >
              <Plus size={18} /> Novo {quoteSingular}
            </button>
          </div>

          <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary">
                <thead className="bg-background/50 text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-6 py-3 font-medium">
                      {quoteSingular} / Evento
                    </th>
                    <th className="px-6 py-3 font-medium">
                      {salespersonSingular}
                    </th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Valor Total</th>
                    <th className="px-6 py-3 font-medium text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface/50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center">
                        <Loader2
                          className="animate-spin mx-auto mb-2 text-cs-green"
                          size={24}
                        />
                      </td>
                    </tr>
                  ) : quotes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-text-secondary"
                      >
                        Nenhum {quoteSingular.toLowerCase()} encontrado.
                      </td>
                    </tr>
                  ) : (
                    quotes.map((quote) => {
                      const statusCfg =
                        STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft;
                      const hasClientMessage =
                        quote.status === "negotiating" && !!quote.client_notes;
                      // Quote aprovado pelo cliente via portal (sem OS/financeiro criados pelo admin)
                      const isClientApproved =
                        quote.status === "approved";

                      return (
                        <tr
                          key={quote.id}
                          className="hover:bg-background/50 transition-colors"
                        >
                          {/* Título + Cliente */}
                          <td className="px-6 py-4">
                            <p className="font-bold text-white">
                              {quote.title}
                            </p>
                            <p className="text-xs mt-1">
                              {quote.clients?.company_name}
                            </p>
                            {/* Badge de mensagem de negociação pendente */}
                            {hasClientMessage && (
                              <button
                                onClick={() => openNegotiationModal(quote)}
                                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors"
                              >
                                <AlertCircle size={11} />
                                Mensagem do cliente
                              </button>
                            )}
                          </td>

                          {/* Salesperson */}
                          <td className="px-6 py-4">
                            {quote.salesperson ? (
                              <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                                <User size={14} className="text-cs-gold" />
                                {quote.salesperson.full_name}
                              </span>
                            ) : (
                              <span className="text-xs text-text-secondary">
                                Não atribuído
                              </span>
                            )}
                          </td>

                          {/* Status select */}
                          <td className="px-6 py-4">
                            <select
                              value={quote.status}
                              onChange={(e) =>
                                handleStatusChange(quote, e.target.value)
                              }
                              className={`text-xs rounded-full px-2.5 py-1 font-bold uppercase tracking-wider border focus:outline-none cursor-pointer ${statusCfg.className}`}
                            >
                              <option value="draft">Rascunho</option>
                              <option value="pending_approval">Aguardando Cliente</option>
                              <option value="negotiating">Em Negociação</option>
                              <option value="approved">Aprovado</option>
                              <option value="postponed">Adiado</option>
                              <option value="rejected">Recusado</option>
                              <option value="cancelled">Cancelado</option>
                            </select>
                          </td>

                          {/* Valor */}
                          <td className="px-6 py-4 font-bold text-cs-green">
                            {formatCurrency(quote.final_amount)}
                          </td>

                          {/* Ações */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-3 flex-wrap">
                              {/* Botão de negociação — destaque quando há mensagem */}
                              {quote.status === "negotiating" && (
                                <button
                                  onClick={() => openNegotiationModal(quote)}
                                  className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                                    hasClientMessage
                                      ? "text-amber-400 hover:text-amber-300"
                                      : "text-text-secondary hover:text-white"
                                  }`}
                                >
                                  <MessageSquare size={14} />
                                  Negociar
                                </button>
                              )}

                              {/* Processar aprovação do cliente (cliente aprovou, admin ainda não gerou OS) */}
                              {isClientApproved && (
                                <button
                                  onClick={() => openApprovalModal(quote)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-cs-green hover:text-white transition-colors"
                                >
                                  <ClipboardList size={14} />
                                  Gerar OS
                                </button>
                              )}

                              <button
                                onClick={() => void handleEditQuote(quote)}
                                className="inline-flex items-center gap-1 text-text-secondary hover:text-white transition-colors text-xs font-medium"
                              >
                                <Edit size={14} /> Editar
                              </button>
                              <Link
                                href={`/orcamentos/${quote.id}`}
                                className="inline-flex items-center gap-1 text-cs-gold hover:text-white transition-colors text-xs font-medium"
                              >
                                <Printer size={14} /> PDF
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}