"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  Wallet,
  Plus,
  Loader2,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  Save,
  Trash2,
  Search,
  Building,
  Eye,
  AlertTriangle,
  Upload,
  Download,
  Receipt,
  Mail,
  MessageCircle,
  Users,
  TrendingUp,
  UserCheck,
  Percent,
  BarChart3,
  PieChart,
  DollarSign,
  Zap,
  CheckCheck,
  ShieldAlert,
  FileText,
  Paperclip,
  RefreshCw,
  X,
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

type TabId =
  | "dashboard"
  | "receber"
  | "pagar_admin"
  | "pagar_operacional"
  | "pessoal"
  | "clientes";

const STORAGE_BUCKET = "files-main";

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

const isOverdue = (date: string, status: string) =>
  new Date(`${date}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0)) &&
  status === "pending";

const statusLabel = (t: Transaction) => {
  if (t.workflow_status === "confirmed") return "Confirmado";
  if (t.status === "paid" || t.status === "received") return "Pago";
  if (t.status === "cancelled") return "Cancelado";
  if (t.dispute_status && t.dispute_status !== "resolved") return "Contestação";
  if (t.workflow_status === "awaiting_finance") return "Aguardando financeiro";
  if (isOverdue(t.due_date, t.status || "pending")) return "Vencido";
  return "Pendente";
};

const statusClass = (t: Transaction) => {
  if (t.workflow_status === "confirmed" || t.status === "paid" || t.status === "received") {
    return "bg-cs-green/10 text-cs-green border-cs-green/20";
  }
  if (t.dispute_status && t.dispute_status !== "resolved") {
    return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  }
  if (t.workflow_status === "awaiting_finance" || t.workflow_status === "under_review") {
    return "bg-cs-gold/10 text-cs-gold border-cs-gold/20";
  }
  if (t.status === "cancelled") return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  if (isOverdue(t.due_date, t.status || "pending")) return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-white/5 text-zinc-300 border-white/10";
};

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

export default function FinanceiroPage() {
  const router = useRouter();
  const settingsCtx = useSettings() as unknown as {
    systemPreferences?: {
      custom_labels?: Record<string, string>;
      currency_code?: string;
      financial_categories?: { income?: string[]; expense?: string[] };
      primary_color?: string;
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

  const expenseAdminCategories = DEFAULT_EXPENSE_ADMIN_CATEGORIES;
  const expenseOpCategories = DEFAULT_EXPENSE_OPERATIONAL_CATEGORIES;
  const expensePersonnelCategories = DEFAULT_EXPENSE_PERSONNEL_CATEGORIES;

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
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [approvedQuotes, setApprovedQuotes] = useState<ApprovedQuote[]>([]);

  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [attachments, setAttachments] = useState<FinancialAttachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const financeAttachmentInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  const [formType, setFormType] = useState<"income" | "expense">("income");
  const [expenseType, setExpenseType] = useState<"administrative" | "personnel" | "operational">("administrative");
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
  const [financeAttachmentFile, setFinanceAttachmentFile] = useState<File | null>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  const formatCurrency = useCallback(
    (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: currencyCode }).format(v),
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

      const [tRes, cRes, qRes, pRes, soRes] = await Promise.all([
        supabase
          .from("financial_transactions")
          .select(
            `
              id,
              description,
              type,
              expense_type,
              category,
              amount,
              status,
              due_date,
              payment_date,
              service_order_id,
              client_id,
              member_id,
              attachment_url,
              payment_method,
              last_notified_at,
              invoice_hash,
              quote_id,
              installment_number,
              total_installments,
              source,
              invoice_notes,
              document_number,
              workflow_status,
              dispute_status,
              dispute_reason,
              dispute_category,
              customer_last_action_at,
              finance_last_action_at,
              last_interaction_at,
              payment_reported_amount,
              payment_reported_method,
              payment_reported_reference,
              payment_reported_at,
              payment_confirmed_at,
              resolution_type,
              resolution_notes,
              created_at,
              clients(*),
              member:profiles!member_id(id, full_name, email, role, commission_percentage),
              service_orders(id, quote_id, quotes(id, title, salesperson_id))
            `
          )
          .order("due_date", { ascending: true }),
        supabase.from("clients").select("id, company_name, email, phone").order("company_name"),
        supabase
          .from("quotes")
          .select("id, title, salesperson_id, final_amount, client_id")
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, email, role, commission_percentage")
          .order("full_name"),
        supabase
          .from("service_orders")
          .select("id, quote_id, quotes(id, title, salesperson_id)")
          .order("id", { ascending: false }),
      ]);

      const quotesData = (qRes.data ?? []) as unknown as ApprovedQuote[];
      if (qRes.data) setApprovedQuotes(quotesData);
      if (cRes.data) setClients(cRes.data as Client[]);
      if (pRes.data) setTeam(pRes.data as unknown as Profile[]);
      if (soRes.data) setServiceOrders(soRes.data as unknown as ServiceOrder[]);

      if (tRes.error) {
        throw tRes.error;
      }

      if (tRes.data) {
        const quotesMap = new Map(quotesData.map((q) => [q.id, q]));
        const merged = (tRes.data as unknown as Transaction[]).map((t) => ({
          ...t,
          quote: t.quote_id ? (quotesMap.get(t.quote_id) ?? undefined) : undefined,
        }));
        setTransactions(merged);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error(error);
      showToast("Erro ao sincronizar com a nuvem.", "error");
    } finally {
      setLoading(false);
    }
  }, [fetchCurrentUser, showToast]);

  const fetchInteractionDetails = useCallback(async (transactionId: string) => {
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
          .select("id, financial_transaction_id, author_id, author_type, visibility, event_type, title, message, metadata, created_at")
          .eq("financial_transaction_id", transactionId)
          .order("created_at", { ascending: false }),
        supabase
          .from("financial_transaction_attachments")
          .select("id, financial_transaction_id, event_id, uploaded_by, uploaded_by_type, visibility, attachment_type, file_name, file_path, file_url, mime_type, file_size, created_at")
          .eq("financial_transaction_id", transactionId)
          .order("created_at", { ascending: false }),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (attachmentsResult.error) throw attachmentsResult.error;

      setEvents((eventsResult.data || []) as FinancialEvent[]);
      setAttachments((attachmentsResult.data || []) as FinancialAttachment[]);
    } catch (error) {
      console.error(error);
      setEvents([]);
      setAttachments([]);
      showToast("Erro ao carregar histórico financeiro.", "error");
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

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

  useEffect(() => {
    const channel = supabase
      .channel("financeiro-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_transactions" },
        async () => {
          await fetchData();
          if (selectedTransaction?.id) {
            const latest = await supabase
              .from("financial_transactions")
              .select(
                `
                  id,
                  description,
                  type,
                  expense_type,
                  category,
                  amount,
                  status,
                  due_date,
                  payment_date,
                  service_order_id,
                  client_id,
                  member_id,
                  attachment_url,
                  payment_method,
                  last_notified_at,
                  invoice_hash,
                  quote_id,
                  installment_number,
                  total_installments,
                  source,
                  invoice_notes,
                  document_number,
                  workflow_status,
                  dispute_status,
                  dispute_reason,
                  dispute_category,
                  customer_last_action_at,
                  finance_last_action_at,
                  last_interaction_at,
                  payment_reported_amount,
                  payment_reported_method,
                  payment_reported_reference,
                  payment_reported_at,
                  payment_confirmed_at,
                  resolution_type,
                  resolution_notes,
                  created_at,
                  clients(*),
                  member:profiles!member_id(id, full_name, email, role, commission_percentage),
                  service_orders(id, quote_id, quotes(id, title, salesperson_id))
                `
              )
              .eq("id", selectedTransaction.id)
              .single();

            if (latest.data) {
              setSelectedTransaction(latest.data as unknown as Transaction);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_transaction_events" },
        async () => {
          if (selectedTransaction?.id && isDetailModalOpen) {
            await fetchInteractionDetails(selectedTransaction.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_transaction_attachments" },
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
  }, [fetchData, fetchInteractionDetails, isDetailModalOpen, selectedTransaction?.id]);

  const filteredClientsList = useMemo(
    () =>
      clients
        .filter((c) => c.company_name.toLowerCase().includes(clientSearch.toLowerCase()))
        .slice(0, 8),
    [clients, clientSearch]
  );

  const filteredTeamList = useMemo(
    () =>
      team
        .filter((t) => t.full_name?.toLowerCase().includes(memberSearch.toLowerCase()))
        .slice(0, 8),
    [team, memberSearch]
  );

  const stats = useMemo(() => {
    const paidIn = transactions
      .filter((t) => t.type === "income" && (t.status === "paid" || t.status === "received"))
      .reduce((a, b) => a + Number(b.amount), 0);
    const paidOut = transactions
      .filter((t) => t.type === "expense" && (t.status === "paid" || t.status === "received"))
      .reduce((a, b) => a + Number(b.amount), 0);
    const pendingIn = transactions
      .filter((t) => t.type === "income" && t.status === "pending")
      .reduce((a, b) => a + Number(b.amount), 0);
    const overdueIn = transactions
      .filter((t) => t.type === "income" && isOverdue(t.due_date, t.status || "pending"))
      .reduce((a, b) => a + Number(b.amount), 0);
    const waitingFinance = transactions
      .filter((t) => t.type === "income" && t.workflow_status === "awaiting_finance")
      .reduce((a, b) => a + Number(b.amount), 0);
    const disputedOpen = transactions
      .filter((t) => t.type === "income" && t.dispute_status && t.dispute_status !== "resolved")
      .reduce((a, b) => a + Number(b.amount), 0);

    return { balance: paidIn - paidOut, pendingIn, overdueIn, paidIn, paidOut, waitingFinance, disputedOpen };
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
          if (!byMember[t.member_id]) byMember[t.member_id] = { name: t.member.full_name, total: 0 };
          byMember[t.member_id].total += Number(t.amount);
        }
      });

    return {
      totalSalaries,
      totalCommissions,
      commissionByMember: Object.values(byMember).sort((a, b) => b.total - a.total),
    };
  }, [transactions, L]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense" && (t.status === "paid" || t.status === "received"))
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
          const ct = transactions.filter((t) => t.client_id === c.id && t.type === "income");
          const ltv = ct.filter((t) => t.status === "paid" || t.status === "received").reduce((a, b) => a + Number(b.amount), 0);
          const debt = ct.filter((t) => t.status === "pending").reduce((a, b) => a + Number(b.amount), 0);
          return { ...c, ltv, debt };
        })
        .filter((c) => c.ltv > 0 || c.debt > 0)
        .sort((a, b) => b.ltv - a.ltv),
    [clients, transactions]
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (t.category?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          (t.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
      ),
    [transactions, searchTerm]
  );

  const clientActionQueue = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === "income")
        .filter(
          (t) =>
            t.workflow_status === "awaiting_finance" ||
            t.workflow_status === "under_review" ||
            (t.dispute_status && t.dispute_status !== "resolved")
        )
        .sort((a, b) => {
          const dateA = new Date(a.last_interaction_at || a.payment_reported_at || a.due_date).getTime();
          const dateB = new Date(b.last_interaction_at || b.payment_reported_at || b.due_date).getTime();
          return dateB - dateA;
        }),
    [filteredTransactions]
  );

  const currentCategories = useMemo(() => {
    if (formType === "income") return incomeCategories;
    if (expenseType === "administrative") return expenseAdminCategories;
    if (expenseType === "operational") return expenseOpCategories;
    return expensePersonnelCategories;
  }, [formType, expenseType, incomeCategories]);

  const tabs = [
    { id: "dashboard" as TabId, label: "Visão Geral", icon: TrendingUp },
    { id: "receber" as TabId, label: L.receber, icon: ArrowUpRight },
    { id: "pagar_admin" as TabId, label: L.pagarAdmin, icon: DollarSign },
    { id: "pagar_operacional" as TabId, label: L.pagarOp, icon: Zap },
    { id: "pessoal" as TabId, label: L.pessoal, icon: Users },
    { id: "clientes" as TabId, label: L.clientes, icon: Building },
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

  const buildFinanceStoragePath = useCallback((file: File, transactionId: string) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const clientId = selectedTransaction?.client_id || formData.clientId || "internal";
    return `financial/${clientId}/${transactionId}/finance/${Date.now()}-${safeName}`;
  }, [formData.clientId, selectedTransaction?.client_id]);

  const uploadPrivateFile = useCallback(async (file: File, transactionId: string) => {
    const path = buildFinanceStoragePath(file, transactionId);
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) {
      throw new Error(error.message || "Erro no upload do arquivo.");
    }

    return {
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size || null,
    };
  }, [buildFinanceStoragePath]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const tempTransactionId = editId || crypto.randomUUID();
      const uploaded = await uploadPrivateFile(file, tempTransactionId);

      const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(uploaded.file_path, 3600);
      setForm((prev) => ({ ...prev, attachmentUrl: data?.signedUrl || uploaded.file_path }));
      showToast("Documento processado com sucesso.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Erro no upload.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.dueDate) {
      showToast("Preencha os campos obrigatórios.", "warning");
      return;
    }

    setIsSubmitting(true);

    const getCategoryForType = () => {
      if (formType === "income") return formData.category || incomeCategories[0] || "";
      if (expenseType === "administrative") return formData.category || expenseAdminCategories[0] || "";
      if (expenseType === "operational") return formData.category || expenseOpCategories[0] || "";
      return formData.category || expensePersonnelCategories[0] || "";
    };

    const hasServiceOrder = formType === "income" || expenseType === "operational";

    const payload: Record<string, unknown> = {
      description: formData.description,
      type: formType,
      expense_type: formType === "expense" ? expenseType : null,
      category: getCategoryForType(),
      amount: Number(formData.amount),
      status: formData.status,
      due_date: formData.dueDate,
      payment_date: formData.status === "paid" ? formData.paymentDate || new Date().toISOString().split("T")[0] : null,
      service_order_id: null,
      quote_id: hasServiceOrder ? formData.serviceOrderId || null : null,
      client_id: formType === "income" ? formData.clientId || null : null,
      member_id: expenseType === "personnel" && formType === "expense" ? formData.memberId || null : null,
      payment_method: formData.paymentMethod,
      attachment_url: formData.attachmentUrl || null,
    };

    const { error, data } = editId
      ? await supabase.from("financial_transactions").update(payload).eq("id", editId).select("id").single()
      : await supabase.from("financial_transactions").insert([payload]).select("id").single();

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
    const payload: Record<string, unknown> = { status: newStatus };
    payload.payment_date = newStatus === "paid" ? new Date().toISOString().split("T")[0] : null;

    const { error } = await supabase.from("financial_transactions").update(payload).eq("id", id);

    if (!error) {
      showToast("Status atualizado.", "success");
      await fetchData();
      setSelectedTransaction((prev) =>
        prev?.id === id ? { ...prev, status: newStatus as Transaction["status"] } : prev
      );
    } else {
      showToast(error.message, "error");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
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
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
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
        body: JSON.stringify({ transactionId: t.id, companyName: companyProfile?.company_name || "ARXUM" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar e-mail.");
      showToast("Cobrança disparada via e-mail.", "success");
      await fetchData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Erro ao enviar e-mail.", "error");
    } finally {
      setIsSendingMail(false);
    }
  };

  const resolveAttachmentUrls = useCallback(async () => {
    const pending = attachments.filter((file) => file.file_path && !signedUrls[file.id]);
    if (pending.length === 0) return;

    const nextMap: Record<string, string> = {};

    await Promise.all(
      pending.map(async (file) => {
        const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.file_path, 3600);
        if (data?.signedUrl) nextMap[file.id] = data.signedUrl;
      })
    );

    if (Object.keys(nextMap).length > 0) {
      setSignedUrls((prev) => ({ ...prev, ...nextMap }));
    }
  }, [attachments, signedUrls]);

  useEffect(() => {
    resolveAttachmentUrls();
  }, [resolveAttachmentUrls]);

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
    async (transactionId: string, eventId?: string | null, attachmentType = "finance_attachment") => {
      if (!financeAttachmentFile) return;

      const uploaded = await uploadPrivateFile(financeAttachmentFile, transactionId);
      const { error } = await supabase.from("financial_transaction_attachments").insert({
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

      if (error) throw new Error(error.message || "Erro ao salvar anexo do financeiro.");
    },
    [currentUserId, financeAttachmentFile, uploadPrivateFile]
  );

  const refreshSelectedTransaction = useCallback(async (transactionId: string) => {
    const { data } = await supabase
      .from("financial_transactions")
      .select(
        `
          id,
          description,
          type,
          expense_type,
          category,
          amount,
          status,
          due_date,
          payment_date,
          service_order_id,
          client_id,
          member_id,
          attachment_url,
          payment_method,
          last_notified_at,
          invoice_hash,
          quote_id,
          installment_number,
          total_installments,
          source,
          invoice_notes,
          document_number,
          workflow_status,
          dispute_status,
          dispute_reason,
          dispute_category,
          customer_last_action_at,
          finance_last_action_at,
          last_interaction_at,
          payment_reported_amount,
          payment_reported_method,
          payment_reported_reference,
          payment_reported_at,
          payment_confirmed_at,
          resolution_type,
          resolution_notes,
          created_at,
          clients(*),
          member:profiles!member_id(id, full_name, email, role, commission_percentage),
          service_orders(id, quote_id, quotes(id, title, salesperson_id))
        `
      )
      .eq("id", transactionId)
      .single();

    if (data) setSelectedTransaction(data as unknown as Transaction);
    await fetchInteractionDetails(transactionId);
  }, [fetchInteractionDetails]);

  const handleConfirmPayment = async () => {
    if (!selectedTransaction) return;
    setActionSubmitting(true);

    try {
      const now = new Date().toISOString();
      const eventId = await registerFinanceEvent(
        selectedTransaction.id,
        "payment_confirmed",
        "Pagamento confirmado pelo financeiro",
        financeActionForm.comment.trim() || "Pagamento conferido e confirmado pelo financeiro.",
        {
          valor_confirmado: selectedTransaction.payment_reported_amount || selectedTransaction.amount,
          forma_pagamento: selectedTransaction.payment_reported_method || selectedTransaction.payment_method || null,
          referencia: selectedTransaction.payment_reported_reference || null,
        }
      );

      await attachFinanceFileIfAny(selectedTransaction.id, eventId, "finance_confirmation");

      const { error } = await supabase
        .from("financial_transactions")
        .update({
          status: "paid",
          workflow_status: "confirmed",
          payment_date: new Date().toISOString().split("T")[0],
          payment_confirmed_at: now,
          finance_last_action_at: now,
          last_interaction_at: now,
          resolution_type: "payment_confirmed",
          resolution_notes: financeActionForm.resolutionNotes.trim() || financeActionForm.comment.trim() || "Pagamento confirmado pelo financeiro.",
          dispute_status: selectedTransaction.dispute_status === "open" ? "resolved" : selectedTransaction.dispute_status || null,
        })
        .eq("id", selectedTransaction.id);

      if (error) throw new Error(error.message || "Erro ao confirmar pagamento.");

      showToast("Pagamento confirmado e baixa realizada.", "success");
      setFinanceActionForm({ comment: "", resolutionType: "payment_confirmed", resolutionNotes: "" });
      setFinanceAttachmentFile(null);
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao confirmar pagamento.", "error");
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
          referencia: selectedTransaction.payment_reported_reference || null,
          pagamento_informado_em: selectedTransaction.payment_reported_at || null,
        }
      );

      await attachFinanceFileIfAny(selectedTransaction.id, eventId, "finance_rejection");

      const { error } = await supabase
        .from("financial_transactions")
        .update({
          status: "pending",
          workflow_status: "open",
          finance_last_action_at: now,
          last_interaction_at: now,
          resolution_type: "payment_rejected",
          resolution_notes: financeActionForm.resolutionNotes.trim() || financeActionForm.comment.trim(),
        })
        .eq("id", selectedTransaction.id);

      if (error) throw new Error(error.message || "Erro ao rejeitar pagamento.");

      showToast("Pagamento rejeitado com retorno ao cliente.", "success");
      setFinanceActionForm({ comment: "", resolutionType: "payment_confirmed", resolutionNotes: "" });
      setFinanceAttachmentFile(null);
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao rejeitar pagamento.", "error");
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
        financeActionForm.comment.trim() || "Contestação analisada e concluída pelo financeiro.",
        {
          tipo_resolucao: financeActionForm.resolutionType,
          observacoes: financeActionForm.resolutionNotes.trim(),
        }
      );

      await attachFinanceFileIfAny(selectedTransaction.id, eventId, "finance_resolution");

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
            financeActionForm.resolutionType === "payment_confirmed" ? now : selectedTransaction.payment_confirmed_at || null,
        })
        .eq("id", selectedTransaction.id);

      if (error) throw new Error(error.message || "Erro ao resolver contestação.");

      showToast("Contestação resolvida.", "success");
      setFinanceActionForm({ comment: "", resolutionType: "payment_confirmed", resolutionNotes: "" });
      setFinanceAttachmentFile(null);
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao resolver contestação.", "error");
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

      await attachFinanceFileIfAny(selectedTransaction.id, eventId, "finance_comment_attachment");

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status: selectedTransaction.workflow_status === "awaiting_finance" ? "under_review" : selectedTransaction.workflow_status || "open",
          finance_last_action_at: now,
          last_interaction_at: now,
        })
        .eq("id", selectedTransaction.id);

      if (error) throw new Error(error.message || "Erro ao registrar comentário.");

      showToast("Comentário registrado.", "success");
      setFinanceActionForm((prev) => ({ ...prev, comment: "" }));
      setFinanceAttachmentFile(null);
      await fetchData();
      await refreshSelectedTransaction(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao registrar comentário.", "error");
    } finally {
      setActionSubmitting(false);
    }
  };

  const renderTable = (
    typeFilter: "income" | "expense",
    expFilter?: "administrative" | "operational" | "personnel"
  ) => {
    const rows = filteredTransactions.filter(
      (t) => t.type === typeFilter && (!expFilter || t.expense_type === expFilter)
    );

    return (
      <div className="space-y-5">
        {typeFilter === "income" && (
          <section className="rounded-xl border border-cs-gold/20 bg-cs-gold/5 p-5 shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                  <ShieldAlert size={16} className="text-cs-gold" />
                  Fila de ações do cliente
                </h4>
                <p className="mt-1 text-xs uppercase tracking-wide text-text-secondary">
                  Cobranças com pagamento informado, contestação ou atendimento pendente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cs-gold/20 bg-cs-gold/10 px-3 py-1 text-xs font-black uppercase text-cs-gold">
                  Aguardando financeiro: {clientActionQueue.filter((t) => t.workflow_status === "awaiting_finance").length}
                </span>
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase text-orange-400">
                  Contestações: {clientActionQueue.filter((t) => t.dispute_status && t.dispute_status !== "resolved").length}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {clientActionQueue.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-background/40 p-4 text-xs font-bold uppercase tracking-wide text-text-secondary">
                  Nenhuma ação pendente do cliente no momento.
                </div>
              ) : (
                clientActionQueue.slice(0, 8).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={async () => {
                      setSelectedTransaction(t);
                      setIsDetailModalOpen(true);
                      await fetchInteractionDetails(t.id);
                    }}
                    className="rounded-lg border border-white/10 bg-background/40 p-4 text-left transition-all hover:border-cs-gold/40 hover:bg-background/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{t.description}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-text-secondary">
                          {t.clients?.company_name || "Sem cliente"} · {t.document_number || "Sem documento"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(t)}`}>
                        {statusLabel(t)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                      <span>{formatCurrency(Number(t.amount))}</span>
                      <span>Vence em {formatDate(t.due_date)}</span>
                      <span>{translateWorkflowStatus(t.workflow_status)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        )}

        <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-xl">
          <div className="p-4 border-b border-surface/50 bg-surface/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <input
                type="text"
                placeholder="Filtrar lançamentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-surface rounded-md text-xs text-white focus:border-cs-green outline-none transition-all"
              />
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-2 rounded-md border border-surface px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-background"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background/50 text-xs uppercase tracking-wide text-text-secondary font-black">
                <tr>
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
                    <td colSpan={6} className="px-6 py-10 text-center">
                      <Loader2 className="animate-spin mx-auto text-cs-green" size={24} />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-text-secondary text-sm uppercase font-semibold tracking-wide">
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => (
                    <tr key={t.id} className="hover:bg-background/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-white group-hover:text-cs-green transition-colors">{t.description}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-xs font-black uppercase text-text-secondary">
                            {t.clients?.company_name || t.member?.full_name || "—"}
                          </p>
                          {t.workflow_status === "awaiting_finance" && (
                            <span className="rounded-full border border-cs-gold/20 bg-cs-gold/10 px-2 py-0.5 text-[10px] font-black uppercase text-cs-gold">
                              Aguardando conferência
                            </span>
                          )}
                          {t.dispute_status && t.dispute_status !== "resolved" && (
                            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-orange-400">
                              Contestação
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{t.category}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold ${isOverdue(t.due_date, t.status || "pending") ? "text-red-500" : "text-white"}`}>
                          {new Date(`${t.due_date}T00:00:00`).toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-white">{formatCurrency(Number(t.amount))}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black uppercase border ${statusClass(t)}`}>
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
                          className="text-text-secondary hover:text-white transition-all"
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
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative pb-12">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border bg-[#1a1413] ${
            toast.type === "success"
              ? "border-cs-green text-cs-green"
              : toast.type === "warning"
              ? "border-cs-gold text-cs-gold"
              : "border-red-500 text-red-500"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 border border-surface/50 rounded-xl shadow-lg">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Wallet className="text-cs-green" size={28} /> {L.hub}
          </h3>
          <p className="text-xs text-text-secondary mt-1 uppercase font-semibold tracking-wide">
            {(companyProfile?.company_name as string) || "ARXUM"} · Gestão Financeira
          </p>
        </div>
        {view === "list" && (
          <button
            onClick={() => openCreateForTab(activeTab)}
            className="bg-cs-green text-white px-8 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg flex items-center gap-2"
          >
            <Plus size={18} /> Novo {L.transacao}
          </button>
        )}
      </div>

      {view === "list" && (
        <>
          <div className="flex gap-0 border-b border-surface/50 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-xs font-black uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id ? "border-cs-green text-cs-green" : "border-transparent text-text-secondary hover:text-white"
                }`}
              >
                <tab.icon size={13} /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-cs-green">
                  <p className="text-xs font-bold text-text-secondary uppercase mb-2">Saldo Realizado</p>
                  <p className={`text-3xl font-black ${stats.balance >= 0 ? "text-white" : "text-red-500"}`}>
                    {formatCurrency(stats.balance)}
                  </p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <p className="text-xs font-bold text-text-secondary uppercase mb-2">{L.receber} Pendentes</p>
                  <p className="text-3xl font-black text-cs-green">{formatCurrency(stats.pendingIn)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-cs-gold">
                  <p className="text-xs font-bold text-text-secondary uppercase mb-2">Aguardando Financeiro</p>
                  <p className="text-3xl font-black text-cs-gold">{formatCurrency(stats.waitingFinance)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-orange-500">
                  <p className="text-xs font-bold text-text-secondary uppercase mb-2">Contestação em Aberto</p>
                  <p className="text-3xl font-black text-orange-400">{formatCurrency(stats.disputedOpen)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-red-500">
                  <p className="text-xs font-bold text-text-secondary uppercase mb-2">Inadimplência Real</p>
                  <p className="text-3xl font-black text-red-500">{formatCurrency(stats.overdueIn)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <p className="text-xs font-bold text-text-secondary uppercase mb-2">Folha + {L.comissao}</p>
                  <p className="text-3xl font-black text-cs-gold">
                    {formatCurrency(personnelStats.totalSalaries + personnelStats.totalCommissions)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <TrendingUp size={16} className="text-cs-gold" /> Projeção de {L.receber} (Aging)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Vencidos", val: stats.overdueIn, color: "bg-red-500" },
                      { label: "Próx. 7 dias", val: stats.pendingIn * 0.4, color: "bg-cs-gold" },
                      { label: "15–30 dias", val: stats.pendingIn * 0.3, color: "bg-blue-500" },
                      { label: "30+ dias", val: stats.pendingIn * 0.3, color: "bg-cs-green" },
                    ].map((b) => (
                      <div key={b.label} className="space-y-2">
                        <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                          <div className={`h-full ${b.color} transition-all`} style={{ width: `${Math.min((b.val / (stats.pendingIn || 1)) * 100, 100)}%` }} />
                        </div>
                        <p className="text-[9px] font-black text-text-secondary uppercase">{b.label}</p>
                        <p className="text-sm font-bold text-white">{formatCurrency(b.val)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <PieChart size={16} className="text-cs-gold" /> Centro de Custos — Despesas Efetivadas
                  </h4>
                  {expenseByCategory.length === 0 ? (
                    <p className="text-text-secondary text-xs uppercase font-black text-center py-8">
                      Sem despesas efetivadas.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {expenseByCategory.map((item, i) => (
                        <div key={item.cat} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-text-secondary uppercase truncate max-w-[60%]">{item.cat}</span>
                            <span className="text-xs font-black text-white">{formatCurrency(item.val)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                            <div className={`h-full ${CHART_COLORS[i % CHART_COLORS.length]} transition-all`} style={{ width: `${(item.val / (totalExpenses || 1)) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-surface/50 flex justify-between">
                        <span className="text-xs font-bold text-text-secondary uppercase">Total Despesas</span>
                        <span className="text-xs font-black text-red-400">{formatCurrency(totalExpenses)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "receber" && renderTable("income")}
          {activeTab === "pagar_admin" && renderTable("expense", "administrative")}
          {activeTab === "pagar_operacional" && renderTable("expense", "operational")}

          {activeTab === "pessoal" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-text-secondary uppercase">{L.salario}s Pagos</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(personnelStats.totalSalaries)}</p>
                  </div>
                  <UserCheck className="text-cs-green opacity-20" size={48} />
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-text-secondary uppercase">{L.comissao} Pagas</p>
                    <p className="text-2xl font-black text-cs-gold">{formatCurrency(personnelStats.totalCommissions)}</p>
                  </div>
                  <Percent className="text-cs-gold opacity-20" size={48} />
                </div>
              </div>

              {personnelStats.commissionByMember.length > 0 && (
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart3 size={16} className="text-cs-gold" /> Ranking de {L.comissao} por {L.colaborador}
                  </h4>
                  <div className="space-y-3">
                    {personnelStats.commissionByMember.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-4">
                        <span className="text-xs font-bold text-text-secondary w-5 text-right">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-bold text-white">{m.name}</span>
                            <span className="text-xs font-black text-cs-gold">{formatCurrency(m.total)}</span>
                          </div>
                          <div className="h-1.5 bg-background rounded-full overflow-hidden">
                            <div className="h-full bg-cs-gold transition-all" style={{ width: `${(m.total / (personnelStats.commissionByMember[0]?.total || 1)) * 100}%` }} />
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
            <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-2xl animate-in fade-in">
              <table className="w-full text-left text-sm">
                <thead className="bg-background/50 text-xs uppercase tracking-wide text-text-secondary font-black">
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
                      <td colSpan={4} className="px-8 py-10 text-center text-text-secondary text-xs uppercase font-black tracking-widest">
                        Nenhum {L.cliente} com movimentação financeira.
                      </td>
                    </tr>
                  ) : (
                    clientSummary.map((c) => (
                      <tr key={c.id} className="hover:bg-background/40 transition-colors group">
                        <td className="px-8 py-6 font-black text-white uppercase tracking-tight">{c.company_name}</td>
                        <td className="px-8 py-6 font-bold text-cs-green">{formatCurrency(c.ltv)}</td>
                        <td className="px-8 py-6 font-bold text-red-400">{formatCurrency(c.debt)}</td>
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
        </>
      )}

      {view === "create" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <button
            onClick={() => {
              resetForm();
              setView("list");
            }}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-all uppercase text-xs font-black tracking-widest"
          >
            <ArrowLeft size={16} /> Voltar ao Fluxo
          </button>

          <div className="bg-surface border border-surface/50 p-8 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-8 border-b border-surface/50 pb-4 uppercase tracking-tighter">
              {editId ? `Ajustar ${L.transacao}` : `Novo ${L.transacao}`}
            </h2>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-background rounded-lg border border-surface/50 w-fit">
                  <button
                    type="button"
                    onClick={() => setFormType("income")}
                    className={`px-8 py-2 rounded text-xs font-black uppercase transition-all ${
                      formType === "income" ? "bg-cs-green text-white shadow-lg" : "text-text-secondary"
                    }`}
                  >
                    {L.receita}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("expense")}
                    className={`px-8 py-2 rounded text-xs font-black uppercase transition-all ${
                      formType === "expense" ? "bg-red-500 text-white shadow-lg" : "text-text-secondary"
                    }`}
                  >
                    {L.despesa}
                  </button>
                </div>

                {formType === "expense" && (
                  <div className="flex gap-2">
                    {([
                      { id: "administrative", label: L.pagarAdmin },
                      { id: "operational", label: L.pagarOp },
                      { id: "personnel", label: L.pessoal },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setExpenseType(opt.id)}
                        className={`flex-1 py-2 rounded text-xs font-black uppercase border border-surface transition-all ${
                          expenseType === opt.id ? "bg-white text-black" : "text-text-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wide">
                      Descrição *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wide">
                        Valor ({currencyCode}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.amount}
                        onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                        className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wide">
                        Vencimento *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.dueDate}
                        onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                        className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2 tracking-wide">
                      Categoria
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none transition-all"
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
                      <label className="block text-xs font-bold text-text-secondary uppercase mb-2 tracking-wide">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            status: e.target.value as "pending" | "paid" | "cancelled",
                          }))
                        }
                        className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none transition-all"
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago / Efetivado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase mb-2 tracking-wide">
                        Método
                      </label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                        className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none transition-all"
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
                      <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wide">
                        Data do Pagamento
                      </label>
                      <input
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) => setForm((p) => ({ ...p, paymentDate: e.target.value }))}
                        className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {formType === "income" && (
                    <div className="relative">
                      <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wide">
                        Vincular {L.cliente}
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            if (!e.target.value) setForm((p) => ({ ...p, clientId: "" }));
                          }}
                          placeholder={`Pesquisar ${L.cliente}...`}
                          className="w-full bg-background border border-surface rounded-md pl-9 pr-4 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all"
                        />
                      </div>
                      {clientSearch && filteredClientsList.length > 0 && !formData.clientId && (
                        <div className="absolute z-50 w-full mt-1 bg-surface border border-surface/50 rounded-md shadow-2xl">
                          {filteredClientsList.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setForm((p) => ({ ...p, clientId: c.id }));
                                setClientSearch(c.company_name);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-white hover:bg-cs-green/20 border-b border-surface/50 last:border-0"
                            >
                              {c.company_name}
                            </button>
                          ))}
                        </div>
                      )}
                      {formData.clientId && (
                        <p className="text-xs text-cs-green mt-1 font-semibold">✓ {L.cliente} vinculado</p>
                      )}
                    </div>
                  )}

                  {(formType === "income" || (formType === "expense" && expenseType === "operational")) && (
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase mb-2 tracking-wide">
                        Centro de Custos ({L.os})
                      </label>
                      <select
                        value={formData.serviceOrderId}
                        onChange={(e) => setForm((p) => ({ ...p, serviceOrderId: e.target.value }))}
                        className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none transition-all"
                      >
                        <option value="">Geral / Sem {L.os}</option>
                        {approvedQuotes.map((q) => (
                          <option key={q.id} value={q.id}>
                            {L.orcamento}: {q.title}
                          </option>
                        ))}
                      </select>
                      {approvedQuotes.length === 0 && (
                        <p className="text-xs text-text-secondary mt-1">Nenhum {L.orcamento} aprovado localizado.</p>
                      )}
                    </div>
                  )}

                  {formType === "expense" && expenseType === "personnel" && (
                    <>
                      <div className="relative">
                        <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wide">
                          {L.colaborador}
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                          <input
                            type="text"
                            value={memberSearch}
                            onChange={(e) => {
                              setMemberSearch(e.target.value);
                              if (!e.target.value) setForm((p) => ({ ...p, memberId: "" }));
                            }}
                            placeholder={`Pesquisar ${L.colaborador}...`}
                            className="w-full bg-background border border-surface rounded-md pl-9 pr-4 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all"
                          />
                        </div>
                        {memberSearch && filteredTeamList.length > 0 && !formData.memberId && (
                          <div className="absolute z-50 w-full mt-1 bg-surface border border-surface/50 rounded-md shadow-2xl">
                            {filteredTeamList.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setForm((p) => ({ ...p, memberId: m.id }));
                                  setMemberSearch(m.full_name);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-white hover:bg-cs-gold/20 border-b border-surface/50 last:border-0"
                              >
                                <span className="font-bold">{m.full_name}</span>
                                {m.commission_percentage ? (
                                  <span className="ml-2 text-cs-gold">· {m.commission_percentage}% {L.comissao}</span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        )}
                        {formData.memberId && (
                          <p className="text-xs text-cs-gold mt-1 font-semibold">✓ {L.colaborador} vinculado</p>
                        )}
                      </div>

                      {formData.category.toLowerCase().includes("comiss") && (
                        <div className="bg-cs-gold/5 border border-cs-gold/20 rounded-lg p-4 space-y-3">
                          <p className="text-xs font-black text-cs-gold uppercase tracking-widest">{L.comissao} de Venda</p>
                          {formData.memberId &&
                            (() => {
                              const member = team.find((m) => m.id === formData.memberId);
                              return member?.commission_percentage ? (
                                <p className="text-xs text-text-secondary">
                                  Taxa cadastrada: <strong className="text-white">{member.commission_percentage}%</strong>
                                  {formData.amount ? (
                                    <>
                                      {" "}
                                      · Calculado:{" "}
                                      <strong className="text-cs-gold">
                                        {formatCurrency((Number(formData.amount) * member.commission_percentage) / 100)}
                                      </strong>
                                    </>
                                  ) : null}
                                </p>
                              ) : null;
                            })()}
                          <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wide">
                              Valor da {L.comissao} ({currencyCode})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Valor final a pagar..."
                              value={formData.commissionAmount}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, commissionAmount: e.target.value, amount: e.target.value }))
                              }
                              className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-gold outline-none transition-all"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2 tracking-wide">
                      Comprovante / Anexo
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-surface border border-surface/50 py-3 rounded-md text-xs font-black uppercase text-white hover:bg-background transition-all flex items-center justify-center gap-2"
                    >
                      {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
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
                      <p className="text-xs text-cs-green mt-1 font-semibold">✓ Arquivo anexado</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-surface/50 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-cs-green text-white px-12 py-4 rounded-md font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center gap-3"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Finalizar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[150] backdrop-blur-md p-4">
          <div className="bg-[#1a1413] border border-surface/50 rounded-xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="p-6 bg-background/50 border-b border-surface/50 flex justify-between items-start gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                  {selectedTransaction.description}
                </h2>
                <div className="flex gap-2 flex-wrap">
                  <span
                    className={`text-xs font-black px-3 py-1 rounded-full uppercase border ${
                      selectedTransaction.type === "income"
                        ? "bg-cs-green/10 text-cs-green border-cs-green/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}
                  >
                    {selectedTransaction.type === "income" ? L.receita : L.despesa}
                  </span>
                  <span className="text-xs font-black px-3 py-1 rounded-full uppercase bg-surface border border-surface/50 text-text-secondary">
                    {selectedTransaction.category}
                  </span>
                  {(selectedTransaction.quote || selectedTransaction.service_orders?.quotes) && (
                    <span className="text-xs font-black px-3 py-1 rounded-full uppercase bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      {L.orcamento}: {selectedTransaction.quote?.title || selectedTransaction.service_orders?.quotes?.title || "—"}
                    </span>
                  )}
                  {selectedTransaction.document_number && (
                    <span className="text-xs font-black px-3 py-1 rounded-full uppercase bg-white/5 border border-white/10 text-zinc-300">
                      Documento: {selectedTransaction.document_number}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-text-secondary hover:text-white transition-colors bg-surface p-2 rounded-full border border-surface/50"
                aria-label="Fechar"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-0 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-6 max-h-[calc(92vh-110px)]">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-background p-4 rounded-lg border border-surface/50">
                    <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Montante</p>
                    <p className="text-xl font-black text-white">{formatCurrency(Number(selectedTransaction.amount))}</p>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-surface/50">
                    <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Vencimento</p>
                    <p className="text-sm font-bold text-white">{formatDate(selectedTransaction.due_date)}</p>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-surface/50">
                    <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Status</p>
                    <p className={`text-sm font-bold uppercase ${statusClass(selectedTransaction).split(" ")[1]}`}>
                      {statusLabel(selectedTransaction)}
                    </p>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-surface/50">
                    <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Workflow</p>
                    <p className="text-sm font-bold text-white">{translateWorkflowStatus(selectedTransaction.workflow_status)}</p>
                  </div>
                </div>

                <section className="rounded-xl border border-surface/50 bg-background/40 p-5">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-surface/50 pb-3">
                    Resumo financeiro e operacional
                  </h4>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Cliente</p>
                      <p className="mt-1 text-sm text-white">{selectedTransaction.clients?.company_name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Pagamento informado</p>
                      <p className="mt-1 text-sm text-white">
                        {selectedTransaction.payment_reported_at ? formatDateTime(selectedTransaction.payment_reported_at) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Valor informado pelo cliente</p>
                      <p className="mt-1 text-sm text-white">
                        {selectedTransaction.payment_reported_amount != null
                          ? formatCurrency(Number(selectedTransaction.payment_reported_amount))
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Forma informada</p>
                      <p className="mt-1 text-sm text-white">{selectedTransaction.payment_reported_method || selectedTransaction.payment_method || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Referência</p>
                      <p className="mt-1 text-sm text-white">{selectedTransaction.payment_reported_reference || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Pagamento confirmado</p>
                      <p className="mt-1 text-sm text-white">
                        {selectedTransaction.payment_confirmed_at ? formatDateTime(selectedTransaction.payment_confirmed_at) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Categoria da contestação</p>
                      <p className="mt-1 text-sm text-white">{translateDisputeCategory(selectedTransaction.dispute_category)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Motivo da contestação</p>
                      <p className="mt-1 text-sm text-white">{selectedTransaction.dispute_reason || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Observações da cobrança</p>
                      <p className="mt-1 text-sm text-white">{selectedTransaction.invoice_notes || selectedTransaction.attachment_url || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary">Retorno / resolução do financeiro</p>
                      <p className="mt-1 text-sm text-white">{selectedTransaction.resolution_notes || "-"}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-surface/50 bg-background/40 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Histórico da cobrança</h4>
                    {detailLoading ? <Loader2 className="animate-spin text-cs-gold" size={18} /> : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {events.length === 0 ? (
                      <p className="text-sm text-text-secondary">Nenhuma interação registrada.</p>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="rounded-xl border border-surface/50 bg-surface p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-white">{event.title || translateEventType(event.event_type)}</p>
                            <span className="text-xs text-text-secondary">{formatDateTime(event.created_at)}</span>
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-wider text-text-secondary">
                            {event.author_type === "client"
                              ? "Cliente"
                              : event.author_type === "finance"
                              ? "Financeiro"
                              : "Sistema"}
                            {" · "}
                            {event.visibility === "shared" ? "Compartilhado" : "Interno"}
                          </p>
                          <p className="mt-3 text-sm text-zinc-200">{event.message || "-"}</p>
                          {event.metadata && Object.keys(event.metadata).length > 0 && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {Object.entries(event.metadata).map(([key, value]) => (
                                <div key={key} className="rounded-lg border border-surface/40 bg-background/30 px-3 py-2 text-xs text-text-secondary">
                                  <span className="block uppercase tracking-wider">{key.replaceAll("_", " ")}</span>
                                  <span className="mt-1 block text-white">{String(value ?? "-")}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-surface/50 bg-background/40 p-5">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Anexos</h4>
                  <div className="mt-4 space-y-3">
                    {attachments.length === 0 ? (
                      <p className="text-sm text-text-secondary">Nenhum anexo disponível.</p>
                    ) : (
                      attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-surface/50 bg-surface p-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{file.file_name}</p>
                            <p className="mt-1 text-xs uppercase tracking-wider text-text-secondary">
                              {file.attachment_type} · {file.uploaded_by_type === "client" ? "Cliente" : file.uploaded_by_type === "finance" ? "Financeiro" : "Sistema"} · {formatDateTime(file.created_at)}
                            </p>
                          </div>
                          <div className="flex gap-2">
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
                                <Loader2 className="animate-spin" size={16} /> Carregando
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-surface/50 bg-background/40 p-5">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-surface/50 pb-3">
                    Ações rápidas da cobrança
                  </h4>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => sendWhatsApp(selectedTransaction)}
                      className="flex items-center justify-center gap-2 bg-cs-green/10 text-cs-green border border-cs-green/20 py-3 rounded-md font-black text-xs uppercase hover:bg-cs-green/20 transition-all"
                    >
                      <MessageCircle size={16} /> WhatsApp
                    </button>
                    <button
                      onClick={() => sendInvoiceEmail(selectedTransaction)}
                      disabled={isSendingMail}
                      className="flex items-center justify-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 py-3 rounded-md font-black text-xs uppercase hover:bg-blue-500/20 transition-all disabled:opacity-50"
                    >
                      {isSendingMail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />} E-mail
                    </button>
                    <button
                      onClick={() => router.push(`/financeiro/fatura/${selectedTransaction.id}`)}
                      className="flex items-center justify-center gap-2 bg-surface border border-surface/50 py-3 rounded-md font-black text-xs uppercase text-white hover:bg-background transition-all"
                    >
                      <Receipt size={16} /> Gerar Fatura PDF
                    </button>
                  </div>
                </section>
              </div>

              <aside className="border-l border-surface/50 bg-background/30 p-6 overflow-y-auto max-h-[calc(92vh-110px)] space-y-5">
                <section className="rounded-xl border border-cs-gold/20 bg-cs-gold/5 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                    <ShieldAlert size={16} className="text-cs-gold" />
                    Atendimento financeiro
                  </h4>
                  <p className="mt-2 text-xs uppercase tracking-wide text-text-secondary">
                    Registre comentários, confirme pagamento, rejeite retorno ou resolva contestações.
                  </p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-text-secondary mb-1.5">
                        Comentário do financeiro
                      </label>
                      <textarea
                        value={financeActionForm.comment}
                        onChange={(e) => setFinanceActionForm((prev) => ({ ...prev, comment: e.target.value }))}
                        className="min-h-[110px] w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-gold"
                        placeholder="Escreva um retorno claro para o cliente ou para o histórico interno."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-text-secondary mb-1.5">
                        Tipo de resolução
                      </label>
                      <select
                        value={financeActionForm.resolutionType}
                        onChange={(e) => setFinanceActionForm((prev) => ({ ...prev, resolutionType: e.target.value }))}
                        className="w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-gold"
                      >
                        <option value="payment_confirmed">Pagamento confirmado</option>
                        <option value="charge_adjusted">Cobrança ajustada</option>
                        <option value="charge_maintained">Cobrança mantida</option>
                        <option value="charge_cancelled">Cobrança cancelada</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-text-secondary mb-1.5">
                        Observação de resolução
                      </label>
                      <textarea
                        value={financeActionForm.resolutionNotes}
                        onChange={(e) => setFinanceActionForm((prev) => ({ ...prev, resolutionNotes: e.target.value }))}
                        className="min-h-[110px] w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-gold"
                        placeholder="Explique a decisão tomada pelo financeiro."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-text-secondary mb-2">
                        Anexo do financeiro
                      </label>
                      <button
                        type="button"
                        onClick={() => financeAttachmentInputRef.current?.click()}
                        className="w-full rounded-lg border border-dashed border-surface bg-background px-4 py-3 text-sm font-semibold text-white hover:border-cs-gold transition-all flex items-center justify-center gap-2"
                      >
                        <Upload size={16} />
                        {financeAttachmentFile ? financeAttachmentFile.name : "Selecionar arquivo"}
                      </button>
                      <input
                        ref={financeAttachmentInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setFinanceAttachmentFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-surface/50 bg-surface p-4 space-y-3">
                  <button
                    type="button"
                    onClick={handleAddFinanceComment}
                    disabled={actionSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {actionSubmitting ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                    Registrar comentário
                  </button>

                  {(selectedTransaction.workflow_status === "awaiting_finance" ||
                    selectedTransaction.workflow_status === "under_review") && (
                    <>
                      <button
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={actionSubmitting}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cs-green px-4 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-50"
                      >
                        {actionSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCheck size={18} />}
                        Confirmar pagamento e dar baixa
                      </button>

                      <button
                        type="button"
                        onClick={handleRejectPayment}
                        disabled={actionSubmitting}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-red-500 disabled:opacity-50"
                      >
                        {actionSubmitting ? <Loader2 className="animate-spin" size={18} /> : <X size={18} />}
                        Rejeitar pagamento informado
                      </button>
                    </>
                  )}

                  {selectedTransaction.dispute_status && selectedTransaction.dispute_status !== "resolved" && (
                    <button
                      type="button"
                      onClick={handleResolveDispute}
                      disabled={actionSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {actionSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldAlert size={18} />}
                      Resolver contestação
                    </button>
                  )}
                </section>

                <section className="rounded-xl border border-surface/50 bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setConfirmDeleteId(selectedTransaction.id)}
                      className="flex items-center gap-2 text-xs font-black uppercase text-red-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEditForm(selectedTransaction)}
                        className="bg-background border border-surface/50 text-white px-4 py-2.5 rounded-md text-xs font-black uppercase tracking-widest hover:bg-surface/80 transition-all"
                      >
                        Editar
                      </button>
                      {selectedTransaction.status === "pending" && (
                        <button
                          onClick={() => updateStatus(selectedTransaction.id, "paid")}
                          className="bg-cs-green text-white px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-widest shadow-lg hover:bg-opacity-90 transition-all"
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

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[160] backdrop-blur-sm">
          <div className="bg-[#1a1413] border border-surface/50 rounded-xl w-full max-w-sm p-8 text-center space-y-6 shadow-2xl">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Remover Registro?</h3>
            <p className="text-sm text-text-secondary font-medium">
              Esta ação é irreversível e afetará os relatórios financeiros.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 border border-surface rounded-md text-xs font-black uppercase text-text-secondary hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteTransaction(confirmDeleteId)}
                className="flex-1 py-3 bg-red-600 text-white rounded-md text-xs font-black uppercase shadow-lg hover:bg-red-500 transition-all"
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