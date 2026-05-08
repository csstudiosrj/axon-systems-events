"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  Wallet, Plus, Loader2, ArrowLeft, ArrowUpRight, CheckCircle, XCircle, Save,
  Trash2, Search, Building, Eye, AlertTriangle, Upload, Receipt, Mail,
  MessageCircle, Users, TrendingUp, UserCheck, Percent, BarChart3, PieChart,
  DollarSign, Zap, CheckCheck, ShieldAlert, FileText, Paperclip, RefreshCw,
  X, Scale, Clock3, Download, ChevronLeft, ChevronRight, Bell, Layers,
  CalendarRange, ListFilter, SlidersHorizontal, CreditCard,
} from "lucide-react";

interface Client {
  id: string;
  company_name: string;
  email?: string;
  phone?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email?: string;
  commission_percentage?: number;
  role?: string;
}

interface Quote {
  id: string;
  title: string;
  salesperson_id?: string;
}

interface ServiceOrder {
  id: string;
  quote_id?: string;
  quotes?: Quote;
}

interface ApprovedQuote {
  id: string;
  title: string;
  salesperson_id?: string;
  final_amount?: number;
  client_id?: string;
}

interface Transaction {
  id: string;
  description: string;
  type: "income" | "expense";
  expense_type?: "administrative" | "personnel" | "operational";
  category: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "received";
  due_date: string;
  payment_date?: string | null;
  service_order_id?: string | null;
  client_id?: string | null;
  member_id?: string | null;
  attachment_url?: string | null;
  payment_method?: string | null;
  last_notified_at?: string | null;
  invoice_hash?: string | null;
  quote_id?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
  source?: string | null;
  invoice_notes?: string | null;
  document_number?: string | null;
  workflow_status?: string | null;
  dispute_status?: string | null;
  dispute_reason?: string | null;
  dispute_category?: string | null;
  customer_last_action_at?: string | null;
  finance_last_action_at?: string | null;
  last_interaction_at?: string | null;
  payment_reported_amount?: number | null;
  payment_reported_method?: string | null;
  payment_reported_reference?: string | null;
  payment_reported_at?: string | null;
  payment_confirmed_at?: string | null;
  resolution_type?: string | null;
  resolution_notes?: string | null;
  clients?: Client;
  service_orders?: ServiceOrder;
  member?: Profile;
  quote?: Quote;
}

interface FinancialEvent {
  id: string;
  financial_transaction_id: string;
  author_id: string | null;
  author_type: "client" | "finance" | "system";
  visibility: "shared" | "internal";
  event_type: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface FinancialAttachment {
  id: string;
  financial_transaction_id: string;
  event_id: string | null;
  uploaded_by: string | null;
  uploaded_by_type: "client" | "finance" | "system";
  visibility: "shared" | "internal";
  attachment_type: string;
  file_name: string;
  file_path: string;
  file_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "warning";
}

interface ReguaConfig {
  enableMinus3: boolean;
  enableD0: boolean;
  enablePlus5: boolean;
  messageMinus3: string;
  messageD0: string;
  messagePlus5: string;
}

type TabId =
  | "dashboard"
  | "receber"
  | "pagar_admin"
  | "pagar_operacional"
  | "pessoal"
  | "clientes"
  | "dre";

const STORAGE_BUCKET = "files-main";
const PAGE_SIZE = 50;

const DEFAULT_INCOME_CATEGORIES = [
  "Prestação de Serviços",
  "Locação de Equipamentos",
  "Treinamentos",
  "Consultoria",
  "Outras Receitas",
];

const DEFAULT_EXPENSE_ADMIN_CATEGORIES = [
  "Energia Elétrica",
  "Água e Saneamento",
  "Internet / Telefonia",
  "Aluguel / Coworking",
  "Material de Escritório",
  "Seguros",
  "Contabilidade / Jurídico",
  "Software / Assinaturas",
  "Impostos / Taxas",
  "Outras Despesas Administrativas",
];

const DEFAULT_EXPENSE_OPERATIONAL_CATEGORIES = [
  "Logística / Frete",
  "Equipamentos / Manutenção",
  "Fornecedores de Produção",
  "Alimentação / Hospedagem",
  "Outras Despesas Operacionais",
];

const DEFAULT_EXPENSE_PERSONNEL_CATEGORIES = [
  "Salário",
  "Comissão de Vendas",
  "Benefícios (VT, VR, PS)",
  "Pró-labore",
  "Freelancer / PJ",
  "Encargos Trabalhistas",
];

const REGUA_DEFAULT: ReguaConfig = {
  enableMinus3: true,
  enableD0: true,
  enablePlus5: true,
  messageMinus3:
    "Olá {cliente}, sua fatura de {valor} vence em 3 dias ({data}). Providencie o pagamento para evitar atrasos.",
  messageD0:
    "Olá {cliente}, sua fatura de {valor} vence hoje ({data}). Regularize para evitar encargos.",
  messagePlus5:
    "Olá {cliente}, sua fatura de {valor} está vencida desde {data}. Entre em contato para regularização.",
};

const isOverdue = (date: string, status: string) =>
  new Date(`${date}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0)) &&
  status === "pending";

const translateWorkflowStatus = (value?: string | null) => {
  const map: Record<string, string> = {
    open: "Em aberto",
    awaiting_client: "Aguardando cliente",
    awaiting_finance: "Aguardando financeiro",
    under_review: "Em análise",
    confirmed: "Confirmado",
    disputed: "Contestado",
    resolved: "Resolvido",
    cancelled: "Cancelado",
  };
  return map[value || ""] || value || "Em aberto";
};

const translateDisputeCategory = (value?: string | null) => {
  const map: Record<string, string> = {
    amount_divergence: "Valor divergente",
    duplicate_charge: "Cobrança duplicada",
    service_not_delivered: "Serviço não entregue",
    wrong_due_date: "Data incorreta",
    wrong_document: "Documento incorreto",
    unknown_charge: "Cobrança desconhecida",
    other: "Outro",
  };
  return map[value || ""] || value || "-";
};

const translateEventType = (value?: string | null) => {
  const map: Record<string, string> = {
    charge_created: "Cobrança criada",
    payment_reported: "Pagamento informado",
    payment_receipt_attached: "Comprovante anexado",
    dispute_opened: "Contestação aberta",
    dispute_comment: "Comentário da contestação",
    finance_comment: "Comentário do financeiro",
    payment_confirmed: "Pagamento confirmado",
    payment_rejected: "Pagamento rejeitado",
    charge_adjusted: "Cobrança ajustada",
    charge_cancelled: "Cobrança cancelada",
    status_changed: "Status alterado",
    resolution_added: "Resolução registrada",
    attachment_added: "Anexo incluído",
  };
  return map[value || ""] || value || "-";
};

const statusLabel = (t: Transaction) => {
  if (t.workflow_status === "confirmed") return "Confirmado";
  if (t.status === "paid" || t.status === "received") return "Pago";
  if (t.status === "cancelled") return "Cancelado";
  if (t.dispute_status && t.dispute_status !== "resolved") return "Contestação";
  if (t.workflow_status === "awaiting_finance") return "Aguardando financeiro";
  if (t.workflow_status === "under_review") return "Em análise";
  if (isOverdue(t.due_date, t.status || "pending")) return "Vencido";
  return "Pendente";
};

const statusClass = (t: Transaction) => {
  if (
    t.workflow_status === "confirmed" ||
    t.status === "paid" ||
    t.status === "received"
  ) {
    return "bg-cs-green/10 text-cs-green border-cs-green/20";
  }
  if (t.dispute_status && t.dispute_status !== "resolved") {
    return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  }
  if (
    t.workflow_status === "awaiting_finance" ||
    t.workflow_status === "under_review"
  ) {
    return "bg-cs-gold/10 text-cs-gold border-cs-gold/20";
  }
  if (t.status === "cancelled")
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  if (isOverdue(t.due_date, t.status || "pending"))
    return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-white/5 text-zinc-300 border-white/10";
};

const getPaymentDifference = (transaction: Transaction) => {
  const expected = Number(transaction.amount || 0);
  const reported = Number(transaction.payment_reported_amount || 0);
  const difference = reported - expected;

  if (!transaction.payment_reported_at || reported <= 0) {
    return {
      expected,
      reported,
      difference: 0,
      scenario: "none" as const,
      label: "Sem pagamento informado",
      helper: "Ainda não houve informação de pagamento pelo cliente.",
    };
  }

  if (difference === 0) {
    return {
      expected,
      reported,
      difference,
      scenario: "exact" as const,
      label: "Valor exato",
      helper: "O valor informado bate com a parcela atual.",
    };
  }

  if (difference < 0) {
    return {
      expected,
      reported,
      difference,
      scenario: "partial" as const,
      label: "Pagamento parcial",
      helper:
        "O cliente informou valor menor que a parcela. Exige decisão do financeiro.",
    };
  }

  return {
    expected,
    reported,
    difference,
    scenario: "over" as const,
    label: "Valor acima da parcela",
    helper:
      "O valor informado é maior que a parcela. Pode indicar quitação de mais de uma parcela.",
  };
};

export default function FinanceiroPage() {
  const router = useRouter();
  const settingsCtx = useSettings() as unknown as {
    systemPreferences?: {
      custom_labels?: Record<string, string>;
      currency_code?: string;
      financial_categories?: { income?: string[]; expense?: string[] };
    };
    companyProfile?: { company_name?: string; [k: string]: unknown };
  };

  const sys = settingsCtx?.systemPreferences;
  const companyProfile = settingsCtx?.companyProfile;

  const L = useMemo(() => {
    const l = sys?.custom_labels || {};
    return {
      hub: l.menu_financial || "Hub Financeiro",
      receber: l.entity_receivable_plural || "Contas a Receber",
      pagar: l.entity_payable_plural || "Contas a Pagar",
      pagarAdmin: l.entity_expense_admin || "Despesas Administrativas",
      pagarOp: l.entity_expense_operational || "Despesas Operacionais",
      pessoal: l.entity_personnel || "Gestão de Pessoal",
      clientes: l.entity_client_plural || "Análise por Cliente",
      cliente: l.entity_client_singular || "Cliente",
      transacao: l.entity_transaction_singular || "Lançamento",
      receita: l.entity_income_singular || "Receita",
      despesa: l.entity_expense_singular || "Despesa",
      os: l.entity_service_order_singular || "OS",
      orcamento: l.entity_quote_singular || "Orçamento",
      salario: l.entity_salary || "Salário",
      comissao: l.entity_commission || "Comissão",
      colaborador: l.entity_member_singular || "Colaborador",
    };
  }, [sys]);

  const currencyCode = sys?.currency_code || "BRL";

  const incomeCategories = useMemo(() => {
    const raw = sys?.financial_categories?.income;
    return raw?.length ? raw : DEFAULT_INCOME_CATEGORIES;
  }, [sys]);

  // ── Core state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [view, setView] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [approvedQuotes, setApprovedQuotes] = useState<ApprovedQuote[]>([]);

  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [attachments, setAttachments] = useState<FinancialAttachment[]>([]);
  const signedUrlsRef = useRef<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const financeAttachmentInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  // ── Filter & pagination state ─────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterClientId, setFilterClientId] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // ── Batch operations state ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Régua de cobrança state ───────────────────────────────────────────────
  const [isReguaOpen, setIsReguaOpen] = useState(false);
  const [reguaConfig, setReguaConfig] = useState<ReguaConfig>(REGUA_DEFAULT);
  const [reguaRunning, setReguaRunning] = useState(false);

  // ── Queue tracking ────────────────────────────────────────────────────────
  const lastQueueViewedAtRef = useRef<string | null>(null);
  const [newQueueCount, setNewQueueCount] = useState(0);

  // ── Form state ────────────────────────────────────────────────────────────
  const [formType, setFormType] = useState<"income" | "expense">("income");
  const [expenseType, setExpenseType] = useState<
    "administrative" | "personnel" | "operational"
  >("administrative");
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setForm] = useState({
    description: "",
    category: "",
    amount: "",
    status: "pending" as "pending" | "paid" | "cancelled",
    dueDate: "",
    paymentDate: "",
    serviceOrderId: "",
    clientId: "",
    memberId: "",
    commissionAmount: "",
    paymentMethod: "pix",
    attachmentUrl: "",
  });

  const [financeActionForm, setFinanceActionForm] = useState({
    comment: "",
    resolutionType: "payment_confirmed",
    resolutionNotes: "",
  });
  const [financeAttachmentFile, setFinanceAttachmentFile] =
    useState<File | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  const formatCurrency = useCallback(
    (v: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currencyCode,
      }).format(v),
    [currencyCode]
  );

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("pt-BR");
  }, []);

  const formatDateTime = useCallback((value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR");
  }, []);

  // ── ESC key closes modal ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isReguaOpen) setIsReguaOpen(false);
        else if (confirmDeleteId) setConfirmDeleteId(null);
        else if (isDetailModalOpen) setIsDetailModalOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDetailModalOpen, confirmDeleteId, isReguaOpen]);

  // ── Reset page when filters/tab change ───────────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [filterStatus, filterClientId, filterDateFrom, filterDateTo, searchTerm, activeTab]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchCurrentUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchCurrentUser();

      const [tRes, cRes, qRes, pRes] = await Promise.all([
        supabase
          .from("financial_transactions")
          .select(
            `id, description, type, expense_type, category, amount, status,
             due_date, payment_date, service_order_id, client_id, member_id,
             attachment_url, payment_method, last_notified_at, invoice_hash,
             quote_id, installment_number, total_installments, source,
             invoice_notes, document_number, workflow_status, dispute_status,
             dispute_reason, dispute_category, customer_last_action_at,
             finance_last_action_at, last_interaction_at, payment_reported_amount,
             payment_reported_method, payment_reported_reference, payment_reported_at,
             payment_confirmed_at, resolution_type, resolution_notes, created_at,
             clients(*),
             member:profiles!member_id(id, full_name, email, role, commission_percentage)`
          )
          .order("due_date", { ascending: true }),
        supabase
          .from("clients")
          .select("id, company_name, email, phone")
          .order("company_name"),
        supabase
          .from("quotes")
          .select("id, title, salesperson_id, final_amount, client_id")
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, email, role, commission_percentage")
          .order("full_name"),
      ]);

      if (qRes.data) setApprovedQuotes(qRes.data as unknown as ApprovedQuote[]);
      if (cRes.data) setClients(cRes.data as Client[]);
      if (pRes.data) setTeam(pRes.data as unknown as Profile[]);
      if (tRes.error) throw tRes.error;
      setTransactions((tRes.data || []) as unknown as Transaction[]);
    } catch (error) {
      console.error(error);
      showToast("Erro ao sincronizar com a nuvem.", "error");
    } finally {
      setLoading(false);
    }
  }, [fetchCurrentUser, showToast]);

  const fetchInteractionDetails = useCallback(
    async (transactionId: string) => {
      if (!transactionId) {
        setEvents([]);
        setAttachments([]);
        return;
      }
      setDetailLoading(true);
      try {
        const [eventsResult, attachmentsResult] = await Promise.all([
          supabase
            .from("financial_transaction_events")
            .select(
              "id, financial_transaction_id, author_id, author_type, visibility, event_type, title, message, metadata, created_at"
            )
            .eq("financial_transaction_id", transactionId)
            .order("created_at", { ascending: false }),
          supabase
            .from("financial_transaction_attachments")
            .select(
              "id, financial_transaction_id, event_id, uploaded_by, uploaded_by_type, visibility, attachment_type, file_name, file_path, file_url, mime_type, file_size, created_at"
            )
            .eq("financial_transaction_id", transactionId)
            .order("created_at", { ascending: false }),
        ]);

        if (eventsResult.error) throw eventsResult.error;
        if (attachmentsResult.error) throw attachmentsResult.error;

        setEvents((eventsResult.data || []) as FinancialEvent[]);
        setAttachments(
          (attachmentsResult.data || []) as FinancialAttachment[]
        );
      } catch (error) {
        console.error(error);
        setEvents([]);
        setAttachments([]);
        showToast("Erro ao carregar histórico financeiro.", "error");
      } finally {
        setDetailLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedTransaction?.id || !isDetailModalOpen) return;
    fetchInteractionDetails(selectedTransaction.id);
  }, [selectedTransaction?.id, isDetailModalOpen, fetchInteractionDetails]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("financeiro-realtime-v3")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_transactions" },
        async () => {
          await fetchData();
          if (selectedTransaction?.id) {
            const latest = await supabase
              .from("financial_transactions")
              .select(
                `id, description, type, expense_type, category, amount, status,
                 due_date, payment_date, service_order_id, client_id, member_id,
                 attachment_url, payment_method, last_notified_at, invoice_hash,
                 quote_id, installment_number, total_installments, source,
                 invoice_notes, document_number, workflow_status, dispute_status,
                 dispute_reason, dispute_category, customer_last_action_at,
                 finance_last_action_at, last_interaction_at, payment_reported_amount,
                 payment_reported_method, payment_reported_reference, payment_reported_at,
                 payment_confirmed_at, resolution_type, resolution_notes, created_at,
                 clients(*),
                 member:profiles!member_id(id, full_name, email, role, commission_percentage)`
              )
              .eq("id", selectedTransaction.id)
              .single();
            if (latest.data)
              setSelectedTransaction(latest.data as unknown as Transaction);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_transaction_events",
        },
        async () => {
          if (selectedTransaction?.id && isDetailModalOpen) {
            await fetchInteractionDetails(selectedTransaction.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_transaction_attachments",
        },
        async () => {
          if (selectedTransaction?.id && isDetailModalOpen) {
            await fetchInteractionDetails(selectedTransaction.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    fetchData,
    fetchInteractionDetails,
    isDetailModalOpen,
    selectedTransaction?.id,
  ]);

  // ── Signed URLs via ref — sem loop ────────────────────────────────────────
  useEffect(() => {
    if (attachments.length === 0) return;

    const loadUrls = async () => {
      const current = signedUrlsRef.current;
      const nextMap: Record<string, string> = { ...current };
      let changed = false;

      for (const file of attachments) {
        if (file.file_path && !current[file.id]) {
          const { data } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(file.file_path, 3600);
          if (data?.signedUrl) {
            nextMap[file.id] = data.signedUrl;
            changed = true;
          }
        }
      }

      if (changed) {
        signedUrlsRef.current = nextMap;
        setSignedUrls({ ...nextMap });
      }
    };

    void loadUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  // ── Queue new-items tracking ──────────────────────────────────────────────
  // FIX: deduplica por grupo (document_number || quote_id) para evitar que
  // múltiplas parcelas do mesmo grupo apareçam como itens separados na fila.
  const clientActionQueue = useMemo(() => {
    const seen = new Set<string>();
    return transactions
      .filter(
        (t) =>
          t.type === "income" &&
          (t.workflow_status === "awaiting_finance" ||
            t.workflow_status === "under_review" ||
            (t.dispute_status &&
              t.dispute_status !== "resolved" &&
              t.dispute_status !== "none"))
      )
      .filter((t) => {
        // Usa a chave de grupo mais específica disponível
        const groupKey = t.document_number || t.quote_id || t.id;
        if (seen.has(groupKey)) return false;
        seen.add(groupKey);
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.last_interaction_at || a.payment_reported_at || a.due_date
        ).getTime();
        const dateB = new Date(
          b.last_interaction_at || b.payment_reported_at || b.due_date
        ).getTime();
        return dateB - dateA;
      });
  }, [transactions]);

  useEffect(() => {
    const lastSeen = lastQueueViewedAtRef.current;
    if (!lastSeen) {
      setNewQueueCount(clientActionQueue.length);
      return;
    }
    const newItems = clientActionQueue.filter((t) => {
      const actionAt = t.last_interaction_at || t.customer_last_action_at;
      return actionAt && new Date(actionAt) > new Date(lastSeen);
    });
    setNewQueueCount(newItems.length);
  }, [clientActionQueue]);

  // ── Filtered transactions ─────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchText =
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.clients?.company_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ??
          false) ||
        (t.category?.toLowerCase().includes(searchTerm.toLowerCase()) ??
          false) ||
        (t.document_number
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ?? false);

      const matchStatus = (() => {
        if (!filterStatus) return true;
        if (filterStatus === "paid")
          return (
            t.status === "paid" ||
            t.status === "received" ||
            t.workflow_status === "confirmed"
          );
        if (filterStatus === "pending")
          return (
            t.status === "pending" &&
            !isOverdue(t.due_date, t.status) &&
            t.workflow_status !== "awaiting_finance" &&
            t.workflow_status !== "under_review" &&
            !(t.dispute_status && t.dispute_status !== "resolved")
          );
        if (filterStatus === "overdue")
          return isOverdue(t.due_date, t.status || "pending");
        if (filterStatus === "awaiting_finance")
          return t.workflow_status === "awaiting_finance";
        if (filterStatus === "disputed")
          return !!(t.dispute_status && t.dispute_status !== "resolved");
        if (filterStatus === "cancelled") return t.status === "cancelled";
        return true;
      })();

      const matchClient = filterClientId
        ? t.client_id === filterClientId
        : true;

      const matchDateFrom = filterDateFrom
        ? t.due_date >= filterDateFrom
        : true;
      const matchDateTo = filterDateTo ? t.due_date <= filterDateTo : true;

      const matchCategory = filterCategory
        ? t.category === filterCategory
        : true;
      return matchText && matchStatus && matchClient && matchDateFrom && matchDateTo && matchCategory;
    });
  }, [
    transactions,
    searchTerm,
    filterStatus,
    filterClientId,
    filterDateFrom,
    filterDateTo,
    filterCategory,
  ]);

  // ── DRE by month ──────────────────────────────────────────────────────────
  const dreByMonth = useMemo(() => {
    const map: Record<
      string,
      { income: number; expense: number; month: string; year: number }
    > = {};

    transactions.forEach((t) => {
      if (t.status === "cancelled") return;
      const isPaid =
        t.status === "paid" ||
        t.status === "received" ||
        t.workflow_status === "confirmed";
      if (!isPaid) return;

      const ref =
        t.payment_date ||
        t.payment_confirmed_at ||
        t.last_interaction_at ||
        t.due_date;
      if (!ref) return;

      const date = new Date(ref);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!map[key]) {
        map[key] = {
          income: 0,
          expense: 0,
          month: date.toLocaleString("pt-BR", { month: "long" }),
          year: date.getFullYear(),
        };
      }

      if (t.type === "income") map[key].income += Number(t.amount || 0);
      if (t.type === "expense") map[key].expense += Number(t.amount || 0);
    });

    let cumulative = 0;
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const balance = val.income - val.expense;
        cumulative += balance;
        return { key, ...val, balance, cumulative };
      });
  }, [transactions]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const paidIn = transactions
      .filter(
        (t) =>
          t.type === "income" &&
          (t.status === "paid" || t.status === "received")
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    const paidOut = transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          (t.status === "paid" || t.status === "received")
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    const pendingIn = transactions
      .filter((t) => t.type === "income" && t.status === "pending")
      .reduce((a, b) => a + Number(b.amount), 0);

    const overdueIn = transactions
      .filter(
        (t) =>
          t.type === "income" &&
          isOverdue(t.due_date, t.status || "pending")
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    const waitingFinance = transactions
      .filter(
        (t) =>
          t.type === "income" && t.workflow_status === "awaiting_finance"
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    const disputedOpen = transactions
      .filter(
        (t) =>
          t.type === "income" &&
          t.dispute_status &&
          t.dispute_status !== "resolved" &&
          t.dispute_status !== "none"
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    const paidThisMonth = transactions
      .filter((t) => {
        if (t.type !== "income") return false;
        if (!(t.status === "paid" || t.status === "received")) return false;
        const date = t.payment_date || t.payment_confirmed_at;
        if (!date) return false;
        const d = new Date(date);
        const now = new Date();
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((a, b) => a + Number(b.amount), 0);

    const expensePaid = transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          (t.status === "paid" || t.status === "received")
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    const peopleCost = transactions
      .filter(
        (t) =>
          t.expense_type === "personnel" &&
          (t.status === "paid" || t.status === "received")
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    return {
      balance: paidIn - paidOut,
      pendingIn,
      overdueIn,
      paidIn,
      paidOut,
      waitingFinance,
      disputedOpen,
      paidThisMonth,
      expensePaid,
      peopleCost,
    };
  }, [transactions]);

  const personnelStats = useMemo(() => {
    const pt = transactions.filter((t) => t.expense_type === "personnel");
    const totalSalaries = pt
      .filter((t) =>
        [L.salario.toLowerCase(), "salário", "salario", "folha"].some((k) =>
          t.category.toLowerCase().includes(k)
        )
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    const totalCommissions = pt
      .filter((t) =>
        [L.comissao.toLowerCase(), "comissão", "comissao"].some((k) =>
          t.category.toLowerCase().includes(k)
        )
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    const byMember: Record<string, { name: string; total: number }> = {};
    pt
      .filter((t) =>
        [L.comissao.toLowerCase(), "comissão", "comissao"].some((k) =>
          t.category.toLowerCase().includes(k)
        )
      )
      .forEach((t) => {
        if (t.member_id && t.member) {
          if (!byMember[t.member_id])
            byMember[t.member_id] = { name: t.member.full_name, total: 0 };
          byMember[t.member_id].total += Number(t.amount);
        }
      });

    const totalRH = pt
      .filter((t) =>
        ["Folha de Pagamento", "Reembolsos RH", "Desconto RH"].includes(t.category)
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    return {
      totalSalaries,
      totalCommissions,
      totalRH,
      commissionByMember: Object.values(byMember).sort(
        (a, b) => b.total - a.total
      ),
    };
  }, [transactions, L]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          (t.status === "paid" || t.status === "received")
      )
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    return Object.entries(map)
      .map(([cat, val]) => ({ cat, val }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 8);
  }, [transactions]);

  const totalExpenses = expenseByCategory.reduce((a, b) => a + b.val, 0);

  const clientSummary = useMemo(
    () =>
      clients
        .map((c) => {
          const ct = transactions.filter(
            (t) => t.client_id === c.id && t.type === "income"
          );
          const ltv = ct
            .filter(
              (t) => t.status === "paid" || t.status === "received"
            )
            .reduce((a, b) => a + Number(b.amount), 0);
          const debt = ct
            .filter((t) => t.status === "pending")
            .reduce((a, b) => a + Number(b.amount), 0);
          return { ...c, ltv, debt };
        })
        .filter((c) => c.ltv > 0 || c.debt > 0)
        .sort((a, b) => b.ltv - a.ltv),
    [clients, transactions]
  );

  // ── Receivable group for selected transaction ─────────────────────────────
  const receivableForGroup = useMemo(() => {
    if (!selectedTransaction || selectedTransaction.type !== "income") return [];
    return transactions
      .filter((t) => t.type === "income")
      .filter((t) => {
        if (
          selectedTransaction.document_number &&
          t.document_number
        )
          return t.document_number === selectedTransaction.document_number;
        if (selectedTransaction.quote_id && t.quote_id)
          return t.quote_id === selectedTransaction.quote_id;
        if (
          selectedTransaction.client_id &&
          t.client_id &&
          selectedTransaction.description
        ) {
          const baseA = selectedTransaction.description
            .replace(/-\s*parcela\s*\d+\/\d+/i, "")
            .trim();
          const baseB = t.description
            .replace(/-\s*parcela\s*\d+\/\d+/i, "")
            .trim();
          return (
            selectedTransaction.client_id === t.client_id && baseA === baseB
          );
        }
        return t.id === selectedTransaction.id;
      })
      .sort((a, b) => {
        const aN = a.installment_number || 999;
        const bN = b.installment_number || 999;
        if (aN !== bN) return aN - bN;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
  }, [selectedTransaction, transactions]);

  const selectedPaymentInfo = useMemo(
    () =>
      selectedTransaction ? getPaymentDifference(selectedTransaction) : null,
    [selectedTransaction]
  );

  const currentCategories = useMemo(() => {
    if (formType === "income") return incomeCategories;
    if (expenseType === "administrative")
      return DEFAULT_EXPENSE_ADMIN_CATEGORIES;
    if (expenseType === "operational")
      return DEFAULT_EXPENSE_OPERATIONAL_CATEGORIES;
    return DEFAULT_EXPENSE_PERSONNEL_CATEGORIES;
  }, [formType, expenseType, incomeCategories]);

  const filteredClientsList = useMemo(
    () =>
      clients
        .filter((c) =>
          c.company_name.toLowerCase().includes(clientSearch.toLowerCase())
        )
        .slice(0, 8),
    [clients, clientSearch]
  );

  const filteredTeamList = useMemo(
    () =>
      team
        .filter((t) =>
          t.full_name?.toLowerCase().includes(memberSearch.toLowerCase())
        )
        .slice(0, 8),
    [team, memberSearch]
  );

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: "dashboard" as TabId, label: "Visão Geral", icon: TrendingUp },
    { id: "receber" as TabId, label: L.receber, icon: ArrowUpRight },
    { id: "pagar_admin" as TabId, label: L.pagarAdmin, icon: DollarSign },
    { id: "pagar_operacional" as TabId, label: L.pagarOp, icon: Zap },
    { id: "pessoal" as TabId, label: L.pessoal, icon: Users },
    { id: "clientes" as TabId, label: L.clientes, icon: Building },
    { id: "dre" as TabId, label: "DRE", icon: BarChart3 },
  ];

  const CHART_COLORS = [
    "bg-cs-green",
    "bg-cs-gold",
    "bg-blue-500",
    "bg-purple-500",
    "bg-red-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-pink-500",
  ];

  // ── Form helpers ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditId(null);
    setFormType("income");
    setExpenseType("administrative");
    setForm({
      description: "",
      category: "",
      amount: "",
      status: "pending",
      dueDate: "",
      paymentDate: "",
      serviceOrderId: "",
      clientId: "",
      memberId: "",
      commissionAmount: "",
      paymentMethod: "pix",
      attachmentUrl: "",
    });
    setClientSearch("");
    setMemberSearch("");
  };

  const openEditForm = (t: Transaction) => {
    setIsDetailModalOpen(false);
    setEditId(t.id);
    setFormType(t.type);
    setExpenseType(t.expense_type || "administrative");
    setForm({
      description: t.description,
      category: t.category,
      amount: t.amount.toString(),
      status: (t.status as "pending" | "paid" | "cancelled") || "pending",
      dueDate: t.due_date,
      paymentDate: t.payment_date || "",
      serviceOrderId: t.quote_id || t.service_order_id || "",
      clientId: t.client_id || "",
      memberId: t.member_id || "",
      commissionAmount: "",
      paymentMethod: t.payment_method || "pix",
      attachmentUrl: t.attachment_url || "",
    });
    setClientSearch(t.clients?.company_name || "");
    setMemberSearch(t.member?.full_name || "");
    setView("create");
  };

  const openCreateForTab = (tab: TabId) => {
    resetForm();
    if (tab === "receber") setFormType("income");
    else if (tab === "pagar_admin") {
      setFormType("expense");
      setExpenseType("administrative");
    } else if (tab === "pagar_operacional") {
      setFormType("expense");
      setExpenseType("operational");
    } else if (tab === "pessoal") {
      setFormType("expense");
      setExpenseType("personnel");
    } else setFormType("income");
    setView("create");
  };

  // ── Storage helpers ───────────────────────────────────────────────────────
  const buildFinanceStoragePath = useCallback(
    (file: File, transactionId: string) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const clientId =
        selectedTransaction?.client_id || formData.clientId || "internal";
      return `financial/${clientId}/${transactionId}/finance/${Date.now()}-${safeName}`;
    },
    [formData.clientId, selectedTransaction?.client_id]
  );

  const uploadPrivateFile = useCallback(
    async (file: File, transactionId: string) => {
      const path = buildFinanceStoragePath(file, transactionId);
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
      if (error) throw new Error(error.message || "Erro no upload do arquivo.");
      return {
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size || null,
      };
    },
    [buildFinanceStoragePath]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const tempTransactionId = editId || crypto.randomUUID();
      const uploaded = await uploadPrivateFile(file, tempTransactionId);
      const { data } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(uploaded.file_path, 3600);
      setForm((prev) => ({
        ...prev,
        attachmentUrl: data?.signedUrl || uploaded.file_path,
      }));
      showToast("Documento processado com sucesso.", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Erro no upload.",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportCSV = useCallback(
    (rows: Transaction[], filename: string) => {
      const headers = [
        "Descrição",
        "Categoria",
        "Tipo",
        "Valor",
        "Vencimento",
        "Status",
        "Workflow",
        "Cliente / Membro",
        "Documento",
      ];
      const csvRows = rows.map((t) =>
        [
          `"${t.description.replace(/"/g, '""')}"`,
          `"${(t.category || "").replace(/"/g, '""')}"`,
          t.type === "income" ? "Receita" : "Despesa",
          Number(t.amount).toFixed(2).replace(".", ","),
          t.due_date,
          statusLabel(t),
          translateWorkflowStatus(t.workflow_status),
          `"${(t.clients?.company_name || t.member?.full_name || "").replace(/"/g, '""')}"`,
          `"${t.document_number || ""}"`,
        ].join(";")
      );
      const csv = [headers.join(";"), ...csvRows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  const exportDRE = useCallback(() => {
    const headers = ["Mês/Ano", "Receitas", "Despesas", "Resultado", "Acumulado"];
    const rows = dreByMonth.map((m) =>
      [
        `${m.month} ${m.year}`,
        m.income.toFixed(2).replace(".", ","),
        m.expense.toFixed(2).replace(".", ","),
        m.balance.toFixed(2).replace(".", ","),
        m.cumulative.toFixed(2).replace(".", ","),
      ].join(";")
    );
    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dreByMonth]);

  // ── Batch operations ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllRows = (rows: Transaction[]) => {
    setSelectedIds(new Set(rows.map((r) => r.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBatchWhatsApp = useCallback(() => {
    const selected = transactions.filter(
      (t) => selectedIds.has(t.id) && t.clients?.phone
    );
    if (selected.length === 0) {
      showToast("Nenhum dos selecionados possui telefone cadastrado.", "warning");
      return;
    }
    for (const t of selected) {
      const phone = t.clients!.phone!.replace(/\D/g, "");
      const msg = `Olá, ${t.clients!.company_name}. Sua cobrança "${t.description}" no valor de ${formatCurrency(Number(t.amount))} vence em ${new Date(`${t.due_date}T00:00:00`).toLocaleDateString("pt-BR")}.`;
      window.open(
        `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`,
        "_blank"
      );
    }
    clearSelection();
  }, [transactions, selectedIds, formatCurrency, showToast]);

  const handleBatchEmail = useCallback(async () => {
    const selected = transactions.filter(
      (t) => selectedIds.has(t.id) && t.clients?.email
    );
    if (selected.length === 0) {
      showToast("Nenhum dos selecionados possui e-mail cadastrado.", "warning");
      return;
    }
    let sent = 0;
    for (const t of selected) {
      try {
        const res = await fetch("/api/finance/send-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: t.id,
            companyName: companyProfile?.company_name || "ARXUM",
          }),
        });
        if (res.ok) sent++;
      } catch {}
    }
    showToast(`${sent} e-mail(s) enviado(s).`, "success");
    clearSelection();
  }, [transactions, selectedIds, companyProfile, showToast]);

  // ── Régua de cobrança ─────────────────────────────────────────────────────
  const runRegua = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eligible = transactions.filter(
      (t) =>
        t.type === "income" && t.status === "pending" && t.clients?.phone
    );

    let sent = 0;

    for (const t of eligible) {
      const dueDate = new Date(`${t.due_date}T00:00:00`);
      const diffDays = Math.round(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      let template = "";
      if (diffDays === 3 && reguaConfig.enableMinus3)
        template = reguaConfig.messageMinus3;
      else if (diffDays === 0 && reguaConfig.enableD0)
        template = reguaConfig.messageD0;
      else if (diffDays === -5 && reguaConfig.enablePlus5)
        template = reguaConfig.messagePlus5;

      if (!template) continue;

      const formatted = template
        .replace("{cliente}", t.clients?.company_name || "")
        .replace("{valor}", formatCurrency(Number(t.amount)))
        .replace("{data}", dueDate.toLocaleDateString("pt-BR"));

      const phone = t.clients!.phone!.replace(/\D/g, "");
      window.open(
        `https://wa.me/55${phone}?text=${encodeURIComponent(formatted)}`,
        "_blank"
      );
      sent++;
      await new Promise((r) => setTimeout(r, 600));
    }

    showToast(
      sent > 0
        ? `Régua executada: ${sent} mensagem(ns) preparada(s).`
        : "Nenhuma cobrança elegível para hoje.",
      sent > 0 ? "success" : "warning"
    );
    setIsReguaOpen(false);
  }, [transactions, reguaConfig, formatCurrency, showToast]);

  // ── CRUD / actions ────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.dueDate) {
      showToast("Preencha os campos obrigatórios.", "warning");
      return;
    }
    setIsSubmitting(true);

    const getCategoryForType = () => {
      if (formType === "income")
        return formData.category || incomeCategories[0] || "";
      if (expenseType === "administrative")
        return formData.category || DEFAULT_EXPENSE_ADMIN_CATEGORIES[0] || "";
      if (expenseType === "operational")
        return (
          formData.category || DEFAULT_EXPENSE_OPERATIONAL_CATEGORIES[0] || ""
        );
      return formData.category || DEFAULT_EXPENSE_PERSONNEL_CATEGORIES[0] || "";
    };

    const payload: Record<string, unknown> = {
      description: formData.description,
      type: formType,
      expense_type: formType === "expense" ? expenseType : null,
      category: getCategoryForType(),
      amount: Number(formData.amount),
      status: formData.status,
      due_date: formData.dueDate,
      payment_date:
        formData.status === "paid"
          ? formData.paymentDate ||
            new Date().toISOString().split("T")[0]
          : null,
      service_order_id: null,
      quote_id: formData.serviceOrderId || null,
      client_id: formType === "income" ? formData.clientId || null : null,
      member_id:
        expenseType === "personnel" && formType === "expense"
          ? formData.memberId || null
          : null,
      payment_method: formData.paymentMethod,
      attachment_url: formData.attachmentUrl || null,
    };

    const { error, data } = editId
      ? await supabase
          .from("financial_transactions")
          .update(payload)
          .eq("id", editId)
          .select("id")
          .single()
      : await supabase
          .from("financial_transactions")
          .insert([payload])
          .select("id")
          .single();

    if (!error) {
      showToast("Lançamento gravado com sucesso.", "success");
      setView("list");
      await fetchData();
      resetForm();

      if (data?.id && fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0];
        try {
          const uploaded = await uploadPrivateFile(file, data.id);
          await supabase.from("financial_transaction_attachments").insert({
            financial_transaction_id: data.id,
            uploaded_by: currentUserId,
            uploaded_by_type: "finance",
            visibility: "internal",
            attachment_type: "admin_attachment",
            file_name: uploaded.file_name,
            file_path: uploaded.file_path,
            mime_type: uploaded.mime_type,
            file_size: uploaded.file_size,
          });
        } catch (attachmentError) {
          console.error(attachmentError);
        }
      }
    } else {
      showToast(error.message, "error");
    }
    setIsSubmitting(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      status: newStatus,
      payment_date:
        newStatus === "paid"
          ? new Date().toISOString().split("T")[0]
          : null,
      finance_last_action_at: now,
      last_interaction_at: now,
    };

    const { error } = await supabase
      .from("financial_transactions")
      .update(payload)
      .eq("id", id);

    if (!error) {
      showToast("Status atualizado.", "success");
      await fetchData();
      setSelectedTransaction((prev) =>
        prev?.id === id
          ? { ...prev, status: newStatus as Transaction["status"] }
          : prev
      );
    } else {
      showToast(error.message, "error");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase
      .from("financial_transactions")
      .delete()
      .eq("id", id);
    if (!error) {
      setConfirmDeleteId(null);
      setIsDetailModalOpen(false);
      await fetchData();
      showToast("Registro removido.", "success");
    } else {
      showToast("Erro ao excluir.", "error");
    }
  };

  const sendWhatsApp = (t: Transaction) => {
    const phone = t.clients?.phone?.replace(/\D/g, "");
    if (!phone) {
      showToast(`${L.cliente} sem telefone cadastrado.`, "warning");
      return;
    }
    const msg = `Olá, ${t.clients?.company_name}. Há um lançamento pendente: ${t.description} no valor de ${formatCurrency(t.amount)}, com vencimento em ${new Date(`${t.due_date}T00:00:00`).toLocaleDateString("pt-BR")}.`;
    window.open(
      `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  const sendInvoiceEmail = async (t: Transaction) => {
    if (!t.clients?.email) {
      showToast(`${L.cliente} sem e-mail cadastrado.`, "warning");
      return;
    }
    setIsSendingMail(true);
    try {
      const res = await fetch("/api/finance/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: t.id,
          companyName: companyProfile?.company_name || "ARXUM",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar e-mail.");
      showToast("Cobrança disparada via e-mail.", "success");
      await fetchData();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Erro ao enviar e-mail.",
        "error"
      );
    } finally {
      setIsSendingMail(false);
    }
  };

  // ── Finance event helpers ─────────────────────────────────────────────────
  const registerFinanceEvent = useCallback(
    async (
      transactionId: string,
      eventType: string,
      title: string,
      message: string,
      metadata?: Record<string, unknown>,
      visibility: "shared" | "internal" = "shared"
    ) => {
      const { data, error } = await supabase
        .from("financial_transaction_events")
        .insert({
          financial_transaction_id: transactionId,
          author_id: currentUserId,
          author_type: "finance",
          visibility,
          event_type: eventType,
          title,
          message,
          metadata: metadata || null,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message || "Erro ao registrar evento.");
      return data?.id as string;
    },
    [currentUserId]
  );

  const attachFinanceFileIfAny = useCallback(
    async (
      transactionId: string,
      eventId?: string | null,
      attachmentType = "finance_attachment"
    ) => {
      if (!financeAttachmentFile) return;
      const uploaded = await uploadPrivateFile(
        financeAttachmentFile,
        transactionId
      );
      const { error } = await supabase
        .from("financial_transaction_attachments")
        .insert({
          financial_transaction_id: transactionId,
          event_id: eventId || null,
          uploaded_by: currentUserId,
          uploaded_by_type: "finance",
          visibility: "shared",
          attachment_type: attachmentType,
          file_name: uploaded.file_name,
          file_path: uploaded.file_path,
          mime_type: uploaded.mime_type,
          file_size: uploaded.file_size,
        });
      if (error) throw new Error(error.message || "Erro ao salvar anexo.");
    },
    [currentUserId, financeAttachmentFile, uploadPrivateFile]
  );

  const refreshSelectedTransaction = useCallback(
    async (transactionId: string) => {
      const { data } = await supabase
        .from("financial_transactions")
        .select(
          `id, description, type, expense_type, category, amount, status,
           due_date, payment_date, service_order_id, client_id, member_id,
           attachment_url, payment_method, last_notified_at, invoice_hash,
           quote_id, installment_number, total_installments, source,
           invoice_notes, document_number, workflow_status, dispute_status,
           dispute_reason, dispute_category, customer_last_action_at,
           finance_last_action_at, last_interaction_at, payment_reported_amount,
           payment_reported_method, payment_reported_reference, payment_reported_at,
           payment_confirmed_at, resolution_type, resolution_notes, created_at,
           clients(*),
           member:profiles!member_id(id, full_name, email, role, commission_percentage)`
        )
        .eq("id", transactionId)
        .single();

      if (data) setSelectedTransaction(data as unknown as Transaction);
      await fetchInteractionDetails(transactionId);
    },
    [fetchInteractionDetails]
  );

  // ── Finance actions ───────────────────────────────────────────────────────
  const handleConfirmPayment = async () => {
    if (!selectedTransaction) return;
    setActionSubmitting(true);
    try {
      const now = new Date().toISOString();
      const paymentInfo = getPaymentDifference(selectedTransaction);

      const eventId = await registerFinanceEvent(
        selectedTransaction.id,
        "payment_confirmed",
        "Pagamento confirmado pelo financeiro",
        financeActionForm.comment.trim() ||
          "Pagamento conferido e confirmado pelo financeiro.",
        {
          valor_previsto: paymentInfo.expected,
          valor_informado: paymentInfo.reported,
          diferenca: paymentInfo.difference,
          forma_pagamento:
            selectedTransaction.payment_reported_method ||
            selectedTransaction.payment_method ||
            null,
          referencia: selectedTransaction.payment_reported_reference || null,
        }
      );

      await attachFinanceFileIfAny(
        selectedTransaction.id,
        eventId,
        "finance_confirmation"
      );

      const { error } = await supabase
        .from("financial_transactions")
        .update({
          status: paymentInfo.scenario === "partial" ? "pending" : "paid",
          workflow_status:
            paymentInfo.scenario === "partial" ? "under_review" : "confirmed",
          payment_date:
            paymentInfo.scenario === "partial"
              ? null
              : new Date().toISOString().split("T")[0],
          payment_confirmed_at:
            paymentInfo.scenario === "partial" ? null : now,
          finance_last_action_at: now,
          last_interaction_at: now,
          // Valores aceitos pelo constraint: payment_confirmed, charge_corrected,
          // charge_cancelled, dispute_rejected, written_off
          // Para pagamento parcial: dispute_rejected mantém a cobrança aberta
          resolution_type:
            paymentInfo.scenario === "partial"
              ? "dispute_rejected"
              : "payment_confirmed",
          resolution_notes:
            financeActionForm.resolutionNotes.trim() ||
            (paymentInfo.scenario === "partial"
              ? "Pagamento parcial confirmado. Mantida pendência de saldo."
              : financeActionForm.comment.trim() ||
                "Pagamento confirmado pelo financeiro."),
          dispute_status:
            selectedTransaction.dispute_status === "open"
              ? "resolved"
              : selectedTransaction.dispute_status || null,
        })
        .eq("id", selectedTransaction.id);

      if (error) throw new Error(error.message || "Erro ao confirmar pagamento.");

      // Inserir comissão de venda ao confirmar pagamento integral
      if (paymentInfo.scenario !== "partial" && selectedTransaction.quote_id) {
        const { data: quoteData } = await supabase
          .from("quotes")
          .select("salesperson_id")
          .eq("id", selectedTransaction.quote_id)
          .single();

        if (quoteData?.salesperson_id) {
          const { data: sellerData } = await supabase
            .from("profiles")
            .select("commission_percentage")
            .eq("id", quoteData.salesperson_id)
            .single();

          if (sellerData?.commission_percentage) {
            const commissionAmount =
              (Number(selectedTransaction.amount) * sellerData.commission_percentage) / 100;
            await supabase.from("financial_transactions").insert({
              type: "expense",
              expense_type: "personnel",
              category: "Comissão de Vendas",
              description: `Comissão sobre ${selectedTransaction.description || "venda"}`,
              amount: commissionAmount,
              status: "pending",
              due_date: new Date().toISOString().split("T")[0],
              member_id: quoteData.salesperson_id,
              client_id: selectedTransaction.client_id ?? null,
              quote_id: selectedTransaction.quote_id,
              source: "commission_auto",
            });
          }
        }
      }

      showToast(
        paymentInfo.scenario === "partial"
          ? "Pagamento parcial registrado. A cobrança segue em análise."
          : "Pagamento confirmado e baixa realizada.",
        "success"
      );
      setFinanceActionForm({
        comment: "",
        resolutionType: "payment_confirmed",
        resolutionNotes: "",
      });
      setFinanceAttachmentFile(null);
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Erro ao confirmar pagamento.",
        "error"
      );
    } finally {
      setActionSubmitting(false);
    }
  };

  // ── Auto-conciliation ─────────────────────────────────────────────────────
  const handleAutoDistribute = async () => {
    if (!selectedTransaction || !selectedPaymentInfo) return;
    if (selectedPaymentInfo.scenario !== "over") return;

    const excess = selectedPaymentInfo.difference;
    const openInstallments = receivableForGroup
      .filter(
        (r) =>
          r.id !== selectedTransaction.id && r.status === "pending"
      )
      .sort(
        (a, b) =>
          (a.installment_number || 0) - (b.installment_number || 0)
      );

    if (openInstallments.length === 0) {
      showToast(
        "Não há parcelas abertas no grupo para receber o excedente.",
        "warning"
      );
      return;
    }

    setActionSubmitting(true);
    try {
      const now = new Date().toISOString();
      let remaining = excess;

      for (const installment of openInstallments) {
        if (remaining <= 0) break;
        const installmentAmount = Number(installment.amount);

        if (remaining >= installmentAmount) {
          await supabase
            .from("financial_transactions")
            .update({
              status: "paid",
              workflow_status: "confirmed",
              payment_confirmed_at: now,
              finance_last_action_at: now,
              last_interaction_at: now,
              resolution_type: "payment_confirmed",
              resolution_notes: `Pago automaticamente por distribuição de excedente da parcela ${selectedTransaction.installment_number || 1}.`,
            })
            .eq("id", installment.id);

          await registerFinanceEvent(
            installment.id,
            "payment_confirmed",
            "Pagamento confirmado por conciliação automática",
            `Excedente de ${formatCurrency(remaining)} aplicado automaticamente a esta parcela.`,
            {
              origem: "auto_conciliacao",
              parcela_origem: selectedTransaction.installment_number,
              valor_aplicado: installmentAmount,
            }
          );

          remaining -= installmentAmount;
        } else {
          await registerFinanceEvent(
            installment.id,
            "payment_reported",
            "Pagamento parcial por conciliação automática",
            `Excedente residual de ${formatCurrency(remaining)} registrado nesta parcela.`,
            {
              origem: "auto_conciliacao",
              valor_aplicado: remaining,
              valor_restante: installmentAmount - remaining,
            }
          );
          remaining = 0;
        }
      }

      showToast("Conciliação automática realizada com sucesso.", "success");
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: unknown) {
      showToast(
        error instanceof Error
          ? error.message
          : "Erro na conciliação automática.",
        "error"
      );
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedTransaction) return;
    if (!financeActionForm.comment.trim()) {
      showToast("Informe o motivo da rejeição.", "warning");
      return;
    }
    setActionSubmitting(true);
    try {
      const now = new Date().toISOString();
      const eventId = await registerFinanceEvent(
        selectedTransaction.id,
        "payment_rejected",
        "Pagamento rejeitado pelo financeiro",
        financeActionForm.comment.trim(),
        {
          referencia:
            selectedTransaction.payment_reported_reference || null,
          pagamento_informado_em:
            selectedTransaction.payment_reported_at || null,
        }
      );
      await attachFinanceFileIfAny(
        selectedTransaction.id,
        eventId,
        "finance_rejection"
      );
      const { error } = await supabase
        .from("financial_transactions")
        .update({
          status: "pending",
          workflow_status: "open",
          finance_last_action_at: now,
          last_interaction_at: now,
          resolution_type: "dispute_rejected",
          resolution_notes:
            financeActionForm.resolutionNotes.trim() ||
            financeActionForm.comment.trim(),
        })
        .eq("id", selectedTransaction.id);
      if (error) throw new Error(error.message);
      showToast("Pagamento rejeitado com retorno ao cliente.", "success");
      setFinanceActionForm({
        comment: "",
        resolutionType: "payment_confirmed",
        resolutionNotes: "",
      });
      setFinanceAttachmentFile(null);
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Erro ao rejeitar.",
        "error"
      );
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleResolveDispute = async () => {
    if (!selectedTransaction) return;
    if (!financeActionForm.resolutionNotes.trim()) {
      showToast("Informe a resolução da contestação.", "warning");
      return;
    }
    setActionSubmitting(true);
    try {
      const now = new Date().toISOString();
      const eventId = await registerFinanceEvent(
        selectedTransaction.id,
        "resolution_added",
        "Contestação analisada pelo financeiro",
        financeActionForm.comment.trim() ||
          "Contestação analisada e concluída pelo financeiro.",
        {
          tipo_resolucao: financeActionForm.resolutionType,
          observacoes: financeActionForm.resolutionNotes.trim(),
        }
      );
      await attachFinanceFileIfAny(
        selectedTransaction.id,
        eventId,
        "finance_resolution"
      );

      const nextStatus =
        financeActionForm.resolutionType === "charge_cancelled"
          ? "cancelled"
          : financeActionForm.resolutionType === "payment_confirmed"
          ? "paid"
          : selectedTransaction.status || "pending";
      const nextWorkflow =
        financeActionForm.resolutionType === "charge_cancelled"
          ? "cancelled"
          : financeActionForm.resolutionType === "payment_confirmed"
          ? "confirmed"
          : financeActionForm.resolutionType === "charge_corrected"
          ? "open"
          : "resolved";

      const { error } = await supabase
        .from("financial_transactions")
        .update({
          status: nextStatus,
          workflow_status: nextWorkflow,
          dispute_status: "resolved",
          finance_last_action_at: now,
          last_interaction_at: now,
          resolution_type: financeActionForm.resolutionType,
          resolution_notes: financeActionForm.resolutionNotes.trim(),
          payment_confirmed_at:
            financeActionForm.resolutionType === "payment_confirmed"
              ? now
              : selectedTransaction.payment_confirmed_at || null,
        })
        .eq("id", selectedTransaction.id);

      if (error) throw new Error(error.message);
      showToast("Contestação resolvida.", "success");
      setFinanceActionForm({
        comment: "",
        resolutionType: "payment_confirmed",
        resolutionNotes: "",
      });
      setFinanceAttachmentFile(null);
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Erro ao resolver.",
        "error"
      );
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleAddFinanceComment = async () => {
    if (!selectedTransaction) return;
    if (!financeActionForm.comment.trim()) {
      showToast("Digite um comentário para registrar.", "warning");
      return;
    }
    setActionSubmitting(true);
    try {
      const eventId = await registerFinanceEvent(
        selectedTransaction.id,
        "finance_comment",
        "Comentário do financeiro",
        financeActionForm.comment.trim()
      );
      await attachFinanceFileIfAny(
        selectedTransaction.id,
        eventId,
        "finance_comment_attachment"
      );
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status:
            selectedTransaction.workflow_status === "awaiting_finance"
              ? "under_review"
              : selectedTransaction.workflow_status || "open",
          finance_last_action_at: now,
          last_interaction_at: now,
        })
        .eq("id", selectedTransaction.id);
      if (error) throw new Error(error.message);
      showToast("Comentário registrado.", "success");
      setFinanceActionForm((prev) => ({ ...prev, comment: "" }));
      setFinanceAttachmentFile(null);
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Erro ao comentar.",
        "error"
      );
    } finally {
      setActionSubmitting(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderMetricCard = (
    label: string,
    value: string,
    tone?: "default" | "green" | "gold" | "red" | "orange"
  ) => {
    const valueColor =
      tone === "green"
        ? "text-cs-green"
        : tone === "gold"
        ? "text-cs-gold"
        : tone === "red"
        ? "text-red-500"
        : tone === "orange"
        ? "text-orange-400"
        : "text-white";
    const borderTone =
      tone === "green"
        ? "border-cs-green/20"
        : tone === "gold"
        ? "border-cs-gold/20"
        : tone === "red"
        ? "border-red-500/20"
        : tone === "orange"
        ? "border-orange-500/20"
        : "border-surface/50";
    return (
      <div
        className={`rounded-xl border ${borderTone} bg-surface p-5 shadow-lg`}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-text-secondary">
          {label}
        </p>
        <p
          className={`mt-3 break-words text-2xl font-black leading-tight ${valueColor}`}
        >
          {value}
        </p>
      </div>
    );
  };

  const renderTable = (
    typeFilter: "income" | "expense",
    expFilter?: "administrative" | "operational" | "personnel"
  ) => {
    const baseRows = filteredTransactions.filter(
      (t) =>
        t.type === typeFilter &&
        (!expFilter || t.expense_type === expFilter)
    );

    const totalPages = Math.ceil(baseRows.length / PAGE_SIZE);
    const paginatedRows = baseRows.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );

    const allSelected =
      paginatedRows.length > 0 &&
      paginatedRows.every((r) => selectedIds.has(r.id));

    return (
      <div className="space-y-5">
        {typeFilter === "income" && (
          <section className="rounded-xl border border-cs-gold/20 bg-cs-gold/5 p-5 shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                  <ShieldAlert size={16} className="text-cs-gold" />
                  Fila de ações do cliente
                  {newQueueCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-black text-orange-400 animate-pulse">
                      <Bell size={10} /> {newQueueCount} novo(s)
                    </span>
                  )}
                </h4>
                <p className="mt-1 text-xs uppercase tracking-wide text-text-secondary">
                  Cobranças com pagamento informado, divergência ou contestação.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cs-gold/20 bg-cs-gold/10 px-3 py-1 text-xs font-black uppercase text-cs-gold">
                  Aguardando financeiro:{" "}
                  {
                    clientActionQueue.filter(
                      (t) => t.workflow_status === "awaiting_finance"
                    ).length
                  }
                </span>
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase text-orange-400">
                  Contestações:{" "}
                  {
                    clientActionQueue.filter(
                      (t) =>
                        t.dispute_status &&
                        t.dispute_status !== "resolved" &&
                        t.dispute_status !== "none"
                    ).length
                  }
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {clientActionQueue.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-background/40 p-4 text-xs font-bold uppercase tracking-wide text-text-secondary">
                  Nenhuma ação pendente do cliente no momento.
                </div>
              ) : (
                clientActionQueue.slice(0, 8).map((t) => {
                  const isNew =
                    lastQueueViewedAtRef.current &&
                    t.last_interaction_at &&
                    new Date(t.last_interaction_at) >
                      new Date(lastQueueViewedAtRef.current);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={async () => {
                        lastQueueViewedAtRef.current = new Date().toISOString();
                        setNewQueueCount(0);
                        setSelectedTransaction(t);
                        setIsDetailModalOpen(true);
                        await fetchInteractionDetails(t.id);
                      }}
                      className={`rounded-lg border p-4 text-left transition-all hover:border-cs-gold/40 hover:bg-background/60 ${
                        isNew
                          ? "border-orange-500/30 bg-orange-500/5"
                          : "border-white/10 bg-background/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {t.description}
                          </p>
                          <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-text-secondary">
                            {t.clients?.company_name || "Sem cliente"} ·{" "}
                            {t.document_number || "Sem documento"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {isNew && (
                            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-orange-400">
                              Novo
                            </span>
                          )}
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(t)}`}
                          >
                            {statusLabel(t)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                        <span>{formatCurrency(Number(t.amount))}</span>
                        <span>Vence em {formatDate(t.due_date)}</span>
                        {t.payment_reported_amount ? (
                          <span>
                            Informado:{" "}
                            {formatCurrency(Number(t.payment_reported_amount))}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        )}

        <div className="overflow-hidden rounded-lg border border-surface/50 bg-surface shadow-xl">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-surface/50 bg-surface/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Filtrar lançamentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 rounded-md border border-surface bg-background py-2 pl-9 pr-4 text-xs text-white outline-none transition-all focus:border-cs-green"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((p) => !p)}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black uppercase transition-all ${
                  showFilters
                    ? "border-cs-gold/40 bg-cs-gold/10 text-cs-gold"
                    : "border-surface text-text-secondary hover:text-white"
                }`}
              >
                <SlidersHorizontal size={14} /> Filtros
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs font-bold text-text-secondary">
                    {selectedIds.size} selecionado(s)
                  </span>
                  <button
                    type="button"
                    onClick={handleBatchWhatsApp}
                    className="inline-flex items-center gap-1.5 rounded-md border border-cs-green/20 bg-cs-green/10 px-3 py-1.5 text-[11px] font-black uppercase text-cs-green hover:bg-cs-green/20"
                  >
                    <MessageCircle size={13} /> WhatsApp em lote
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchEmail}
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[11px] font-black uppercase text-blue-400 hover:bg-blue-500/20"
                  >
                    <Mail size={13} /> E-mail em lote
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs text-text-secondary hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() =>
                  exportCSV(
                    baseRows,
                    `lancamentos-${typeFilter}-${new Date().toISOString().split("T")[0]}.csv`
                  )
                }
                className="inline-flex items-center gap-2 rounded-md border border-surface px-3 py-2 text-xs font-black uppercase text-white hover:bg-background"
              >
                <Download size={14} /> CSV
              </button>
              <button
                type="button"
                onClick={fetchData}
                className="inline-flex items-center gap-2 rounded-md border border-surface px-3 py-2 text-xs font-black uppercase text-white hover:bg-background"
              >
                <RefreshCw size={14} /> Atualizar
              </button>
            </div>
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 border-b border-surface/50 bg-background/30 px-4 py-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-md border border-surface bg-background px-3 py-2 text-xs text-white outline-none focus:border-cs-green"
              >
                <option value="">Todos os status</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
                <option value="awaiting_finance">Aguardando financeiro</option>
                <option value="disputed">Contestação</option>
                <option value="cancelled">Cancelado</option>
              </select>
              {typeFilter === "income" && (
                <select
                  value={filterClientId}
                  onChange={(e) => setFilterClientId(e.target.value)}
                  className="rounded-md border border-surface bg-background px-3 py-2 text-xs text-white outline-none focus:border-cs-green"
                >
                  <option value="">Todos os clientes</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2">
                <CalendarRange size={14} className="text-text-secondary" />
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="rounded-md border border-surface bg-background px-3 py-2 text-xs text-white outline-none focus:border-cs-green"
                  style={{ colorScheme: "dark" }}
                />
                <span className="text-xs text-text-secondary">até</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="rounded-md border border-surface bg-background px-3 py-2 text-xs text-white outline-none focus:border-cs-green"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-md border border-surface bg-background px-3 py-2 text-xs text-white outline-none focus:border-cs-green"
              >
                <option value="">Todas as categorias</option>
                <option value="Folha de Pagamento">Folha de Pagamento</option>
                <option value="Reembolsos RH">Reembolsos RH</option>
                <option value="Desconto RH">Desconto RH</option>
                <option value="Comissão de Vendas">Comissão de Vendas</option>
              </select>
              {(filterStatus || filterClientId || filterDateFrom || filterDateTo || filterCategory) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus("");
                    setFilterClientId("");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                    setFilterCategory("");
                  }}
                  className="text-xs font-bold text-red-400 hover:text-red-300"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background/50 text-xs font-black uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        allSelected
                          ? clearSelection()
                          : selectAllRows(paginatedRows)
                      }
                      className="cursor-pointer accent-cs-green"
                    />
                  </th>
                  <th className="px-6 py-4">Descrição / Favorecido</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center">
                      <Loader2
                        className="mx-auto animate-spin text-cs-green"
                        size={24}
                      />
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm font-semibold uppercase tracking-wide text-text-secondary"
                    >
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((t) => (
                    <tr
                      key={t.id}
                      className="group transition-colors hover:bg-background/50"
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          className="cursor-pointer accent-cs-green"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-white transition-colors group-hover:text-cs-green">
                          {t.description}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-xs font-black uppercase text-text-secondary">
                            {t.clients?.company_name ||
                              t.member?.full_name ||
                              "—"}
                          </p>
                          {typeFilter === "income" &&
                          t.payment_reported_amount ? (
                            <span className="rounded-full border border-cs-gold/20 bg-cs-gold/10 px-2 py-0.5 text-[10px] font-black uppercase text-cs-gold">
                              Informado:{" "}
                              {formatCurrency(
                                Number(t.payment_reported_amount)
                              )}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {t.category}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-bold ${
                            isOverdue(t.due_date, t.status || "pending")
                              ? "text-red-500"
                              : "text-white"
                          }`}
                        >
                          {new Date(
                            `${t.due_date}T00:00:00`
                          ).toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-white">
                        {formatCurrency(Number(t.amount))}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black uppercase ${statusClass(t)}`}
                        >
                          {statusLabel(t)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={async () => {
                            setSelectedTransaction(t);
                            setIsDetailModalOpen(true);
                            await fetchInteractionDetails(t.id);
                          }}
                          className="text-text-secondary transition-all hover:text-white"
                          aria-label="Ver detalhes"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-surface/50 px-6 py-4">
              <p className="text-xs text-text-secondary">
                {baseRows.length} registros · Página {currentPage} de{" "}
                {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 rounded-md border border-surface px-3 py-1.5 text-xs font-bold text-white hover:bg-background disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-surface px-3 py-1.5 text-xs font-bold text-white hover:bg-background disabled:opacity-40"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="relative space-y-6 pb-12">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] flex max-w-[92vw] items-center gap-3 rounded-lg border bg-[#1a1413] px-6 py-4 shadow-2xl ${
            toast.type === "success"
              ? "border-cs-green text-cs-green"
              : toast.type === "warning"
              ? "border-cs-gold text-cs-gold"
              : "border-red-500 text-red-500"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-surface/50 bg-surface p-6 shadow-lg md:flex-row md:items-center">
        <div>
          <h3 className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter text-white">
            <Wallet className="text-cs-green" size={28} /> {L.hub}
          </h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {(companyProfile?.company_name as string) || "ARXUM"} · Gestão
            Financeira
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsReguaOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-cs-gold/30 bg-cs-gold/10 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-cs-gold transition-all hover:bg-cs-gold/20"
          >
            <Bell size={15} /> Régua de Cobrança
          </button>
          {view === "list" && (
            <button
              onClick={() => openCreateForTab(activeTab)}
              className="flex items-center gap-2 rounded-md bg-cs-green px-8 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-opacity-90"
            >
              <Plus size={18} /> Novo {L.transacao}
            </button>
          )}
        </div>
      </div>

      {view === "list" && (
        <>
          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto border-b border-surface/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-6 py-4 text-xs font-black uppercase tracking-wide transition-all ${
                  activeTab === tab.id
                    ? "border-cs-green text-cs-green"
                    : "border-transparent text-text-secondary hover:text-white"
                }`}
              >
                <tab.icon size={13} /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "dashboard" && (
            <div className="animate-in fade-in space-y-6 duration-500">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {renderMetricCard(
                  "Saldo realizado",
                  formatCurrency(stats.balance),
                  stats.balance >= 0 ? "green" : "red"
                )}
                {renderMetricCard(
                  `${L.receber} pendente`,
                  formatCurrency(stats.pendingIn),
                  "green"
                )}
                {renderMetricCard(
                  "Aguardando financeiro",
                  formatCurrency(stats.waitingFinance),
                  "gold"
                )}
                {renderMetricCard(
                  "Contestação em aberto",
                  formatCurrency(stats.disputedOpen),
                  "orange"
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {renderMetricCard(
                  "Inadimplência real",
                  formatCurrency(stats.overdueIn),
                  "red"
                )}
                {renderMetricCard(
                  "Pago no mês",
                  formatCurrency(stats.paidThisMonth),
                  "green"
                )}
                {renderMetricCard(
                  "Despesas pagas",
                  formatCurrency(stats.expensePaid),
                  "red"
                )}
                {renderMetricCard(
                  "Folha + comissão",
                  formatCurrency(stats.peopleCost),
                  "gold"
                )}
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-surface/50 bg-surface p-6">
                  <h4 className="mb-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
                    <TrendingUp size={16} className="text-cs-gold" /> Projeção
                    de {L.receber}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {
                        label: "Vencidos",
                        val: stats.overdueIn,
                        color: "bg-red-500",
                      },
                      {
                        label: "Próx. 7 dias",
                        val: stats.pendingIn * 0.4,
                        color: "bg-cs-gold",
                      },
                      {
                        label: "15–30 dias",
                        val: stats.pendingIn * 0.3,
                        color: "bg-blue-500",
                      },
                      {
                        label: "30+ dias",
                        val: stats.pendingIn * 0.3,
                        color: "bg-cs-green",
                      },
                    ].map((b) => (
                      <div key={b.label} className="space-y-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                          <div
                            className={`h-full ${b.color} transition-all`}
                            style={{
                              width: `${Math.min(
                                (b.val / (stats.pendingIn || 1)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-[9px] font-black uppercase text-text-secondary">
                          {b.label}
                        </p>
                        <p className="break-words text-sm font-bold text-white">
                          {formatCurrency(b.val)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-surface/50 bg-surface p-6">
                  <h4 className="mb-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
                    <PieChart size={16} className="text-cs-gold" /> Centro de
                    Custos
                  </h4>
                  {expenseByCategory.length === 0 ? (
                    <p className="py-8 text-center text-xs font-black uppercase text-text-secondary">
                      Sem despesas efetivadas.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {expenseByCategory.map((item, i) => (
                        <div key={item.cat} className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="max-w-[65%] truncate text-xs font-semibold uppercase text-text-secondary">
                              {item.cat}
                            </span>
                            <span className="text-xs font-black text-white">
                              {formatCurrency(item.val)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                            <div
                              className={`h-full ${
                                CHART_COLORS[i % CHART_COLORS.length]
                              } transition-all`}
                              style={{
                                width: `${
                                  (item.val / (totalExpenses || 1)) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between gap-3 border-t border-surface/50 pt-2">
                        <span className="text-xs font-bold uppercase text-text-secondary">
                          Total Despesas
                        </span>
                        <span className="text-xs font-black text-red-400">
                          {formatCurrency(totalExpenses)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "receber" && renderTable("income")}
          {activeTab === "pagar_admin" &&
            renderTable("expense", "administrative")}
          {activeTab === "pagar_operacional" &&
            renderTable("expense", "operational")}

          {activeTab === "pessoal" && (
            <div className="animate-in fade-in space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-surface/50 bg-surface p-6">
                  <div>
                    <p className="text-xs font-bold uppercase text-text-secondary">
                      {L.salario}s Pagos
                    </p>
                    <p className="break-words text-2xl font-black text-white">
                      {formatCurrency(personnelStats.totalSalaries)}
                    </p>
                  </div>
                  <UserCheck className="text-cs-green opacity-20" size={48} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-surface/50 bg-surface p-6">
                  <div>
                    <p className="text-xs font-bold uppercase text-text-secondary">
                      {L.comissao} Pagas
                    </p>
                    <p className="break-words text-2xl font-black text-cs-gold">
                      {formatCurrency(personnelStats.totalCommissions)}
                    </p>
                  </div>
                  <Percent className="text-cs-gold opacity-20" size={48} />
                </div>
              </div>
              {personnelStats.totalRH > 0 && (
                <div className="rounded-xl border border-surface/50 bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="mb-1 text-xs font-black uppercase text-text-secondary">
                        Centro de Custo RH
                      </p>
                      <p className="break-words text-2xl font-black text-cs-gold">
                        {formatCurrency(personnelStats.totalRH)}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        Folha de Pagamento · Reembolsos RH · Descontos RH
                      </p>
                    </div>
                    <Users className="text-cs-gold opacity-20" size={48} />
                  </div>
                </div>
              )}
              {personnelStats.commissionByMember.length > 0 && (
                <div className="rounded-xl border border-surface/50 bg-surface p-6">
                  <h4 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
                    <BarChart3 size={16} className="text-cs-gold" /> Ranking de{" "}
                    {L.comissao} por {L.colaborador}
                  </h4>
                  <div className="space-y-3">
                    {personnelStats.commissionByMember.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-4">
                        <span className="w-5 text-right text-xs font-bold text-text-secondary">
                          {i + 1}.
                        </span>
                        <div className="flex-1">
                          <div className="mb-1 flex justify-between gap-3">
                            <span className="text-xs font-bold text-white">
                              {m.name}
                            </span>
                            <span className="text-xs font-black text-cs-gold">
                              {formatCurrency(m.total)}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-background">
                            <div
                              className="h-full bg-cs-gold transition-all"
                              style={{
                                width: `${
                                  (m.total /
                                    (personnelStats.commissionByMember[0]
                                      ?.total || 1)) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {renderTable("expense", "personnel")}
            </div>
          )}

          {activeTab === "clientes" && (
            <div className="animate-in fade-in overflow-hidden rounded-lg border border-surface/50 bg-surface shadow-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-background/50 text-xs font-black uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-8 py-5">{L.cliente}</th>
                    <th className="px-8 py-5">LTV (Total Pago)</th>
                    <th className="px-8 py-5">Saldo Devedor</th>
                    <th className="px-8 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface/50">
                  {clientSummary.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-8 py-10 text-center text-xs font-black uppercase tracking-widest text-text-secondary"
                      >
                        Nenhum {L.cliente} com movimentação financeira.
                      </td>
                    </tr>
                  ) : (
                    clientSummary.map((c) => (
                      <tr
                        key={c.id}
                        className="group transition-colors hover:bg-background/40"
                      >
                        <td className="px-8 py-6 font-black uppercase tracking-tight text-white">
                          {c.company_name}
                        </td>
                        <td className="px-8 py-6 font-bold text-cs-green">
                          {formatCurrency(c.ltv)}
                        </td>
                        <td className="px-8 py-6 font-bold text-red-400">
                          {formatCurrency(c.debt)}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => {
                              setSearchTerm(c.company_name);
                              setActiveTab("receber");
                            }}
                            className="text-xs font-bold uppercase text-cs-gold hover:underline"
                          >
                            Ver Extrato
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "dre" && (
            <div className="animate-in fade-in space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">
                    Demonstrativo de Resultado (DRE)
                  </h3>
                  <p className="mt-1 text-xs uppercase tracking-wide text-text-secondary">
                    Apenas lançamentos efetivados (pagos/recebidos/confirmados)
                  </p>
                </div>
                <button
                  onClick={exportDRE}
                  className="inline-flex items-center gap-2 rounded-md border border-cs-green/30 bg-cs-green/10 px-5 py-2.5 text-xs font-black uppercase text-cs-green transition-all hover:bg-cs-green/20"
                >
                  <Download size={14} /> Exportar CSV
                </button>
              </div>

              {dreByMonth.length === 0 ? (
                <div className="rounded-xl border border-surface/50 bg-surface p-10 text-center text-sm text-text-secondary">
                  Nenhum lançamento efetivado registrado ainda.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-surface/50 bg-surface shadow-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-background/50 text-xs font-black uppercase tracking-wide text-text-secondary">
                      <tr>
                        <th className="px-6 py-4">Mês / Ano</th>
                        <th className="px-6 py-4 text-cs-green">Receitas</th>
                        <th className="px-6 py-4 text-red-400">Despesas</th>
                        <th className="px-6 py-4">Resultado</th>
                        <th className="px-6 py-4 text-text-secondary">
                          Acumulado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface/50">
                      {dreByMonth.map((m) => (
                        <tr
                          key={m.key}
                          className="transition-colors hover:bg-background/40"
                        >
                          <td className="px-6 py-4 font-bold capitalize text-white">
                            {m.month} {m.year}
                          </td>
                          <td className="px-6 py-4 font-bold text-cs-green">
                            {formatCurrency(m.income)}
                          </td>
                          <td className="px-6 py-4 font-bold text-red-400">
                            {formatCurrency(m.expense)}
                          </td>
                          <td
                            className={`px-6 py-4 font-black ${
                              m.balance >= 0 ? "text-cs-green" : "text-red-500"
                            }`}
                          >
                            {m.balance >= 0 ? "+" : ""}
                            {formatCurrency(m.balance)}
                          </td>
                          <td
                            className={`px-6 py-4 font-bold ${
                              m.cumulative >= 0
                                ? "text-zinc-300"
                                : "text-red-400"
                            }`}
                          >
                            {formatCurrency(m.cumulative)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-surface/50 bg-background/50">
                      <tr>
                        <td className="px-6 py-4 text-xs font-black uppercase tracking-wide text-text-secondary">
                          Total
                        </td>
                        <td className="px-6 py-4 font-black text-cs-green">
                          {formatCurrency(
                            dreByMonth.reduce((a, m) => a + m.income, 0)
                          )}
                        </td>
                        <td className="px-6 py-4 font-black text-red-400">
                          {formatCurrency(
                            dreByMonth.reduce((a, m) => a + m.expense, 0)
                          )}
                        </td>
                        <td
                          className={`px-6 py-4 font-black ${
                            dreByMonth.reduce((a, m) => a + m.balance, 0) >= 0
                              ? "text-cs-green"
                              : "text-red-500"
                          }`}
                        >
                          {formatCurrency(
                            dreByMonth.reduce((a, m) => a + m.balance, 0)
                          )}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Create/Edit form ─────────────────────────────────────────────── */}
      {view === "create" && (
        <div className="mx-auto max-w-5xl space-y-6">
          <button
            onClick={() => {
              resetForm();
              setView("list");
            }}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-secondary transition-all hover:text-white"
          >
            <ArrowLeft size={16} /> Voltar ao Fluxo
          </button>
          <div className="rounded-xl border border-surface/50 bg-surface p-8 shadow-2xl">
            <h2 className="mb-8 border-b border-surface/50 pb-4 text-2xl font-black uppercase tracking-tighter text-white">
              {editId ? `Ajustar ${L.transacao}` : `Novo ${L.transacao}`}
            </h2>
            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-4">
                <div className="flex w-fit gap-2 rounded-lg border border-surface/50 bg-background p-1">
                  <button
                    type="button"
                    onClick={() => setFormType("income")}
                    className={`rounded px-8 py-2 text-xs font-black uppercase transition-all ${
                      formType === "income"
                        ? "bg-cs-green text-white shadow-lg"
                        : "text-text-secondary"
                    }`}
                  >
                    {L.receita}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("expense")}
                    className={`rounded px-8 py-2 text-xs font-black uppercase transition-all ${
                      formType === "expense"
                        ? "bg-red-500 text-white shadow-lg"
                        : "text-text-secondary"
                    }`}
                  >
                    {L.despesa}
                  </button>
                </div>
                {formType === "expense" && (
                  <div className="flex gap-2">
                    {(
                      [
                        { id: "administrative", label: L.pagarAdmin },
                        { id: "operational", label: L.pagarOp },
                        { id: "personnel", label: L.pessoal },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setExpenseType(opt.id)}
                        className={`flex-1 rounded border border-surface py-2 text-xs font-black uppercase transition-all ${
                          expenseType === opt.id
                            ? "bg-white text-black"
                            : "text-text-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                <div className="space-y-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                      Descrição *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.description}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cs-green"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Valor ({currencyCode}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.amount}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, amount: e.target.value }))
                        }
                        className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cs-green"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Vencimento *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.dueDate}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, dueDate: e.target.value }))
                        }
                        className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cs-green"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                      Categoria
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, category: e.target.value }))
                      }
                      className="w-full rounded-md border border-surface bg-background px-4 py-3 text-sm text-white outline-none transition-all focus:border-cs-green"
                    >
                      <option value="">Selecionar...</option>
                      {currentCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            status: e.target.value as
                              | "pending"
                              | "paid"
                              | "cancelled",
                          }))
                        }
                        className="w-full rounded-md border border-surface bg-background px-4 py-3 text-sm text-white outline-none transition-all focus:border-cs-green"
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago / Efetivado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Método
                      </label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            paymentMethod: e.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-surface bg-background px-4 py-3 text-sm text-white outline-none transition-all focus:border-cs-green"
                      >
                        <option value="pix">PIX</option>
                        <option value="boleto">Boleto</option>
                        <option value="transfer">TED / DOC</option>
                        <option value="credit_card">Cartão</option>
                        <option value="cash">Espécie</option>
                      </select>
                    </div>
                  </div>
                  {formData.status === "paid" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Data do Pagamento
                      </label>
                      <input
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            paymentDate: e.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cs-green"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {formType === "income" && (
                    <div className="relative">
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Vincular {L.cliente}
                      </label>
                      <div className="relative">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                          size={14}
                        />
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            if (!e.target.value)
                              setForm((p) => ({ ...p, clientId: "" }));
                          }}
                          placeholder={`Pesquisar ${L.cliente}...`}
                          className="w-full rounded-md border border-surface bg-background py-2.5 pl-9 pr-4 text-sm text-white outline-none transition-all focus:border-cs-green"
                        />
                      </div>
                      {clientSearch &&
                        filteredClientsList.length > 0 &&
                        !formData.clientId && (
                          <div className="absolute z-50 mt-1 w-full rounded-md border border-surface/50 bg-surface shadow-2xl">
                            {filteredClientsList.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setForm((p) => ({ ...p, clientId: c.id }));
                                  setClientSearch(c.company_name);
                                }}
                                className="w-full border-b border-surface/50 px-4 py-2 text-left text-xs text-white last:border-0 hover:bg-cs-green/20"
                              >
                                {c.company_name}
                              </button>
                            ))}
                          </div>
                        )}
                      {formData.clientId && (
                        <p className="mt-1 text-xs font-semibold text-cs-green">
                          ✓ {L.cliente} vinculado
                        </p>
                      )}
                    </div>
                  )}

                  {(formType === "income" ||
                    (formType === "expense" &&
                      expenseType === "operational")) && (
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Centro de Custos ({L.os})
                      </label>
                      <select
                        value={formData.serviceOrderId}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            serviceOrderId: e.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-surface bg-background px-4 py-3 text-sm text-white outline-none transition-all focus:border-cs-green"
                      >
                        <option value="">Geral / Sem {L.os}</option>
                        {approvedQuotes.map((q) => (
                          <option key={q.id} value={q.id}>
                            {L.orcamento}: {q.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formType === "expense" && expenseType === "personnel" && (
                    <>
                      <div className="relative">
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                          {L.colaborador}
                        </label>
                        <div className="relative">
                          <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                            size={14}
                          />
                          <input
                            type="text"
                            value={memberSearch}
                            onChange={(e) => {
                              setMemberSearch(e.target.value);
                              if (!e.target.value)
                                setForm((p) => ({ ...p, memberId: "" }));
                            }}
                            placeholder={`Pesquisar ${L.colaborador}...`}
                            className="w-full rounded-md border border-surface bg-background py-2.5 pl-9 pr-4 text-sm text-white outline-none transition-all focus:border-cs-green"
                          />
                        </div>
                        {memberSearch &&
                          filteredTeamList.length > 0 &&
                          !formData.memberId && (
                            <div className="absolute z-50 mt-1 w-full rounded-md border border-surface/50 bg-surface shadow-2xl">
                              {filteredTeamList.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setForm((p) => ({
                                      ...p,
                                      memberId: m.id,
                                    }));
                                    setMemberSearch(m.full_name);
                                  }}
                                  className="w-full border-b border-surface/50 px-4 py-2 text-left text-xs text-white last:border-0 hover:bg-cs-gold/20"
                                >
                                  <span className="font-bold">
                                    {m.full_name}
                                  </span>
                                  {m.commission_percentage ? (
                                    <span className="ml-2 text-cs-gold">
                                      · {m.commission_percentage}%{" "}
                                      {L.comissao}
                                    </span>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          )}
                        {formData.memberId && (
                          <p className="mt-1 text-xs font-semibold text-cs-gold">
                            ✓ {L.colaborador} vinculado
                          </p>
                        )}
                      </div>

                      {formData.category.toLowerCase().includes("comiss") && (
                        <div className="space-y-3 rounded-lg border border-cs-gold/20 bg-cs-gold/5 p-4">
                          <p className="text-xs font-black uppercase tracking-widest text-cs-gold">
                            {L.comissao} de Venda
                          </p>
                          {formData.memberId &&
                            (() => {
                              const member = team.find(
                                (m) => m.id === formData.memberId
                              );
                              return member?.commission_percentage ? (
                                <p className="text-xs text-text-secondary">
                                  Taxa:{" "}
                                  <strong className="text-white">
                                    {member.commission_percentage}%
                                  </strong>
                                  {formData.amount ? (
                                    <>
                                      {" "}
                                      · Calculado:{" "}
                                      <strong className="text-cs-gold">
                                        {formatCurrency(
                                          (Number(formData.amount) *
                                            member.commission_percentage) /
                                            100
                                        )}
                                      </strong>
                                    </>
                                  ) : null}
                                </p>
                              ) : null;
                            })()}
                          <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                              Valor da {L.comissao} ({currencyCode})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Valor final a pagar..."
                              value={formData.commissionAmount}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  commissionAmount: e.target.value,
                                  amount: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cs-gold"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                      Comprovante / Anexo
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-surface/50 bg-surface py-3 text-xs font-black uppercase text-white transition-all hover:bg-background"
                    >
                      {uploading ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Upload size={14} />
                      )}
                      {formData.attachmentUrl ? "Trocar Arquivo" : "Fazer Upload"}
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                    />
                    {formData.attachmentUrl && (
                      <p className="mt-1 text-xs font-semibold text-cs-green">
                        ✓ Arquivo anexado
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-surface/50 pt-8">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-3 rounded-md bg-cs-green px-12 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:bg-opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  Finalizar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────── */}
      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-surface/50 bg-[#1a1413] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-surface/50 bg-background/50 p-6">
              <div className="min-w-0">
                <h2 className="mb-2 text-2xl font-black uppercase tracking-tighter text-white">
                  {selectedTransaction.description}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${
                      selectedTransaction.type === "income"
                        ? "border-cs-green/20 bg-cs-green/10 text-cs-green"
                        : "border-red-500/20 bg-red-500/10 text-red-500"
                    }`}
                  >
                    {selectedTransaction.type === "income"
                      ? L.receita
                      : L.despesa}
                  </span>
                  <span className="rounded-full border border-surface/50 bg-surface px-3 py-1 text-xs font-black uppercase text-text-secondary">
                    {selectedTransaction.category}
                  </span>
                  {selectedTransaction.document_number && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase text-zinc-300">
                      Doc: {selectedTransaction.document_number}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="rounded-full border border-surface/50 bg-surface p-2 text-text-secondary transition-colors hover:text-white"
                aria-label="Fechar (ESC)"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_430px]">
              {/* Left column */}
              <div className="max-h-[calc(94vh-110px)] space-y-6 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  {[
                    {
                      label: "Montante",
                      val: formatCurrency(Number(selectedTransaction.amount)),
                      color: "text-white",
                    },
                    {
                      label: "Vencimento",
                      val: formatDate(selectedTransaction.due_date),
                      color: "text-white",
                    },
                    {
                      label: "Status",
                      val: statusLabel(selectedTransaction),
                      color: statusClass(selectedTransaction).split(" ")[1],
                    },
                    {
                      label: "Workflow",
                      val: translateWorkflowStatus(
                        selectedTransaction.workflow_status
                      ),
                      color: "text-white",
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="rounded-lg border border-surface/50 bg-background p-4"
                    >
                      <p className="mb-1 text-[9px] font-black uppercase text-text-secondary">
                        {card.label}
                      </p>
                      <p
                        className={`break-words text-sm font-bold uppercase ${card.color}`}
                      >
                        {card.val}
                      </p>
                    </div>
                  ))}
                </div>

                {selectedTransaction.type === "income" && selectedPaymentInfo ? (
                  <section className="rounded-xl border border-cs-gold/20 bg-cs-gold/5 p-5">
                    <div className="flex items-center gap-2">
                      <Scale size={18} className="text-cs-gold" />
                      <h4 className="text-sm font-black uppercase tracking-widest text-white">
                        Conciliação do pagamento
                      </h4>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                      {[
                        {
                          label: "Valor da parcela",
                          val: formatCurrency(selectedPaymentInfo.expected),
                          color: "text-white",
                        },
                        {
                          label: "Valor informado",
                          val: formatCurrency(selectedPaymentInfo.reported),
                          color: "text-cs-gold",
                        },
                        {
                          label: "Diferença",
                          val: `${selectedPaymentInfo.difference >= 0 ? "+" : ""}${formatCurrency(selectedPaymentInfo.difference)}`,
                          color:
                            selectedPaymentInfo.difference === 0
                              ? "text-cs-green"
                              : selectedPaymentInfo.difference < 0
                              ? "text-orange-400"
                              : "text-blue-400",
                        },
                        {
                          label: "Classificação",
                          val: selectedPaymentInfo.label,
                          color: "text-white",
                        },
                      ].map((card) => (
                        <div
                          key={card.label}
                          className="rounded-lg border border-white/10 bg-background/40 p-4"
                        >
                          <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">
                            {card.label}
                          </p>
                          <p
                            className={`mt-2 text-sm font-black uppercase ${card.color}`}
                          >
                            {card.val}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-sm text-zinc-200">
                      {selectedPaymentInfo.helper}
                    </p>
                    {receivableForGroup.length > 1 && (
                      <div className="mt-4 rounded-lg border border-white/10 bg-background/30 p-4">
                        <div className="flex items-center gap-2">
                          <Clock3 size={16} className="text-cs-gold" />
                          <p className="text-xs font-black uppercase tracking-widest text-text-secondary">
                            Grupo de cobranças relacionadas
                          </p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {receivableForGroup.map((row) => (
                            <div
                              key={row.id}
                              className={`flex flex-col gap-2 rounded-lg border px-3 py-3 md:flex-row md:items-center md:justify-between ${
                                row.id === selectedTransaction.id
                                  ? "border-cs-gold/30 bg-cs-gold/5"
                                  : "border-white/10 bg-background/40"
                              }`}
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  Parcela{" "}
                                  {row.installment_number || 1}/
                                  {row.total_installments ||
                                    receivableForGroup.length}
                                  {row.id === selectedTransaction.id && (
                                    <span className="ml-2 text-[10px] font-black uppercase text-cs-gold">
                                      ← atual
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs uppercase tracking-wide text-text-secondary">
                                  Venc. {formatDate(row.due_date)} ·{" "}
                                  {statusLabel(row)}
                                </p>
                              </div>
                              <div className="text-sm font-black text-white">
                                {formatCurrency(Number(row.amount))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                ) : null}

                {/* Resumo financeiro */}
                <section className="rounded-xl border border-surface/50 bg-background/40 p-5">
                  <h4 className="border-b border-surface/50 pb-3 text-xs font-black uppercase tracking-widest text-white">
                    Resumo financeiro
                  </h4>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[
                      {
                        label: "Cliente",
                        val: selectedTransaction.clients?.company_name || "-",
                      },
                      {
                        label: "Pagamento informado",
                        val: formatDateTime(
                          selectedTransaction.payment_reported_at
                        ),
                      },
                      {
                        label: "Valor informado",
                        val:
                          selectedTransaction.payment_reported_amount != null
                            ? formatCurrency(
                                Number(
                                  selectedTransaction.payment_reported_amount
                                )
                              )
                            : "-",
                      },
                      {
                        label: "Forma informada",
                        val:
                          selectedTransaction.payment_reported_method ||
                          selectedTransaction.payment_method ||
                          "-",
                      },
                      {
                        label: "Referência",
                        val:
                          selectedTransaction.payment_reported_reference || "-",
                      },
                      {
                        label: "Pagamento confirmado",
                        val: formatDateTime(
                          selectedTransaction.payment_confirmed_at
                        ),
                      },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm text-white">{item.val}</p>
                      </div>
                    ))}
                    {selectedTransaction.type === "income" && (
                      <>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">
                            Categoria contestação
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {translateDisputeCategory(
                              selectedTransaction.dispute_category
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">
                            Motivo contestação
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {selectedTransaction.dispute_reason || "-"}
                          </p>
                        </div>
                      </>
                    )}
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">
                        Retorno / resolução do financeiro
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {selectedTransaction.resolution_notes || "-"}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Histórico */}
                <section className="rounded-xl border border-surface/50 bg-background/40 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-white">
                      Histórico da cobrança
                    </h4>
                    {detailLoading ? (
                      <Loader2
                        className="animate-spin text-cs-gold"
                        size={18}
                      />
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {events.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        Nenhuma interação registrada.
                      </p>
                    ) : (
                      events.map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-xl border p-4 ${
                            event.author_type === "finance" ||
                            event.author_type === "system"
                              ? "border-blue-500/20 bg-blue-500/5"
                              : "border-surface/50 bg-surface"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-white">
                              {event.title ||
                                translateEventType(event.event_type)}
                            </p>
                            <span className="text-xs text-text-secondary">
                              {formatDateTime(event.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-wider text-text-secondary">
                            {event.author_type === "client"
                              ? "Cliente"
                              : event.author_type === "finance"
                              ? "Financeiro"
                              : "Sistema"}{" "}
                            ·{" "}
                            {event.visibility === "shared"
                              ? "Compartilhado"
                              : "Interno"}
                          </p>
                          <p className="mt-3 text-sm text-zinc-200">
                            {event.message || "-"}
                          </p>
                          {event.metadata &&
                            Object.keys(event.metadata).length > 0 && (
                              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                {Object.entries(event.metadata).map(
                                  ([key, value]) => (
                                    <div
                                      key={key}
                                      className="rounded-lg border border-surface/40 bg-background/30 px-3 py-2 text-xs text-text-secondary"
                                    >
                                      <span className="block uppercase tracking-wider">
                                        {key.replaceAll("_", " ")}
                                      </span>
                                      <span className="mt-1 block text-white">
                                        {String(value ?? "-")}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Anexos */}
                <section className="rounded-xl border border-surface/50 bg-background/40 p-5">
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">
                    Anexos
                  </h4>
                  <div className="mt-4 space-y-3">
                    {attachments.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        Nenhum anexo disponível.
                      </p>
                    ) : (
                      attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex flex-col gap-3 rounded-xl border border-surface/50 bg-surface p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              {file.file_name}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-wider text-text-secondary">
                              {file.attachment_type} ·{" "}
                              {file.uploaded_by_type === "client"
                                ? "Cliente"
                                : file.uploaded_by_type === "finance"
                                ? "Financeiro"
                                : "Sistema"}{" "}
                              · {formatDateTime(file.created_at)}
                            </p>
                          </div>
                          {signedUrls[file.id] ? (
                            <a
                              href={signedUrls[file.id]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-surface/50 bg-background px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-background/70"
                            >
                              <Paperclip size={16} /> Abrir
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-lg border border-surface/50 bg-background px-4 py-2 text-sm font-semibold text-text-secondary">
                              <Loader2 className="animate-spin" size={16} />{" "}
                              Carregando
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Ações rápidas */}
                <section className="rounded-xl border border-surface/50 bg-background/40 p-5">
                  <h4 className="border-b border-surface/50 pb-3 text-xs font-black uppercase tracking-widest text-white">
                    Ações rápidas
                  </h4>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {selectedTransaction.type === "income" ? (
                      <>
                        <button
                          onClick={() => sendWhatsApp(selectedTransaction)}
                          className="flex items-center justify-center gap-2 rounded-md border border-cs-green/20 bg-cs-green/10 py-3 text-xs font-black uppercase text-cs-green transition-all hover:bg-cs-green/20"
                        >
                          <MessageCircle size={16} /> WhatsApp
                        </button>
                        <button
                          onClick={() => sendInvoiceEmail(selectedTransaction)}
                          disabled={isSendingMail}
                          className="flex items-center justify-center gap-2 rounded-md border border-blue-500/20 bg-blue-500/10 py-3 text-xs font-black uppercase text-blue-400 transition-all hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          {isSendingMail ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Mail size={16} />
                          )}{" "}
                          E-mail
                        </button>
                        <button
                          onClick={() =>
                            router.push(
                              `/financeiro/fatura/${selectedTransaction.id}`
                            )
                          }
                          className="flex items-center justify-center gap-2 rounded-md border border-surface/50 bg-surface py-3 text-xs font-black uppercase text-white transition-all hover:bg-background"
                        >
                          <Receipt size={16} /> Gerar Fatura PDF
                        </button>
                      </>
                    ) : (
                      <div className="text-sm text-text-secondary md:col-span-3">
                        Ações rápidas disponíveis apenas para cobranças a
                        receber.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right sidebar — finance actions */}
              <aside className="max-h-[calc(94vh-110px)] space-y-5 overflow-y-auto border-l border-surface/50 bg-background/30 p-6">
                <section className="rounded-xl border border-cs-gold/20 bg-cs-gold/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                    <ShieldAlert size={16} className="text-cs-gold" />
                    Atendimento financeiro
                  </h4>
                  <p className="mt-2 text-xs uppercase tracking-wide text-text-secondary">
                    Registre comentário, confirme, rejeite ou resolva.
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Comentário do financeiro
                      </label>
                      <textarea
                        value={financeActionForm.comment}
                        onChange={(e) =>
                          setFinanceActionForm((prev) => ({
                            ...prev,
                            comment: e.target.value,
                          }))
                        }
                        className="min-h-[110px] w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-gold"
                        placeholder="Retorno claro para o cliente ou histórico interno."
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Tipo de resolução
                      </label>
                      <select
                        value={financeActionForm.resolutionType}
                        onChange={(e) =>
                          setFinanceActionForm((prev) => ({
                            ...prev,
                            resolutionType: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-gold"
                      >
                        <option value="payment_confirmed">
                          Pagamento confirmado
                        </option>
                        <option value="charge_corrected">
                          Cobrança corrigida
                        </option>
                        <option value="dispute_rejected">
                          Cobrança mantida (contestação rejeitada)
                        </option>
                        <option value="charge_cancelled">
                          Cobrança cancelada
                        </option>
                        <option value="written_off">
                          Baixa por perda
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Observação de resolução
                      </label>
                      <textarea
                        value={financeActionForm.resolutionNotes}
                        onChange={(e) =>
                          setFinanceActionForm((prev) => ({
                            ...prev,
                            resolutionNotes: e.target.value,
                          }))
                        }
                        className="min-h-[90px] w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-gold"
                        placeholder="Explique a decisão tomada."
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-secondary">
                        Anexo do financeiro
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          financeAttachmentInputRef.current?.click()
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-surface bg-background px-4 py-3 text-sm font-semibold text-white transition-all hover:border-cs-gold"
                      >
                        <Upload size={16} />
                        {financeAttachmentFile
                          ? financeAttachmentFile.name
                          : "Selecionar arquivo"}
                      </button>
                      <input
                        ref={financeAttachmentInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) =>
                          setFinanceAttachmentFile(
                            e.target.files?.[0] || null
                          )
                        }
                      />
                    </div>
                  </div>
                </section>

                {selectedTransaction.type === "income" && selectedPaymentInfo ? (
                  <section className="space-y-3 rounded-xl border border-white/10 bg-surface p-4">
                    <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
                      <Scale size={15} className="text-cs-gold" />
                      Decisão de conciliação
                    </h5>
                    <div className="rounded-lg border border-white/10 bg-background/40 p-3 text-sm text-zinc-200">
                      {selectedPaymentInfo.label}:{" "}
                      {selectedPaymentInfo.helper}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddFinanceComment}
                      disabled={actionSubmitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
                    >
                      {actionSubmitting ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <FileText size={18} />
                      )}
                      Registrar comentário
                    </button>

                    {(selectedTransaction.workflow_status ===
                      "awaiting_finance" ||
                      selectedTransaction.workflow_status ===
                        "under_review") && (
                      <>
                        <button
                          type="button"
                          onClick={handleConfirmPayment}
                          disabled={actionSubmitting}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cs-green px-4 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-50"
                        >
                          {actionSubmitting ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <CheckCheck size={18} />
                          )}
                          {selectedPaymentInfo.scenario === "partial"
                            ? "Registrar parcial e manter saldo"
                            : "Confirmar pagamento e dar baixa"}
                        </button>

                        <button
                          type="button"
                          onClick={handleRejectPayment}
                          disabled={actionSubmitting}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-red-500 disabled:opacity-50"
                        >
                          {actionSubmitting ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <X size={18} />
                          )}
                          Rejeitar pagamento informado
                        </button>
                      </>
                    )}

                    {selectedPaymentInfo.scenario === "over" &&
                      receivableForGroup.filter(
                        (r) =>
                          r.id !== selectedTransaction.id &&
                          r.status === "pending"
                      ).length > 0 && (
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
                          <p className="text-xs font-black uppercase tracking-wide text-blue-300">
                            Conciliação automática disponível
                          </p>
                          <p className="text-xs text-zinc-400">
                            Excedente de{" "}
                            {formatCurrency(selectedPaymentInfo.difference)}{" "}
                            pode ser distribuído automaticamente para as{" "}
                            {
                              receivableForGroup.filter(
                                (r) =>
                                  r.id !== selectedTransaction.id &&
                                  r.status === "pending"
                              ).length
                            }{" "}
                            parcela(s) abertas do grupo.
                          </p>
                          <button
                            type="button"
                            onClick={handleAutoDistribute}
                            disabled={actionSubmitting}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/15 px-4 py-3 text-sm font-bold text-blue-300 hover:bg-blue-500/25 disabled:opacity-50"
                          >
                            {actionSubmitting ? (
                              <Loader2 className="animate-spin" size={18} />
                            ) : (
                              <Layers size={18} />
                            )}
                            Distribuir excedente automaticamente
                          </button>
                        </div>
                      )}
                  </section>
                ) : (
                  <section className="rounded-xl border border-white/10 bg-surface p-4">
                    <button
                      type="button"
                      onClick={handleAddFinanceComment}
                      disabled={actionSubmitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
                    >
                      {actionSubmitting ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <FileText size={18} />
                      )}
                      Registrar comentário
                    </button>
                  </section>
                )}

                {selectedTransaction.type === "income" &&
                  selectedTransaction.dispute_status &&
                  selectedTransaction.dispute_status !== "resolved" &&
                  selectedTransaction.dispute_status !== "none" && (
                    <section className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                      <h5 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
                        <AlertTriangle size={15} className="text-orange-400" />
                        Contestação
                      </h5>
                      <button
                        type="button"
                        onClick={handleResolveDispute}
                        disabled={actionSubmitting}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-50"
                      >
                        {actionSubmitting ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <ShieldAlert size={18} />
                        )}
                        Resolver contestação
                      </button>
                    </section>
                  )}

                <section className="rounded-xl border border-surface/50 bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() =>
                        setConfirmDeleteId(selectedTransaction.id)
                      }
                      className="flex items-center gap-2 text-xs font-black uppercase text-red-500 transition-colors hover:text-red-400"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEditForm(selectedTransaction)}
                        className="rounded-md border border-surface/50 bg-background px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-surface/80"
                      >
                        Editar
                      </button>
                      {selectedTransaction.status === "pending" &&
                        selectedTransaction.type === "expense" && (
                          <button
                            onClick={() =>
                              updateStatus(selectedTransaction.id, "paid")
                            }
                            className="rounded-md bg-cs-green px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-opacity-90"
                          >
                            Dar baixa manual
                          </button>
                        )}
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* ── Régua de cobrança modal ───────────────────────────────────────── */}
      {isReguaOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-cs-gold/30 bg-[#1a1413] shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface/50 bg-background/50 p-6">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-white">
                  <Bell size={20} className="text-cs-gold" /> Régua de Cobrança
                </h3>
                <p className="mt-1 text-xs uppercase tracking-wide text-text-secondary">
                  Mensagens automáticas por WhatsApp para cobranças pendentes
                </p>
              </div>
              <button
                onClick={() => setIsReguaOpen(false)}
                className="text-text-secondary hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
              {(
                [
                  {
                    key: "enableMinus3",
                    msgKey: "messageMinus3",
                    label: "D-3 — 3 dias antes do vencimento",
                    color: "text-blue-400",
                  },
                  {
                    key: "enableD0",
                    msgKey: "messageD0",
                    label: "D0 — No dia do vencimento",
                    color: "text-cs-gold",
                  },
                  {
                    key: "enablePlus5",
                    msgKey: "messagePlus5",
                    label: "D+5 — 5 dias após o vencimento",
                    color: "text-red-400",
                  },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-surface/50 bg-surface p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={item.key}
                      checked={reguaConfig[item.key]}
                      onChange={(e) =>
                        setReguaConfig((p) => ({
                          ...p,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="cursor-pointer accent-cs-gold"
                    />
                    <label
                      htmlFor={item.key}
                      className={`text-sm font-black uppercase tracking-wide cursor-pointer ${item.color}`}
                    >
                      {item.label}
                    </label>
                  </div>
                  {reguaConfig[item.key] && (
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-text-secondary">
                        Variáveis: {"{cliente}"}, {"{valor}"}, {"{data}"}
                      </p>
                      <textarea
                        value={reguaConfig[item.msgKey]}
                        onChange={(e) =>
                          setReguaConfig((p) => ({
                            ...p,
                            [item.msgKey]: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full resize-none rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-gold"
                      />
                    </div>
                  )}
                </div>
              ))}

              <div className="rounded-xl border border-cs-gold/20 bg-cs-gold/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-cs-gold">
                  Como funciona
                </p>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Ao clicar em "Executar régua agora", o sistema identifica
                  todas as cobranças pendentes cujo vencimento coincide com os
                  gatilhos ativados (hoje) e abre janelas do WhatsApp com as
                  mensagens formatadas. Nenhuma mensagem é enviada
                  automaticamente — você confirma cada uma.
                </p>
              </div>
            </div>

            <div className="flex gap-3 border-t border-surface/50 p-6">
              <button
                onClick={() => setIsReguaOpen(false)}
                className="flex-1 rounded-md border border-surface py-3 text-xs font-black uppercase text-text-secondary hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setReguaRunning(true);
                  await runRegua();
                  setReguaRunning(false);
                }}
                disabled={reguaRunning}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-cs-gold py-3 text-xs font-black uppercase text-black shadow-lg hover:opacity-90 disabled:opacity-50"
              >
                {reguaRunning ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Bell size={16} />
                )}
                Executar régua agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete modal ─────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-6 rounded-xl border border-surface/50 bg-[#1a1413] p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white">
              Remover Registro?
            </h3>
            <p className="text-sm font-medium text-text-secondary">
              Esta ação é irreversível e afetará os relatórios financeiros.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-md border border-surface py-3 text-xs font-black uppercase text-text-secondary transition-all hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteTransaction(confirmDeleteId)}
                className="flex-1 rounded-md bg-red-600 py-3 text-xs font-black uppercase text-white shadow-lg transition-all hover:bg-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}