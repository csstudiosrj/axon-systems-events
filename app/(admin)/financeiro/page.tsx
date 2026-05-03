"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useSettings } from "../../../providers/SettingsProvider";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";

type FinancialTransaction = {
  id: string;
  description: string;
  type: string | null;
  category: string | null;
  amount: number;
  status: string | null;
  due_date: string;
  payment_date: string | null;
  created_at: string;
  notes: string | null;
  client_id: string | null;
  quote_id: string | null;
  service_order_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  payment_method: string | null;
  attachment_url: string | null;
  source: string | null;
  invoice_notes: string | null;
  document_number: string | null;
  workflow_status: string | null;
  dispute_status: string | null;
  dispute_reason: string | null;
  dispute_category: string | null;
  customer_last_action_at: string | null;
  finance_last_action_at: string | null;
  last_interaction_at: string | null;
  payment_reported_amount: number | null;
  payment_reported_method: string | null;
  payment_reported_reference: string | null;
  payment_reported_at: string | null;
  payment_confirmed_at: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
};

type FinancialEvent = {
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
};

type FinancialAttachment = {
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
};

type ToastState = {
  type: "success" | "error";
  text: string;
};

type ActionPanelKey = "payment" | "dispute" | null;

type InvoiceGroup = {
  id: string;
  title: string;
  documentNumber: string | null;
  totalAmount: number;
  paidAmount: number;
  openAmount: number;
  earliestDueDate: string;
  latestDueDate: string;
  totalInstallments: number;
  sourceLabel: string | null;
  items: FinancialTransaction[];
};

const STORAGE_BUCKET = "files-main";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function removeInstallmentSuffix(value: string | null | undefined) {
  return (value || "")
    .replace(/[-–—]?\s*parcela\s*\d+\s*\/\s*\d+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBaseTitle(item: FinancialTransaction, fallbackLabel: string) {
  const cleaned = removeInstallmentSuffix(item.description);
  if (cleaned) return cleaned;
  return fallbackLabel;
}

function buildStrongGroupKey(item: FinancialTransaction) {
  const totalInstallments = item.total_installments || 1;
  const cleanedDescription = normalizeText(removeInstallmentSuffix(item.description));
  const documentNumber = normalizeText(item.document_number);
  const source = normalizeText(item.source);
  const category = normalizeText(item.category);
  const amount = Number(item.amount || 0).toFixed(2);

  if (item.service_order_id && totalInstallments > 1) {
    return `service_order_installments:${item.service_order_id}:${documentNumber || cleanedDescription || amount}:${totalInstallments}`;
  }

  if (item.quote_id && totalInstallments > 1) {
    return `quote_installments:${item.quote_id}:${documentNumber || cleanedDescription || amount}:${totalInstallments}`;
  }

  if (documentNumber && totalInstallments > 1) {
    return `document_installments:${documentNumber}:${totalInstallments}`;
  }

  if (cleanedDescription && totalInstallments > 1) {
    return `description_installments:${cleanedDescription}:${amount}:${totalInstallments}`;
  }

  if (item.service_order_id) {
    return `service_order_single:${item.service_order_id}:${documentNumber || cleanedDescription || amount}`;
  }

  if (item.quote_id) {
    return `quote_single:${item.quote_id}:${documentNumber || cleanedDescription || amount}`;
  }

  if (documentNumber) {
    return `document_single:${documentNumber}:${amount}`;
  }

  if (cleanedDescription) {
    return `description_single:${cleanedDescription}:${amount}:${source}:${category}`;
  }

  return `single:${item.id}`;
}

function sortTransactionsInGroup(items: FinancialTransaction[]) {
  return [...items].sort((a, b) => {
    const installmentA = a.installment_number ?? 9999;
    const installmentB = b.installment_number ?? 9999;
    if (installmentA !== installmentB) return installmentA - installmentB;

    const dueA = new Date(a.due_date || 0).getTime();
    const dueB = new Date(b.due_date || 0).getTime();
    if (dueA !== dueB) return dueA - dueB;

    const createdA = new Date(a.created_at || 0).getTime();
    const createdB = new Date(b.created_at || 0).getTime();
    if (createdA !== createdB) return createdA - createdB;

    return a.id.localeCompare(b.id);
  });
}

function dedupeTransactions(items: FinancialTransaction[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function PortalFaturasPage() {
  const { resolvedClientId, systemPreferences, companyProfile } = useSettings();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [attachments, setAttachments] = useState<FinancialAttachment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ type: "success", text: "" });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [disputeFile, setDisputeFile] = useState<File | null>(null);
  // FIX 1: signedUrls removido das dependências do useCallback — gerenciado via setState funcional
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [openActionPanel, setOpenActionPanel] = useState<ActionPanelKey>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "pix",
    reference: "",
    message: "",
  });

  const [disputeForm, setDisputeForm] = useState({
    category: "amount_divergence",
    reason: "",
    message: "",
  });

  const toastTimer = useRef<number | null>(null);

  const labels = systemPreferences?.custom_labels;
  const invoiceSingular = labels?.entity_invoice_singular || "Fatura";
  const invoicePlural = labels?.entity_invoice_plural || "Faturas";
  const clientSingular = labels?.entity_client_singular || "Cliente";
  const quoteSingular = labels?.entity_quote_singular || "Orçamento";
  const serviceOrderSingular = labels?.entity_service_order_singular || "Ordem de Serviço";
  const brandName = companyProfile?.company_name || "ARXUM Systems";
  const brandColor = companyProfile?.primary_color || "#138946";
  const currencyCode = systemPreferences?.currency_code || "BRL";

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToast({ text, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast({ type: "success", text: "" }), 4000);
  }, []);

  const currency = useCallback(
    (value: number | null | undefined) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currencyCode,
      }).format(Number(value || 0)),
    [currencyCode]
  );

  const handleCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const floatValue = (Number(digits) / 100).toFixed(2);
    if (digits === "") return "";
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(floatValue));
  };

  const parseCurrencyToNumber = (value: string) => {
    return Number(value.replace(/\./g, "").replace(",", "."));
  };

  const formatDate = useCallback((value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("pt-BR");
  }, []);

  const formatDateTime = useCallback((value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR");
  }, []);

  const translateFinancialStatus = useCallback((status: string | null) => {
    const map: Record<string, string> = {
      pending: "Pendente",
      paid: "Pago",
      received: "Recebido",
      overdue: "Vencido",
      cancelled: "Cancelado",
    };
    return map[status || ""] || status || "-";
  }, []);

  const translateWorkflowStatus = useCallback((status: string | null) => {
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
    return map[status || ""] || status || "Em aberto";
  }, []);

  const translateDisputeCategory = useCallback((value: string | null) => {
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
  }, []);

  const translateEventType = useCallback((value: string) => {
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
    return map[value] || value;
  }, []);

  const translatePaymentMethod = useCallback((value: string | null) => {
    const map: Record<string, string> = {
      pix: "PIX",
      boleto: "Boleto",
      transferencia: "Transferência",
      cartao: "Cartão",
      outro: "Outro",
    };
    return map[value || ""] || value || "-";
  }, []);

  const formatMetadataLabel = useCallback((key: string) => {
    const map: Record<string, string> = {
      valor: "Valor",
      forma_pagamento: "Forma de pagamento",
      referencia: "Referência",
      categoria: "Categoria",
      motivo: "Motivo",
    };
    return map[key] || key.replaceAll("_", " ");
  }, []);

  const formatMetadataValue = useCallback(
    (key: string, value: unknown) => {
      if (value === null || value === undefined || value === "") return "-";
      if (key === "valor" && typeof value === "number") return currency(value);
      if (key === "forma_pagamento" && typeof value === "string") return translatePaymentMethod(value);
      if (key === "categoria" && typeof value === "string") return translateDisputeCategory(value);
      return String(value);
    },
    [currency, translateDisputeCategory, translatePaymentMethod]
  );

  const getSourceLabel = useCallback(
    (item: FinancialTransaction) => {
      if (item.service_order_id) return serviceOrderSingular;
      if (item.quote_id) return quoteSingular;
      return item.source || null;
    },
    [quoteSingular, serviceOrderSingular]
  );

  const fetchTransactions = useCallback(async () => {
    if (!resolvedClientId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);

    const { data, error } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("client_id", resolvedClientId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar cobranças:", error);
      setTransactions([]);
      setLoading(false);
      showToast("Não foi possível carregar as cobranças.", "error");
      return;
    }

    const rows = dedupeTransactions((data || []) as FinancialTransaction[]);
    setTransactions(rows);

    const unread = rows.filter(
      (t) =>
        t.finance_last_action_at &&
        (!t.customer_last_action_at ||
          new Date(t.finance_last_action_at) > new Date(t.customer_last_action_at))
    ).length;
    setUnreadNotifications(unread);

    setLoading(false);
  }, [resolvedClientId, showToast]);

  const fetchDetails = useCallback(async (transactionId: string) => {
    setDetailLoading(true);
    const [eventsResult, attachmentsResult] = await Promise.all([
      supabase
        .from("financial_transaction_events")
        .select("*")
        .eq("financial_transaction_id", transactionId)
        .eq("visibility", "shared")
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_transaction_attachments")
        .select("*")
        .eq("financial_transaction_id", transactionId)
        .eq("visibility", "shared")
        .order("created_at", { ascending: false }),
    ]);

    if (eventsResult.error) {
      setEvents([]);
    } else {
      setEvents((eventsResult.data || []) as FinancialEvent[]);
    }

    if (attachmentsResult.error) {
      setAttachments([]);
    } else {
      setAttachments((attachmentsResult.data || []) as FinancialAttachment[]);
    }
    setDetailLoading(false);
  }, []);

  // FIX 5: Marca a fatura como lida ao selecionar, zerando o contador de notificações
  const markTransactionAsRead = useCallback(
    async (transactionId: string) => {
      const now = new Date().toISOString();
      await supabase
        .from("financial_transactions")
        .update({ customer_last_action_at: now })
        .eq("id", transactionId);

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, customer_last_action_at: now } : t
        )
      );

      setUnreadNotifications((prev) => {
        const stillUnread = transactions.filter(
          (t) =>
            t.id !== transactionId &&
            t.finance_last_action_at &&
            (!t.customer_last_action_at ||
              new Date(t.finance_last_action_at) > new Date(t.customer_last_action_at))
        ).length;
        return stillUnread;
      });
    },
    [transactions]
  );

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (unreadNotifications > 0) {
      document.title = `(${unreadNotifications}) Atualizações em ${invoicePlural} | ${brandName}`;
    } else {
      document.title = `${invoicePlural} | ${brandName}`;
    }
  }, [unreadNotifications, invoicePlural, brandName]);

  // FIX 2: Limpa formulários ao trocar de fatura selecionada
  useEffect(() => {
    if (!selectedId) return;

    setOpenActionPanel(null);
    setPaymentForm({ amount: "", method: "pix", reference: "", message: "" });
    setDisputeForm({ category: "amount_divergence", reason: "", message: "" });
    setPaymentFile(null);
    setDisputeFile(null);

    void fetchDetails(selectedId);
    void markTransactionAsRead(selectedId);
  }, [selectedId, fetchDetails, markTransactionAsRead]);

  const groupedInvoices = useMemo<InvoiceGroup[]>(() => {
    const map = new Map<string, InvoiceGroup>();
    for (const item of transactions) {
      const key = buildStrongGroupKey(item);
      const title = extractBaseTitle(item, invoiceSingular);
      const sourceLabel = getSourceLabel(item);

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title,
          documentNumber: item.document_number,
          totalAmount: 0,
          paidAmount: 0,
          openAmount: 0,
          earliestDueDate: item.due_date,
          latestDueDate: item.due_date,
          totalInstallments: item.total_installments || 1,
          sourceLabel,
          items: [],
        });
      }

      const group = map.get(key)!;
      if (!group.items.some((existing) => existing.id === item.id)) {
        group.items.push(item);
      }

      group.totalAmount += Number(item.amount || 0);
      const isPaid =
        item.status === "paid" ||
        item.status === "received" ||
        item.workflow_status === "confirmed";
      if (isPaid) group.paidAmount += Number(item.amount || 0);
      else group.openAmount += Number(item.amount || 0);

      if (new Date(item.due_date) < new Date(group.earliestDueDate))
        group.earliestDueDate = item.due_date;
      if (new Date(item.due_date) > new Date(group.latestDueDate))
        group.latestDueDate = item.due_date;
    }

    return Array.from(map.values())
      .map((group) => ({ ...group, items: sortTransactionsInGroup(group.items) }))
      .sort(
        (a, b) =>
          new Date(a.earliestDueDate).getTime() - new Date(b.earliestDueDate).getTime()
      );
  }, [transactions, invoiceSingular, getSourceLabel]);

  useEffect(() => {
    if (groupedInvoices.length > 0 && !selectedId) {
      setSelectedId(groupedInvoices[0].items[0].id);
    }
  }, [groupedInvoices, selectedId]);

  const selectedTransaction = useMemo(
    () => transactions.find((item) => item.id === selectedId) || null,
    [transactions, selectedId]
  );
  const selectedGroup = useMemo(
    () =>
      groupedInvoices.find((group) => group.items.some((item) => item.id === selectedId)) ||
      null,
    [groupedInvoices, selectedId]
  );
  const selectedGroupItems = useMemo(() => selectedGroup?.items || [], [selectedGroup]);
  const selectedIndexInGroup = useMemo(() => {
    if (!selectedTransaction || !selectedGroup) return -1;
    return selectedGroup.items.findIndex((item) => item.id === selectedTransaction.id);
  }, [selectedGroup, selectedTransaction]);

  const summary = useMemo(() => {
    const today = new Date();
    const open = transactions.filter(
      (item) =>
        item.status !== "paid" &&
        item.status !== "received" &&
        item.workflow_status !== "confirmed"
    );
    const paid = transactions.filter(
      (item) =>
        item.status === "paid" ||
        item.status === "received" ||
        item.workflow_status === "confirmed"
    );
    const overdue = open.filter((item) => new Date(item.due_date) < today);

    return {
      totalOpen: open.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      totalPaid: paid.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      totalOverdue: overdue.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      totalCount: transactions.length,
      totalGroups: groupedInvoices.length,
    };
  }, [groupedInvoices.length, transactions]);

  const getStatusBadge = useCallback((item: FinancialTransaction) => {
    const isPaid =
      item.status === "paid" ||
      item.status === "received" ||
      item.workflow_status === "confirmed";
    const isDisputed =
      !!item.dispute_status &&
      item.dispute_status !== "none" &&
      item.dispute_status !== "resolved";
    const isAwaiting =
      item.workflow_status === "awaiting_finance" ||
      item.workflow_status === "under_review";
    const isOverdue = !isPaid && new Date(item.due_date) < new Date();

    if (isPaid)
      return (
        <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          Pago
        </span>
      );
    if (isDisputed)
      return (
        <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
          Contestação
        </span>
      );
    if (isAwaiting)
      return (
        <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
          Em análise
        </span>
      );
    if (isOverdue)
      return (
        <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
          Vencido
        </span>
      );
    return (
      <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
        Em aberto
      </span>
    );
  }, []);

  // FIX 3: Validação de tamanho de arquivo aplicada antes do upload
  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `O arquivo "${file.name}" excede o limite de 5MB.`;
    }
    return null;
  };

  const handleReportPayment = async () => {
    if (!selectedTransaction || submitting) return;
    const amountNum = parseCurrencyToNumber(paymentForm.amount);
    if (amountNum <= 0 || !paymentForm.message.trim()) {
      showToast("Preencha o valor e a descrição do pagamento.", "error");
      return;
    }

    // FIX 3: Valida tamanho do comprovante antes de iniciar o submit
    if (paymentFile) {
      const fileError = validateFile(paymentFile);
      if (fileError) {
        showToast(fileError, "error");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("financial_transaction_events")
        .insert({
          financial_transaction_id: selectedTransaction.id,
          author_id: currentUserId,
          author_type: "client",
          visibility: "shared",
          event_type: "payment_reported",
          title: "Notificação de Pagamento Realizado",
          message: paymentForm.message.trim(),
          metadata: {
            valor: amountNum,
            forma_pagamento: paymentForm.method,
            referencia: paymentForm.reference || null,
          },
        })
        .select("id")
        .single();

      if (eventError) throw eventError;

      if (paymentFile) {
        const path = `financial/${resolvedClientId}/${selectedTransaction.id}/${Date.now()}-${paymentFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, paymentFile);
        if (uploadError) throw uploadError;
        await supabase.from("financial_transaction_attachments").insert({
          financial_transaction_id: selectedTransaction.id,
          event_id: eventData.id,
          uploaded_by: currentUserId,
          uploaded_by_type: "client",
          visibility: "shared",
          attachment_type: "receipt",
          file_name: paymentFile.name,
          file_path: path,
          mime_type: paymentFile.type,
          file_size: paymentFile.size,
        });
      }

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status: "awaiting_finance",
          payment_reported_amount: amountNum,
          payment_reported_method: paymentForm.method,
          payment_reported_reference: paymentForm.reference || null,
          payment_reported_at: now,
          customer_last_action_at: now,
          last_interaction_at: now,
        })
        .eq("id", selectedTransaction.id);

      if (updateError) throw updateError;

      showToast("Notificação de pagamento enviada com sucesso.", "success");
      setOpenActionPanel(null);
      setPaymentForm({ amount: "", method: "pix", reference: "", message: "" });
      setPaymentFile(null);
      await fetchTransactions();
      await fetchDetails(selectedTransaction.id);
    } catch (error: any) {
      showToast(error.message || "Erro ao enviar notificação.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!selectedTransaction || submitting) return;
    if (!disputeForm.reason.trim() || !disputeForm.message.trim()) {
      showToast("Preencha o motivo e a descrição da contestação.", "error");
      return;
    }

    // FIX 3: Valida tamanho da evidência antes de iniciar o submit
    if (disputeFile) {
      const fileError = validateFile(disputeFile);
      if (fileError) {
        showToast(fileError, "error");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("financial_transaction_events")
        .insert({
          financial_transaction_id: selectedTransaction.id,
          author_id: currentUserId,
          author_type: "client",
          visibility: "shared",
          event_type: "dispute_opened",
          title: "Abertura de Contestação Formal",
          message: disputeForm.message.trim(),
          metadata: {
            categoria: disputeForm.category,
            motivo: disputeForm.reason.trim(),
          },
        })
        .select("id")
        .single();

      if (eventError) throw eventError;

      if (disputeFile) {
        const path = `financial/${resolvedClientId}/${selectedTransaction.id}/${Date.now()}-${disputeFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, disputeFile);
        if (uploadError) throw uploadError;
        await supabase.from("financial_transaction_attachments").insert({
          financial_transaction_id: selectedTransaction.id,
          event_id: eventData.id,
          uploaded_by: currentUserId,
          uploaded_by_type: "client",
          visibility: "shared",
          attachment_type: "dispute_evidence",
          file_name: disputeFile.name,
          file_path: path,
          mime_type: disputeFile.type,
          file_size: disputeFile.size,
        });
      }

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status: "disputed",
          dispute_status: "open",
          dispute_category: disputeForm.category,
          dispute_reason: disputeForm.reason.trim(),
          customer_last_action_at: now,
          last_interaction_at: now,
        })
        .eq("id", selectedTransaction.id);

      if (updateError) throw updateError;

      showToast("Contestação formal registrada com sucesso.", "success");
      setOpenActionPanel(null);
      setDisputeForm({ category: "amount_divergence", reason: "", message: "" });
      setDisputeFile(null);
      await fetchTransactions();
      await fetchDetails(selectedTransaction.id);
    } catch (error: any) {
      showToast(error.message || "Erro ao registrar contestação.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // FIX 1: resolveAttachmentUrls sem signedUrls nas dependências — usa setState funcional
  useEffect(() => {
    if (attachments.length === 0) return;

    const loadUrls = async () => {
      const nextMap: Record<string, string> = {};
      const pending = attachments.filter((file) => file.file_path);

      await Promise.all(
        pending.map(async (file) => {
          const { data } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(file.file_path, 3600);
          if (data?.signedUrl) nextMap[file.id] = data.signedUrl;
        })
      );

      if (Object.keys(nextMap).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...nextMap }));
      }
    };

    void loadUrls();
  }, [attachments]);

  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectPreviousItem = () => {
    if (selectedGroup && selectedIndexInGroup > 0)
      setSelectedId(selectedGroup.items[selectedIndexInGroup - 1].id);
  };

  const selectNextItem = () => {
    if (selectedGroup && selectedIndexInGroup < selectedGroup.items.length - 1)
      setSelectedId(selectedGroup.items[selectedIndexInGroup + 1].id);
  };

  // FIX 7: Exibição segura de parcela — nunca exibe "/"
  const formatInstallmentLabel = (item: FinancialTransaction, groupLength: number) => {
    const num = item.installment_number;
    const total = item.total_installments ?? groupLength;
    if (!num && total <= 1) return null;
    return `Parcela: ${num ?? 1}/${total}`;
  };

  return (
    <main className="min-h-screen bg-[#0b0d12] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
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
          <header className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex flex-col gap-5 p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                      style={{
                        borderColor: `${brandColor}40`,
                        backgroundColor: `${brandColor}14`,
                        color: brandColor,
                      }}
                    >
                      <CreditCard size={14} />
                      {brandName}
                    </div>
                    {unreadNotifications > 0 && (
                      <div className="flex items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-400 animate-pulse">
                        <Bell size={14} />
                        {unreadNotifications} Atualizações
                      </div>
                    )}
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {invoicePlural}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
                    Gestão financeira centralizada. Acompanhe liquidações, anexe comprovantes
                    oficiais e registre contestações formais pelo portal do{" "}
                    {clientSingular.toLowerCase()}.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                      Em aberto
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {currency(summary.totalOpen)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Pagos</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-300">
                      {currency(summary.totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                      Vencidos
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-red-300">
                      {currency(summary.totalOverdue)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {loading ? (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-12 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-center gap-3 text-zinc-300">
                <Loader2 className="animate-spin" size={22} />
                Sincronizando {invoicePlural.toLowerCase()}...
              </div>
            </section>
          ) : groupedInvoices.length === 0 ? (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-10 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
              <FileText className="mx-auto mb-4 text-zinc-500" size={44} />
              <h2 className="text-xl font-semibold text-white">Nenhuma cobrança encontrada</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Não há registros financeiros vinculados ao seu cadastro.
              </p>
            </section>
          ) : (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              {/* Sidebar */}
              <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                <div className="border-b border-white/10 px-5 py-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                    Cobranças
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {summary.totalGroups} Grupos · {summary.totalCount} Itens
                  </p>
                </div>
                <div className="max-h-[78vh] overflow-y-auto">
                  {groupedInvoices.map((group) => {
                    const isExpanded = expandedGroups[group.id];
                    const hasSelected = group.items.some((i) => i.id === selectedId);
                    return (
                      <div key={group.id} className="border-b border-white/8 last:border-b-0">
                        <button
                          onClick={() =>
                            group.items.length > 1
                              ? toggleGroup(group.id)
                              : setSelectedId(group.items[0].id)
                          }
                          className={`w-full px-5 py-4 text-left transition ${
                            hasSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.035]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="line-clamp-2 text-sm font-semibold text-white">
                                  {group.title}
                                </p>
                                {group.sourceLabel && (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-zinc-400">
                                    {group.sourceLabel}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-xs text-zinc-400">
                                Doc: {group.documentNumber || "-"}
                              </p>
                              <p className="mt-1 text-xs text-zinc-400">
                                {group.items.length > 1
                                  ? `${group.items.length} parcelas`
                                  : `Venc: ${formatDate(group.items[0].due_date)}`}
                              </p>
                            </div>
                            {group.items.length > 1 &&
                              (isExpanded ? (
                                <ChevronDown size={18} className="text-zinc-500" />
                              ) : (
                                <ChevronRight size={18} className="text-zinc-500" />
                              ))}
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <p className="text-base font-semibold text-white">
                              {currency(group.totalAmount)}
                            </p>
                            {group.items.length === 1 ? (
                              getStatusBadge(group.items[0])
                            ) : (
                              <span className="text-xs font-bold text-zinc-500">
                                {group.items.length} parcelas
                              </span>
                            )}
                          </div>
                        </button>
                        {isExpanded && group.items.length > 1 && (
                          <div className="border-t border-white/8 bg-black/10">
                            {group.items.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedId(item.id)}
                                className={`flex w-full items-center justify-between border-b border-white/6 px-5 py-3 text-left transition last:border-b-0 ${
                                  selectedId === item.id
                                    ? "bg-white/[0.08]"
                                    : "hover:bg-white/[0.035]"
                                }`}
                              >
                                <div className="min-w-0">
                                  {/* FIX 7: label segura de parcela */}
                                  <p className="text-sm font-semibold text-white">
                                    {item.installment_number != null && item.total_installments != null
                                      ? `Parcela ${item.installment_number}/${item.total_installments}`
                                      : item.description}
                                  </p>
                                  <p className="text-xs text-zinc-400">
                                    {formatDate(item.due_date)}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-sm font-semibold text-white">
                                    {currency(item.amount)}
                                  </span>
                                  {getStatusBadge(item)}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>

              {/* Área de Detalhes */}
              <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                {!selectedTransaction ? (
                  <div className="p-8 text-sm text-zinc-400 italic">
                    Selecione uma cobrança para visualizar os detalhes.
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    <div className="border-b border-white/10 p-6 sm:p-7">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <h2 className="text-2xl font-semibold tracking-tight text-white">
                            {selectedGroup?.title || selectedTransaction.description}
                          </h2>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-400 font-medium">
                            <span className="flex items-center gap-1.5">
                              <FileText size={14} /> Doc:{" "}
                              {selectedTransaction.document_number || "-"}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CircleDollarSign size={14} /> Vencimento:{" "}
                              {formatDate(selectedTransaction.due_date)}
                            </span>
                            {/* FIX 7: exibe parcela apenas se os dados existirem */}
                            {formatInstallmentLabel(
                              selectedTransaction,
                              selectedGroupItems.length
                            ) && (
                              <span className="flex items-center gap-1.5">
                                <CreditCard size={14} />
                                {formatInstallmentLabel(
                                  selectedTransaction,
                                  selectedGroupItems.length
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-start gap-3 xl:items-end">
                          <p className="text-3xl font-semibold text-white">
                            {currency(selectedTransaction.amount)}
                          </p>
                          <div>{getStatusBadge(selectedTransaction)}</div>
                        </div>
                      </div>
                      {selectedGroupItems.length > 1 && (
                        <div className="mt-5 flex items-center gap-3">
                          <button
                            onClick={selectPreviousItem}
                            disabled={selectedIndexInGroup <= 0}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-40"
                          >
                            <ChevronLeft size={16} /> Anterior
                          </button>
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-300">
                            Parcela {selectedIndexInGroup + 1} de {selectedGroupItems.length}
                          </div>
                          <button
                            onClick={selectNextItem}
                            disabled={selectedIndexInGroup >= selectedGroupItems.length - 1}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-40"
                          >
                            Próxima <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-6 p-6 sm:p-7 2xl:grid-cols-[minmax(0,1fr)_360px]">
                      <div className="space-y-6">
                        {/* Resumo */}
                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                            Resumo da Cobrança
                          </h3>
                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                Status Financeiro
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {translateFinancialStatus(selectedTransaction.status)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                Fluxo de Trabalho
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {translateWorkflowStatus(selectedTransaction.workflow_status)}
                              </p>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                Observações do Financeiro
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-white">
                                {selectedTransaction.resolution_notes ||
                                  selectedTransaction.invoice_notes ||
                                  "-"}
                              </p>
                            </div>
                          </div>
                        </section>

                        {/* Timeline */}
                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                              Histórico de Interações
                            </h3>
                            {detailLoading && (
                              <Loader2 className="animate-spin text-zinc-500" size={18} />
                            )}
                          </div>
                          <div className="space-y-3">
                            {events.length === 0 ? (
                              <p className="text-sm text-zinc-500 italic">
                                Nenhuma interação registrada.
                              </p>
                            ) : (
                              events.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <p className="font-semibold text-sm text-white">
                                      {ev.title || translateEventType(ev.event_type)}
                                    </p>
                                    <span className="text-[10px] text-zinc-500">
                                      {formatDateTime(ev.created_at)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[10px] uppercase font-bold text-zinc-600">
                                    Autor:{" "}
                                    {ev.author_type === "client" ? clientSingular : "Financeiro"}
                                  </p>
                                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                                    {ev.message}
                                  </p>
                                  {ev.metadata && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {Object.entries(ev.metadata).map(([k, v]) => (
                                        <div
                                          key={k}
                                          className="rounded-lg bg-black/30 px-3 py-1.5 border border-white/5"
                                        >
                                          <span className="block text-[9px] font-black uppercase text-zinc-600">
                                            {formatMetadataLabel(k)}
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {formatMetadataValue(k, v)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </section>

                        {/* Anexos */}
                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                            Anexos e Documentos
                          </h3>
                          <div className="mt-4 space-y-3">
                            {attachments.length === 0 ? (
                              <p className="text-sm text-zinc-500 italic">
                                Nenhum anexo disponível.
                              </p>
                            ) : (
                              attachments.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">
                                      {file.file_name}
                                    </p>
                                    <p className="text-[10px] uppercase font-bold text-zinc-600">
                                      {file.attachment_type} · {formatDateTime(file.created_at)}
                                    </p>
                                  </div>
                                  {signedUrls[file.id] ? (
                                    <a
                                      href={signedUrls[file.id]}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/5 px-4 text-xs font-bold transition hover:bg-white/10"
                                    >
                                      <Paperclip size={14} /> Abrir
                                    </a>
                                  ) : (
                                    <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/5 px-4 text-xs font-bold opacity-40">
                                      <Loader2 className="animate-spin" size={14} /> Carregando
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </section>
                      </div>

                      {/* Painéis de Ação */}
                      <aside className="space-y-4">
                        {/* Notificar Pagamento */}
                        <div
                          className={`rounded-[24px] border transition ${
                            openActionPanel === "payment"
                              ? "border-emerald-500/30 bg-emerald-500/10"
                              : "border-white/10 bg-white/[0.04]"
                          }`}
                        >
                          <button
                            onClick={() =>
                              setOpenActionPanel((p) => (p === "payment" ? null : "payment"))
                            }
                            className="flex w-full items-center justify-between p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                                <CheckCircle2 size={20} />
                              </div>
                              <div className="text-left">
                                <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
                                  Notificar Pagamento
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                  Informar liquidação desta parcela
                                </p>
                              </div>
                            </div>
                            <ChevronDown
                              size={18}
                              className={`text-zinc-500 transition ${
                                openActionPanel === "payment" ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {openActionPanel === "payment" && (
                            <div className="p-5 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Valor Pago
                                </label>
                                <input
                                  type="text"
                                  value={paymentForm.amount}
                                  onChange={(e) =>
                                    setPaymentForm((p) => ({
                                      ...p,
                                      amount: handleCurrencyInput(e.target.value),
                                    }))
                                  }
                                  placeholder="R$ 0,00"
                                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-emerald-500/50"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Forma de Pagamento
                                </label>
                                <select
                                  value={paymentForm.method}
                                  onChange={(e) =>
                                    setPaymentForm((p) => ({ ...p, method: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-emerald-500/50 appearance-none"
                                >
                                  <option value="pix">PIX</option>
                                  <option value="boleto">Boleto</option>
                                  <option value="transferencia">Transferência</option>
                                  <option value="cartao">Cartão</option>
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Referência / Comprovante
                                </label>
                                <input
                                  type="text"
                                  value={paymentForm.reference}
                                  onChange={(e) =>
                                    setPaymentForm((p) => ({ ...p, reference: e.target.value }))
                                  }
                                  placeholder="Código, ID da transação..."
                                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-emerald-500/50"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Mensagem Adicional
                                </label>
                                <textarea
                                  value={paymentForm.message}
                                  onChange={(e) =>
                                    setPaymentForm((p) => ({ ...p, message: e.target.value }))
                                  }
                                  className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-medium outline-none focus:border-emerald-500/50"
                                />
                              </div>
                              <div className="space-y-1.5">
                                {/* FIX 3: Exibe erro de tamanho antes de aceitar o arquivo */}
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/20 p-4 transition hover:bg-black/40">
                                  <Upload size={16} className="text-zinc-500" />
                                  <span className="truncate text-xs font-bold text-zinc-400">
                                    {paymentFile ? paymentFile.name : "Anexar Comprovante"}
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      if (file) {
                                        const err = validateFile(file);
                                        if (err) {
                                          showToast(err, "error");
                                          e.target.value = "";
                                          return;
                                        }
                                      }
                                      setPaymentFile(file);
                                    }}
                                  />
                                </label>
                                <p className="text-[10px] text-zinc-600">
                                  Máx. 5MB · PDF, JPG, PNG
                                </p>
                              </div>
                              <button
                                onClick={handleReportPayment}
                                disabled={submitting}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 p-4 text-xs font-black uppercase tracking-widest transition hover:bg-emerald-500 disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                              >
                                {submitting ? (
                                  <Loader2 className="animate-spin" size={16} />
                                ) : (
                                  "Confirmar Notificação"
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* FIX 6: Contestação com todas as 7 categorias sincronizadas */}
                        <div
                          className={`rounded-[24px] border transition ${
                            openActionPanel === "dispute"
                              ? "border-orange-500/30 bg-orange-500/10"
                              : "border-white/10 bg-white/[0.04]"
                          }`}
                        >
                          <button
                            onClick={() =>
                              setOpenActionPanel((p) => (p === "dispute" ? null : "dispute"))
                            }
                            className="flex w-full items-center justify-between p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
                                <AlertTriangle size={20} />
                              </div>
                              <div className="text-left">
                                <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
                                  Registrar Contestação
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                  Divergência de valores ou prazos
                                </p>
                              </div>
                            </div>
                            <ChevronDown
                              size={18}
                              className={`text-zinc-500 transition ${
                                openActionPanel === "dispute" ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {openActionPanel === "dispute" && (
                            <div className="p-5 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Categoria
                                </label>
                                <select
                                  value={disputeForm.category}
                                  onChange={(e) =>
                                    setDisputeForm((p) => ({ ...p, category: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-orange-500/50 appearance-none"
                                >
                                  <option value="amount_divergence">Valor divergente</option>
                                  <option value="duplicate_charge">Cobrança duplicada</option>
                                  <option value="service_not_delivered">
                                    Serviço não entregue
                                  </option>
                                  <option value="wrong_due_date">Data incorreta</option>
                                  <option value="wrong_document">Documento incorreto</option>
                                  <option value="unknown_charge">Cobrança desconhecida</option>
                                  <option value="other">Outro</option>
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Motivo Resumido
                                </label>
                                <input
                                  type="text"
                                  value={disputeForm.reason}
                                  onChange={(e) =>
                                    setDisputeForm((p) => ({ ...p, reason: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-orange-500/50"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Detalhamento
                                </label>
                                <textarea
                                  value={disputeForm.message}
                                  onChange={(e) =>
                                    setDisputeForm((p) => ({ ...p, message: e.target.value }))
                                  }
                                  className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-medium outline-none focus:border-orange-500/50"
                                />
                              </div>
                              <div className="space-y-1.5">
                                {/* FIX 3: Valida tamanho da evidência no input */}
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/20 p-4 transition hover:bg-black/40">
                                  <Upload size={16} className="text-zinc-500" />
                                  <span className="truncate text-xs font-bold text-zinc-400">
                                    {disputeFile ? disputeFile.name : "Anexar Evidência"}
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      if (file) {
                                        const err = validateFile(file);
                                        if (err) {
                                          showToast(err, "error");
                                          e.target.value = "";
                                          return;
                                        }
                                      }
                                      setDisputeFile(file);
                                    }}
                                  />
                                </label>
                                <p className="text-[10px] text-zinc-600">
                                  Máx. 5MB · PDF, JPG, PNG
                                </p>
                              </div>
                              <button
                                onClick={handleOpenDispute}
                                disabled={submitting}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 p-4 text-xs font-black uppercase tracking-widest transition hover:bg-orange-500 disabled:opacity-50 shadow-lg shadow-orange-900/20"
                              >
                                {submitting ? (
                                  <Loader2 className="animate-spin" size={16} />
                                ) : (
                                  "Abrir Contestação Formal"
                                )}
                              </button>
                            </div>
                          )}
                        </div>
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