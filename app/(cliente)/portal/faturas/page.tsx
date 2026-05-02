"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useSettings } from "../../../providers/SettingsProvider";
import {
  AlertTriangle,
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
  Search,
  Upload,
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
  metadata: Record<string, any> | null;
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
  items: FinancialTransaction[];
};

type ActionPanel = "payment" | "dispute" | null;
type FilterStatus = "all" | "open" | "paid" | "overdue" | "analysis" | "disputed";

const STORAGE_BUCKET = "files-main";

function safeDate(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function stripInstallmentSuffix(description: string | null | undefined) {
  return (description || "Fatura")
    .replace(/[-–—]?\s*parcela\s*\d+\s*\/\s*\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoneyInput(value: string) {
  if (!value) return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatFileSize(size: number | null) {
  if (!size || size <= 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isBucketNotFoundMessage(message: string | undefined | null) {
  const text = normalizeText(message);
  return (
    text.includes("bucket not found") ||
    text.includes("bucket nao encontrado") ||
    text.includes("bucket não encontrado") ||
    text.includes("not found")
  );
}

export default function PortalFaturasPage() {
  const { resolvedClientId, systemPreferences } = useSettings();

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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [attachmentErrors, setAttachmentErrors] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activePanel, setActivePanel] = useState<ActionPanel>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [storageWarning, setStorageWarning] = useState<string>("");

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
  const clientSingular = labels?.entity_client_singular || "Cliente";

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToast({ text, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast({ type: "success", text: "" });
    }, 4000);
  }, []);

  const currency = useCallback(
    (value: number | null | undefined) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(value || 0)),
    []
  );

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

  const getItemComputedState = useCallback((item: FinancialTransaction) => {
    const status = item.status || "pending";
    const isPaid =
      status === "paid" ||
      status === "received" ||
      item.workflow_status === "confirmed" ||
      !!item.payment_date ||
      !!item.payment_confirmed_at;

    const isDisputed =
      !!item.dispute_status &&
      item.dispute_status !== "none" &&
      item.dispute_status !== "resolved" &&
      item.workflow_status !== "resolved";

    const isAwaitingFinance =
      item.workflow_status === "awaiting_finance" || item.workflow_status === "under_review";

    const isCancelled = status === "cancelled" || item.workflow_status === "cancelled";
    const isOverdue = !isPaid && !isCancelled && safeDate(item.due_date) < new Date().setHours(0, 0, 0, 0);

    return {
      isPaid,
      isDisputed,
      isAwaitingFinance,
      isCancelled,
      isOverdue,
    };
  }, []);

  const getStatusTone = useCallback(
    (item: FinancialTransaction) => {
      const { isPaid, isDisputed, isAwaitingFinance, isCancelled, isOverdue } = getItemComputedState(item);

      if (isPaid) {
        return {
          label: "Pago",
          className: "border-cs-green/20 bg-cs-green/10 text-cs-green",
        };
      }

      if (isDisputed) {
        return {
          label: "Contestação",
          className: "border-orange-500/20 bg-orange-500/10 text-orange-300",
        };
      }

      if (isAwaitingFinance) {
        return {
          label: "Em análise",
          className: "border-cs-gold/20 bg-cs-gold/10 text-cs-gold",
        };
      }

      if (isCancelled) {
        return {
          label: "Cancelado",
          className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
        };
      }

      if (isOverdue) {
        return {
          label: "Vencido",
          className: "border-red-500/20 bg-red-500/10 text-red-300",
        };
      }

      return {
        label: "Em aberto",
        className: "border-white/10 bg-white/5 text-zinc-200",
      };
    },
    [getItemComputedState]
  );

  const renderStatusBadge = useCallback(
    (item: FinancialTransaction) => {
      const tone = getStatusTone(item);

      return (
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tone.className}`}>
          {tone.label}
        </span>
      );
    },
    [getStatusTone]
  );

  const getGroupStatusLabel = useCallback(
    (items: FinancialTransaction[]) => {
      const paidCount = items.filter((item) => getItemComputedState(item).isPaid).length;
      const disputedCount = items.filter((item) => getItemComputedState(item).isDisputed).length;
      const analysisCount = items.filter((item) => getItemComputedState(item).isAwaitingFinance).length;
      const overdueCount = items.filter((item) => getItemComputedState(item).isOverdue).length;

      if (paidCount === items.length) {
        return {
          label: "Pago integral",
          className: "border-cs-green/20 bg-cs-green/10 text-cs-green",
        };
      }

      if (disputedCount > 0) {
        return {
          label: "Com contestação",
          className: "border-orange-500/20 bg-orange-500/10 text-orange-300",
        };
      }

      if (analysisCount > 0) {
        return {
          label: "Em análise",
          className: "border-cs-gold/20 bg-cs-gold/10 text-cs-gold",
        };
      }

      if (overdueCount > 0) {
        return {
          label: "Com atraso",
          className: "border-red-500/20 bg-red-500/10 text-red-300",
        };
      }

      return {
        label: "Em aberto",
        className: "border-white/10 bg-white/5 text-zinc-200",
      };
    },
    [getItemComputedState]
  );

  const buildGroupKey = useCallback((item: FinancialTransaction) => {
    const totalInstallments = item.total_installments || 1;
    const installmentMarker = totalInstallments > 1 ? `parcelado:${totalInstallments}` : "unico";
    const normalizedDescription = stripInstallmentSuffix(item.description);
    const dueMonth = item.due_date ? item.due_date.slice(0, 7) : "sem-data";

    if (item.service_order_id) {
      return `service_order:${item.service_order_id}:${normalizedDescription}:${installmentMarker}`;
    }

    if (item.quote_id) {
      return `quote:${item.quote_id}:${normalizedDescription}:${installmentMarker}`;
    }

    if (item.document_number) {
      return `document:${item.document_number}:${normalizedDescription}:${installmentMarker}`;
    }

    return `fallback:${normalizedDescription}:${Number(item.amount || 0).toFixed(2)}:${installmentMarker}:${dueMonth}`;
  }, []);

  const sortInstallments = useCallback((items: FinancialTransaction[]) => {
    return [...items].sort((a, b) => {
      const installmentDiff = Number(a.installment_number || 0) - Number(b.installment_number || 0);
      if (installmentDiff !== 0) return installmentDiff;

      const dueDiff = safeDate(a.due_date) - safeDate(b.due_date);
      if (dueDiff !== 0) return dueDiff;

      return safeDate(a.created_at) - safeDate(b.created_at);
    });
  }, []);

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
      .select(
        `
        id,
        description,
        type,
        category,
        amount,
        status,
        due_date,
        payment_date,
        created_at,
        notes,
        client_id,
        quote_id,
        service_order_id,
        installment_number,
        total_installments,
        payment_method,
        attachment_url,
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
        resolution_notes
      `
      )
      .eq("client_id", resolvedClientId)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setTransactions([]);
      setLoading(false);
      showToast("Não foi possível carregar as faturas.", "error");
      return;
    }

    const rows = (data || []) as FinancialTransaction[];
    const uniqueRows = Array.from(new Map(rows.map((item) => [item.id, item])).values());

    setTransactions(uniqueRows);
    setLoading(false);
  }, [resolvedClientId, showToast]);

  const fetchDetails = useCallback(
    async (transactionId: string) => {
      setDetailLoading(true);

      const [eventsResult, attachmentsResult] = await Promise.all([
        supabase
          .from("financial_transaction_events")
          .select(
            "id, financial_transaction_id, author_id, author_type, visibility, event_type, title, message, metadata, created_at"
          )
          .eq("financial_transaction_id", transactionId)
          .eq("visibility", "shared")
          .order("created_at", { ascending: false }),
        supabase
          .from("financial_transaction_attachments")
          .select(
            "id, financial_transaction_id, event_id, uploaded_by, uploaded_by_type, visibility, attachment_type, file_name, file_path, file_url, mime_type, file_size, created_at"
          )
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
        const uniqueAttachments = Array.from(
          new Map(((attachmentsResult.data || []) as FinancialAttachment[]).map((item) => [item.id, item])).values()
        );
        setAttachments(uniqueAttachments);
      }

      setDetailLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const groupedInvoices = useMemo<InvoiceGroup[]>(() => {
    const map = new Map<string, InvoiceGroup>();

    for (const item of transactions) {
      const key = buildGroupKey(item);
      const normalizedTitle = stripInstallmentSuffix(item.description);

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title: normalizedTitle || "Fatura",
          documentNumber: item.document_number,
          totalAmount: 0,
          paidAmount: 0,
          openAmount: 0,
          earliestDueDate: item.due_date,
          latestDueDate: item.due_date,
          totalInstallments: item.total_installments || 1,
          items: [],
        });
      }

      const group = map.get(key)!;
      if (!group.items.some((existing) => existing.id === item.id)) {
        group.items.push(item);
      }

      group.totalAmount += Number(item.amount || 0);

      const { isPaid } = getItemComputedState(item);
      if (isPaid) {
        group.paidAmount += Number(item.amount || 0);
      } else {
        group.openAmount += Number(item.amount || 0);
      }

      if (safeDate(item.due_date) < safeDate(group.earliestDueDate)) group.earliestDueDate = item.due_date;
      if (safeDate(item.due_date) > safeDate(group.latestDueDate)) group.latestDueDate = item.due_date;
      if ((item.total_installments || 1) > group.totalInstallments) group.totalInstallments = item.total_installments || 1;
      if (!group.documentNumber && item.document_number) group.documentNumber = item.document_number;
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        items: sortInstallments(group.items),
      }))
      .sort((a, b) => safeDate(a.earliestDueDate) - safeDate(b.earliestDueDate));
  }, [transactions, buildGroupKey, sortInstallments, getItemComputedState]);

  const filteredGroups = useMemo(() => {
    const term = normalizeText(searchTerm);

    return groupedInvoices.filter((group) => {
      const searchable = normalizeText(
        [group.title, group.documentNumber, ...group.items.map((item) => item.description)].join(" ")
      );

      const matchesSearch = !term || searchable.includes(term);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : group.items.some((item) => {
              const state = getItemComputedState(item);

              if (statusFilter === "paid") return state.isPaid;
              if (statusFilter === "overdue") return state.isOverdue;
              if (statusFilter === "analysis") return state.isAwaitingFinance;
              if (statusFilter === "disputed") return state.isDisputed;
              if (statusFilter === "open") {
                return !state.isPaid && !state.isOverdue && !state.isAwaitingFinance && !state.isDisputed;
              }

              return true;
            });

      return matchesSearch && matchesStatus;
    });
  }, [groupedInvoices, searchTerm, statusFilter, getItemComputedState]);

  useEffect(() => {
    if (filteredGroups.length === 0) {
      setSelectedId(null);
      setEvents([]);
      setAttachments([]);
      return;
    }

    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const group of filteredGroups) {
        if (next[group.id] === undefined) {
          next[group.id] = group.items.length === 1;
        }
      }
      return next;
    });

    const allIds = filteredGroups.flatMap((group) => group.items.map((item) => item.id));
    if (!selectedId || !allIds.includes(selectedId)) {
      setSelectedId(filteredGroups[0].items[0].id);
    }
  }, [filteredGroups, selectedId]);

  useEffect(() => {
    if (selectedId) {
      fetchDetails(selectedId);
    }
  }, [selectedId, fetchDetails]);

  const selectedTransaction = useMemo(
    () => transactions.find((item) => item.id === selectedId) || null,
    [transactions, selectedId]
  );

  const selectedGroup = useMemo(
    () => filteredGroups.find((group) => group.items.some((item) => item.id === selectedId)) || null,
    [filteredGroups, selectedId]
  );

  const selectedGroupIndex = useMemo(() => {
    if (!selectedGroup || !selectedId) return -1;
    return selectedGroup.items.findIndex((item) => item.id === selectedId);
  }, [selectedGroup, selectedId]);

  const previousItem = selectedGroupIndex > 0 ? selectedGroup?.items[selectedGroupIndex - 1] : null;
  const nextItem =
    selectedGroup && selectedGroupIndex >= 0 && selectedGroupIndex < selectedGroup.items.length - 1
      ? selectedGroup.items[selectedGroupIndex + 1]
      : null;

  const summary = useMemo(() => {
    const open = transactions.filter((item) => !getItemComputedState(item).isPaid);
    const paid = transactions.filter((item) => getItemComputedState(item).isPaid);
    const overdue = transactions.filter((item) => getItemComputedState(item).isOverdue);

    return {
      totalOpen: open.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      totalPaid: paid.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      totalOverdue: overdue.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      totalGroups: groupedInvoices.length,
    };
  }, [transactions, groupedInvoices.length, getItemComputedState]);

  const uploadFile = useCallback(
    async (file: File, transactionId: string, attachmentType: string) => {
      if (!resolvedClientId) {
        throw new Error("Cliente não identificado para envio do arquivo.");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `financial/${resolvedClientId}/${transactionId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) {
        if (isBucketNotFoundMessage(uploadError.message)) {
          setStorageWarning("O bucket de arquivos ainda não está configurado. O envio de anexos foi desativado até a configuração do storage.");
          throw new Error("O bucket de arquivos não foi encontrado. O comprovante/anexo não pôde ser enviado.");
        }

        throw new Error(uploadError.message || "Erro ao enviar arquivo.");
      }

      return {
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size || null,
        attachment_type: attachmentType,
      };
    },
    [resolvedClientId]
  );

  const refreshAll = useCallback(
    async (transactionId: string) => {
      await fetchTransactions();
      setSelectedId(transactionId);
      await fetchDetails(transactionId);
    },
    [fetchTransactions, fetchDetails]
  );

  const handleReportPayment = useCallback(async () => {
    if (!selectedTransaction) return;

    const parsedAmount = parseMoneyInput(paymentForm.amount);

    if (!parsedAmount || !paymentForm.method || !paymentForm.message.trim()) {
      showToast("Preencha valor, forma de pagamento e mensagem.", "error");
      return;
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
          title: "Pagamento informado pelo cliente",
          message: paymentForm.message.trim(),
          metadata: {
            valor: parsedAmount,
            forma_pagamento: paymentForm.method,
            referencia: paymentForm.reference || null,
          },
        })
        .select("id")
        .single();

      if (eventError || !eventData) {
        throw new Error(eventError?.message || "Erro ao registrar pagamento.");
      }

      if (paymentFile) {
        const uploaded = await uploadFile(paymentFile, selectedTransaction.id, "receipt");

        const { error: attachmentError } = await supabase.from("financial_transaction_attachments").insert({
          financial_transaction_id: selectedTransaction.id,
          event_id: eventData.id,
          uploaded_by: currentUserId,
          uploaded_by_type: "client",
          visibility: "shared",
          attachment_type: uploaded.attachment_type,
          file_name: uploaded.file_name,
          file_path: uploaded.file_path,
          mime_type: uploaded.mime_type,
          file_size: uploaded.file_size,
        });

        if (attachmentError) {
          throw new Error(attachmentError.message || "Erro ao salvar comprovante.");
        }
      }

      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status: "awaiting_finance",
          payment_reported_amount: parsedAmount,
          payment_reported_method: paymentForm.method,
          payment_reported_reference: paymentForm.reference || null,
          payment_reported_at: now,
          customer_last_action_at: now,
          last_interaction_at: now,
        })
        .eq("id", selectedTransaction.id);

      if (updateError) {
        throw new Error(updateError.message || "Erro ao atualizar cobrança.");
      }

      setPaymentForm({ amount: "", method: "pix", reference: "", message: "" });
      setPaymentFile(null);
      setActivePanel(null);
      showToast("Pagamento informado com sucesso.", "success");
      await refreshAll(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao informar pagamento.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedTransaction,
    paymentForm,
    showToast,
    currentUserId,
    paymentFile,
    uploadFile,
    refreshAll,
  ]);

  const handleOpenDispute = useCallback(async () => {
    if (!selectedTransaction) return;

    if (!disputeForm.reason.trim() || !disputeForm.message.trim()) {
      showToast("Preencha o motivo e a descrição da contestação.", "error");
      return;
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
          title: "Contestação aberta pelo cliente",
          message: disputeForm.message.trim(),
          metadata: {
            categoria: disputeForm.category,
            motivo: disputeForm.reason.trim(),
          },
        })
        .select("id")
        .single();

      if (eventError || !eventData) {
        throw new Error(eventError?.message || "Erro ao abrir contestação.");
      }

      if (disputeFile) {
        const uploaded = await uploadFile(disputeFile, selectedTransaction.id, "dispute_evidence");

        const { error: attachmentError } = await supabase.from("financial_transaction_attachments").insert({
          financial_transaction_id: selectedTransaction.id,
          event_id: eventData.id,
          uploaded_by: currentUserId,
          uploaded_by_type: "client",
          visibility: "shared",
          attachment_type: uploaded.attachment_type,
          file_name: uploaded.file_name,
          file_path: uploaded.file_path,
          mime_type: uploaded.mime_type,
          file_size: uploaded.file_size,
        });

        if (attachmentError) {
          throw new Error(attachmentError.message || "Erro ao salvar anexo da contestação.");
        }
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

      if (updateError) {
        throw new Error(updateError.message || "Erro ao atualizar contestação.");
      }

      setDisputeForm({ category: "amount_divergence", reason: "", message: "" });
      setDisputeFile(null);
      setActivePanel(null);
      showToast("Contestação registrada com sucesso.", "success");
      await refreshAll(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao abrir contestação.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedTransaction,
    disputeForm,
    currentUserId,
    disputeFile,
    uploadFile,
    showToast,
    refreshAll,
  ]);

  const resolveAttachmentUrls = useCallback(async () => {
    const pending = attachments.filter((file) => file.file_path && !signedUrls[file.id] && !attachmentErrors[file.id]);
    if (pending.length === 0) return;

    const nextMap: Record<string, string> = {};
    const nextErrors: Record<string, string> = {};

    await Promise.all(
      pending.map(async (file) => {
        const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.file_path, 3600);

        if (error) {
          if (isBucketNotFoundMessage(error.message)) {
            setStorageWarning("Os anexos não puderam ser carregados porque o bucket de arquivos não foi encontrado.");
            nextErrors[file.id] = "Arquivo indisponível no storage.";
            return;
          }

          nextErrors[file.id] = "Não foi possível carregar este anexo.";
          return;
        }

        if (data?.signedUrl) {
          nextMap[file.id] = data.signedUrl;
        } else {
          nextErrors[file.id] = "Não foi possível gerar o link do anexo.";
        }
      })
    );

    if (Object.keys(nextMap).length > 0) {
      setSignedUrls((prev) => ({ ...prev, ...nextMap }));
    }

    if (Object.keys(nextErrors).length > 0) {
      setAttachmentErrors((prev) => ({ ...prev, ...nextErrors }));
    }
  }, [attachments, signedUrls, attachmentErrors]);

  useEffect(() => {
    resolveAttachmentUrls();
  }, [resolveAttachmentUrls]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const handleSelectTransaction = useCallback(
    (transactionId: string, groupId?: string) => {
      setSelectedId(transactionId);
      if (groupId) {
        setExpandedGroups((prev) => ({ ...prev, [groupId]: true }));
      }
    },
    []
  );

  const toggleActionPanel = useCallback((panel: Exclude<ActionPanel, null>) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  return (
    <main className="min-h-screen bg-background p-4 text-white sm:p-6 xl:p-8">
      {toast.text ? (
        <div
          className={`fixed bottom-5 right-5 z-[100] max-w-md rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl ${
            toast.type === "success"
              ? "border-cs-green/40 bg-[#1a1413] text-cs-green"
              : "border-red-500/40 bg-[#1a1413] text-red-300"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-surface/60 bg-surface px-5 py-6 shadow-lg sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl">
                <CreditCard className="text-cs-gold" size={28} />
                Faturas
              </h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
                Acompanhe cobranças, visualize parcelas, informe pagamentos e registre contestações pelo portal do{" "}
                {clientSingular.toLowerCase()}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-surface/50 bg-background/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">Em aberto</p>
                <p className="mt-2 text-lg font-bold text-white">{currency(summary.totalOpen)}</p>
              </div>
              <div className="rounded-2xl border border-surface/50 bg-background/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">Pagos</p>
                <p className="mt-2 text-lg font-bold text-cs-green">{currency(summary.totalPaid)}</p>
              </div>
              <div className="rounded-2xl border border-surface/50 bg-background/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">Vencidos</p>
                <p className="mt-2 text-lg font-bold text-red-300">{currency(summary.totalOverdue)}</p>
              </div>
              <div className="rounded-2xl border border-surface/50 bg-background/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">Cobranças</p>
                <p className="mt-2 text-lg font-bold text-white">{summary.totalGroups}</p>
              </div>
            </div>
          </div>

          {storageWarning ? (
            <div className="mt-5 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
              {storageWarning}
            </div>
          ) : null}
        </header>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descrição ou documento"
              className="w-full rounded-2xl border border-surface/50 bg-surface py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-text-secondary focus:border-cs-gold/40"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="rounded-2xl border border-surface/50 bg-surface px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cs-gold/40"
          >
            <option value="all">Todas as situações</option>
            <option value="open">Em aberto</option>
            <option value="paid">Pagas</option>
            <option value="overdue">Vencidas</option>
            <option value="analysis">Em análise</option>
            <option value="disputed">Contestadas</option>
          </select>
        </section>

        {loading ? (
          <div className="flex justify-center rounded-3xl border border-surface/50 bg-surface py-20">
            <Loader2 className="animate-spin text-cs-gold" size={38} />
          </div>
        ) : filteredGroups.length === 0 ? (
          <section className="rounded-3xl border border-surface/50 bg-surface p-10 text-center shadow-lg">
            <FileText className="mx-auto mb-4 text-surface" size={44} />
            <h2 className="text-xl font-bold text-white">Nenhuma fatura encontrada</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Não há cobranças compatíveis com os filtros aplicados neste momento.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-3xl border border-surface/50 bg-surface shadow-lg">
              <div className="border-b border-surface/50 px-5 py-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Cobranças</h2>
              </div>

              <div className="max-h-[calc(100vh-230px)] overflow-y-auto">
                {filteredGroups.map((group) => {
                  const isExpanded = !!expandedGroups[group.id];
                  const hasMany = group.items.length > 1;
                  const hasSelected = group.items.some((item) => item.id === selectedId);
                  const groupStatus = getGroupStatusLabel(group.items);

                  return (
                    <div key={group.id} className="border-b border-surface/40 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasMany) {
                            toggleGroup(group.id);
                          } else {
                            handleSelectTransaction(group.items[0].id, group.id);
                          }
                        }}
                        className={`w-full px-5 py-4 text-left transition-colors hover:bg-background/30 ${
                          hasSelected ? "bg-background/20" : "bg-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-[15px] font-semibold text-white">{group.title}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              Documento: {group.documentNumber || "-"}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {hasMany
                                ? `${group.items.length} parcelas · De ${formatDate(group.earliestDueDate)} até ${formatDate(
                                    group.latestDueDate
                                  )}`
                                : `Vencimento: ${formatDate(group.items[0].due_date)}`}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`hidden rounded-full border px-2.5 py-1 text-[11px] font-bold sm:inline-flex ${groupStatus.className}`}
                            >
                              {groupStatus.label}
                            </span>

                            {hasMany ? (
                              isExpanded ? (
                                <ChevronDown className="text-text-secondary" size={18} />
                              ) : (
                                <ChevronRight className="text-text-secondary" size={18} />
                              )
                            ) : (
                              <ChevronRight className="text-text-secondary" size={18} />
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-white">{currency(group.totalAmount)}</span>

                          {hasMany ? (
                            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-zinc-200">
                              {group.paidAmount > 0
                                ? `${currency(group.paidAmount)} pago`
                                : `${group.items.length} parcelas`}
                            </span>
                          ) : (
                            renderStatusBadge(group.items[0])
                          )}
                        </div>
                      </button>

                      {hasMany && isExpanded ? (
                        <div className="border-t border-surface/30 bg-background/15">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectTransaction(item.id, group.id)}
                              className={`flex w-full items-center justify-between gap-3 border-b border-surface/20 px-5 py-3 text-left transition-colors hover:bg-background/30 last:border-b-0 ${
                                selectedId === item.id ? "bg-background/30" : "bg-transparent"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">
                                  Parcela {item.installment_number || 1}/{item.total_installments || group.items.length}
                                </p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  Vencimento: {formatDate(item.due_date)}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-3">
                                <span className="text-sm font-bold text-white">{currency(item.amount)}</span>
                                {renderStatusBadge(item)}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-3xl border border-surface/50 bg-surface shadow-lg">
              {!selectedTransaction ? (
                <div className="p-8 text-sm text-text-secondary">Selecione uma cobrança.</div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="border-b border-surface/50 p-5 sm:p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-bold text-white">
                          {selectedGroup?.title || stripInstallmentSuffix(selectedTransaction.description)}
                        </h2>

                        <div className="mt-3 flex flex-wrap gap-3 text-sm text-text-secondary">
                          <span>Documento: {selectedTransaction.document_number || "-"}</span>
                          <span>Vencimento: {formatDate(selectedTransaction.due_date)}</span>
                          <span>
                            Parcela:{" "}
                            {selectedTransaction.installment_number && selectedTransaction.total_installments
                              ? `${selectedTransaction.installment_number}/${selectedTransaction.total_installments}`
                              : "Única"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-3 xl:items-end">
                        <p className="text-3xl font-extrabold text-white">{currency(selectedTransaction.amount)}</p>
                        <div>{renderStatusBadge(selectedTransaction)}</div>
                      </div>
                    </div>

                    {selectedGroup && selectedGroup.items.length > 1 ? (
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => previousItem && setSelectedId(previousItem.id)}
                          disabled={!previousItem}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-surface/60 bg-background/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-background/50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronLeft size={16} />
                          Parcela anterior
                        </button>

                        <div className="rounded-xl border border-surface/60 bg-background/20 px-4 py-2 text-sm text-text-secondary">
                          Parcela {selectedGroupIndex + 1} de {selectedGroup.items.length}
                        </div>

                        <button
                          type="button"
                          onClick={() => nextItem && setSelectedId(nextItem.id)}
                          disabled={!nextItem}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-surface/60 bg-background/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-background/50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Próxima parcela
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-6">
                      <section className="rounded-2xl border border-surface/50 bg-background/25 p-5">
                        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Resumo</h3>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Status financeiro</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {translateFinancialStatus(selectedTransaction.status)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Workflow</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {translateWorkflowStatus(selectedTransaction.workflow_status)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Pagamento informado</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {selectedTransaction.payment_reported_at
                                ? formatDateTime(selectedTransaction.payment_reported_at)
                                : "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Pagamento confirmado</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {selectedTransaction.payment_confirmed_at
                                ? formatDateTime(selectedTransaction.payment_confirmed_at)
                                : "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Última ação do cliente</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {selectedTransaction.customer_last_action_at
                                ? formatDateTime(selectedTransaction.customer_last_action_at)
                                : "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Última ação do financeiro</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {selectedTransaction.finance_last_action_at
                                ? formatDateTime(selectedTransaction.finance_last_action_at)
                                : "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Categoria da contestação</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {translateDisputeCategory(selectedTransaction.dispute_category)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Motivo da contestação</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {selectedTransaction.dispute_reason || "-"}
                            </p>
                          </div>

                          <div className="md:col-span-2">
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Observações</p>
                            <p className="mt-1 text-sm leading-6 text-white">
                              {selectedTransaction.invoice_notes || selectedTransaction.notes || "-"}
                            </p>
                          </div>

                          <div className="md:col-span-2">
                            <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
                              Resultado / retorno do financeiro
                            </p>
                            <p className="mt-1 text-sm leading-6 text-white">
                              {selectedTransaction.resolution_notes || "-"}
                            </p>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-surface/50 bg-background/25 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Timeline</h3>
                          {detailLoading ? <Loader2 className="animate-spin text-cs-gold" size={18} /> : null}
                        </div>

                        <div className="mt-4 space-y-3">
                          {events.length === 0 ? (
                            <p className="text-sm text-text-secondary">Nenhuma interação registrada.</p>
                          ) : (
                            events.map((event) => (
                              <div key={event.id} className="rounded-xl border border-surface/50 bg-surface p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-semibold text-white">
                                    {event.title || translateEventType(event.event_type)}
                                  </p>
                                  <span className="text-xs text-text-secondary">{formatDateTime(event.created_at)}</span>
                                </div>

                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                                  {event.author_type === "client"
                                    ? "Cliente"
                                    : event.author_type === "finance"
                                    ? "Financeiro"
                                    : "Sistema"}
                                </p>

                                <p className="mt-3 text-sm leading-6 text-zinc-200">{event.message || "-"}</p>

                                {event.metadata && Object.keys(event.metadata).length > 0 ? (
                                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {Object.entries(event.metadata).map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="rounded-lg border border-surface/40 bg-background/30 px-3 py-2 text-xs text-text-secondary"
                                      >
                                        <span className="block uppercase tracking-[0.18em]">
                                          {key.replaceAll("_", " ")}
                                        </span>
                                        <span className="mt-1 block text-sm text-white">
                                          {typeof value === "number" && key.toLowerCase().includes("valor")
                                            ? currency(value)
                                            : String(value ?? "-")}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-surface/50 bg-background/25 p-5">
                        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Anexos</h3>

                        <div className="mt-4 space-y-3">
                          {attachments.length === 0 ? (
                            <p className="text-sm text-text-secondary">Nenhum anexo disponível.</p>
                          ) : (
                            attachments.map((file) => (
                              <div
                                key={file.id}
                                className="flex flex-col gap-3 rounded-xl border border-surface/50 bg-surface p-4 md:flex-row md:items-center md:justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-white">{file.file_name}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                                    {file.attachment_type} · {formatDateTime(file.created_at)} ·{" "}
                                    {formatFileSize(file.file_size)}
                                  </p>
                                </div>

                                <div className="flex gap-2">
                                  {signedUrls[file.id] ? (
                                    <a
                                      href={signedUrls[file.id]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-surface/50 bg-background px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-background/70"
                                    >
                                      <Paperclip size={16} />
                                      Abrir
                                    </a>
                                  ) : attachmentErrors[file.id] ? (
                                    <span className="inline-flex min-h-[44px] items-center rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">
                                      {attachmentErrors[file.id]}
                                    </span>
                                  ) : (
                                    <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-surface/50 bg-background px-4 py-2 text-sm font-semibold text-text-secondary">
                                      <Loader2 className="animate-spin" size={16} />
                                      Carregando
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>
                    </div>

                    <aside className="space-y-4">
                      <section className="rounded-2xl border border-surface/50 bg-background/20 p-4">
                        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Ações</h3>

                        <div className="mt-4 space-y-3">
                          <div className="overflow-hidden rounded-2xl border border-cs-green/20 bg-cs-green/5">
                            <button
                              type="button"
                              onClick={() => toggleActionPanel("payment")}
                              className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-cs-green/10"
                            >
                              <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-cs-green/15 p-2 text-cs-green">
                                  <CheckCircle2 size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-white">Informar pagamento</p>
                                  <p className="text-xs text-text-secondary">Envie os dados do pagamento realizado</p>
                                </div>
                              </div>
                              {activePanel === "payment" ? (
                                <ChevronDown size={18} className="text-cs-green" />
                              ) : (
                                <ChevronRight size={18} className="text-cs-green" />
                              )}
                            </button>

                            {activePanel === "payment" ? (
                              <div className="border-t border-cs-green/15 px-4 pb-4 pt-1">
                                <div className="mt-4 space-y-4">
                                  <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Valor pago
                                    </label>
                                    <input
                                      value={paymentForm.amount}
                                      onChange={(e) =>
                                        setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
                                      }
                                      className="w-full rounded-xl border border-surface bg-background px-3 py-3 text-sm text-white outline-none transition-colors focus:border-cs-green"
                                      placeholder="0,00"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Forma de pagamento
                                    </label>
                                    <select
                                      value={paymentForm.method}
                                      onChange={(e) =>
                                        setPaymentForm((prev) => ({ ...prev, method: e.target.value }))
                                      }
                                      className="w-full rounded-xl border border-surface bg-background px-3 py-3 text-sm text-white outline-none transition-colors focus:border-cs-green"
                                    >
                                      <option value="pix">PIX</option>
                                      <option value="boleto">Boleto</option>
                                      <option value="transferencia">Transferência</option>
                                      <option value="cartao">Cartão</option>
                                      <option value="outro">Outro</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Referência
                                    </label>
                                    <input
                                      value={paymentForm.reference}
                                      onChange={(e) =>
                                        setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))
                                      }
                                      className="w-full rounded-xl border border-surface bg-background px-3 py-3 text-sm text-white outline-none transition-colors focus:border-cs-green"
                                      placeholder="ID da transação, banco ou observação"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Mensagem
                                    </label>
                                    <textarea
                                      value={paymentForm.message}
                                      onChange={(e) =>
                                        setPaymentForm((prev) => ({ ...prev, message: e.target.value }))
                                      }
                                      className="min-h-[110px] w-full rounded-xl border border-surface bg-background px-3 py-3 text-sm text-white outline-none transition-colors focus:border-cs-green"
                                      placeholder="Descreva o pagamento realizado."
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Comprovante
                                    </label>
                                    <label className="flex min-h-[52px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-surface bg-background px-4 py-3 text-sm text-white transition-colors hover:border-cs-green">
                                      <Upload size={16} />
                                      <span className="truncate">{paymentFile ? paymentFile.name : "Selecionar arquivo"}</span>
                                      <input
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                                      />
                                    </label>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleReportPayment}
                                    disabled={submitting}
                                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-cs-green px-4 py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                                  >
                                    {submitting ? (
                                      <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                      <CircleDollarSign size={18} />
                                    )}
                                    Registrar pagamento
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-orange-500/20 bg-orange-500/5">
                            <button
                              type="button"
                              onClick={() => toggleActionPanel("dispute")}
                              className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-500/10"
                            >
                              <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-300">
                                  <AlertTriangle size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-white">Contestar cobrança</p>
                                  <p className="text-xs text-text-secondary">Registre divergências de forma organizada</p>
                                </div>
                              </div>
                              {activePanel === "dispute" ? (
                                <ChevronDown size={18} className="text-orange-300" />
                              ) : (
                                <ChevronRight size={18} className="text-orange-300" />
                              )}
                            </button>

                            {activePanel === "dispute" ? (
                              <div className="border-t border-orange-500/15 px-4 pb-4 pt-1">
                                <div className="mt-4 space-y-4">
                                  <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Categoria
                                    </label>
                                    <select
                                      value={disputeForm.category}
                                      onChange={(e) =>
                                        setDisputeForm((prev) => ({ ...prev, category: e.target.value }))
                                      }
                                      className="w-full rounded-xl border border-surface bg-background px-3 py-3 text-sm text-white outline-none transition-colors focus:border-orange-400"
                                    >
                                      <option value="amount_divergence">Valor divergente</option>
                                      <option value="duplicate_charge">Cobrança duplicada</option>
                                      <option value="service_not_delivered">Serviço não entregue</option>
                                      <option value="wrong_due_date">Data incorreta</option>
                                      <option value="wrong_document">Documento incorreto</option>
                                      <option value="unknown_charge">Cobrança desconhecida</option>
                                      <option value="other">Outro</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Motivo curto
                                    </label>
                                    <input
                                      value={disputeForm.reason}
                                      onChange={(e) =>
                                        setDisputeForm((prev) => ({ ...prev, reason: e.target.value }))
                                      }
                                      className="w-full rounded-xl border border-surface bg-background px-3 py-3 text-sm text-white outline-none transition-colors focus:border-orange-400"
                                      placeholder="Resumo objetivo do problema"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Descrição
                                    </label>
                                    <textarea
                                      value={disputeForm.message}
                                      onChange={(e) =>
                                        setDisputeForm((prev) => ({ ...prev, message: e.target.value }))
                                      }
                                      className="min-h-[110px] w-full rounded-xl border border-surface bg-background px-3 py-3 text-sm text-white outline-none transition-colors focus:border-orange-400"
                                      placeholder="Explique a contestação com detalhes."
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                                      Anexo
                                    </label>
                                    <label className="flex min-h-[52px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-surface bg-background px-4 py-3 text-sm text-white transition-colors hover:border-orange-400">
                                      <Upload size={16} />
                                      <span className="truncate">{disputeFile ? disputeFile.name : "Selecionar arquivo"}</span>
                                      <input
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => setDisputeFile(e.target.files?.[0] || null)}
                                      />
                                    </label>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleOpenDispute}
                                    disabled={submitting}
                                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                                  >
                                    {submitting ? (
                                      <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                      <MessageSquare size={18} />
                                    )}
                                    Abrir contestação
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </section>
                    </aside>
                  </div>
                </div>
              )}
            </section>
          </section>
        )}
      </section>
    </main>
  );
}