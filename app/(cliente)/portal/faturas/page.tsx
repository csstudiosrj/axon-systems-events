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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [openActionPanel, setOpenActionPanel] = useState<ActionPanelKey>(null);
  const [storageReady, setStorageReady] = useState<boolean>(true);
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

    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }

    toastTimer.current = window.setTimeout(() => {
      setToast({ type: "success", text: "" });
    }, 4000);
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

  const formatMetadataLabel = useCallback(
    (key: string) => {
      const map: Record<string, string> = {
        valor: "Valor",
        forma_pagamento: "Forma de pagamento",
        referencia: "Referência",
        categoria: "Categoria",
        motivo: "Motivo",
      };

      return map[key] || key.replaceAll("_", " ");
    },
    []
  );

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
      .select(`
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
      `)
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
    setLoading(false);
  }, [resolvedClientId, showToast]);

  const fetchDetails = useCallback(async (transactionId: string) => {
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
      console.error("Erro ao carregar timeline:", eventsResult.error);
      setEvents([]);
    } else {
      setEvents((eventsResult.data || []) as FinancialEvent[]);
    }

    if (attachmentsResult.error) {
      console.error("Erro ao carregar anexos:", attachmentsResult.error);
      setAttachments([]);
    } else {
      setAttachments((attachmentsResult.data || []) as FinancialAttachment[]);
    }

    setDetailLoading(false);
  }, []);

  const verifyStorageAccess = useCallback(async () => {
    try {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });

      if (error) {
        const normalizedMessage = normalizeText(error.message);
        const bucketMissing =
          normalizedMessage.includes("bucket") &&
          (normalizedMessage.includes("not found") ||
            normalizedMessage.includes("nao encontrado") ||
            normalizedMessage.includes("does not exist"));

        if (bucketMissing) {
          setStorageReady(false);
          setStorageWarning(
            `O bucket "${STORAGE_BUCKET}" não foi encontrado. Crie o bucket no Supabase Storage para anexos e comprovantes funcionarem.`
          );
          return;
        }
      }

      setStorageReady(true);
      setStorageWarning("");
    } catch (error) {
      console.error("Erro ao validar storage:", error);
      setStorageReady(true);
      setStorageWarning("");
    }
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    void verifyStorageAccess();
  }, [verifyStorageAccess]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

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

      if (isPaid) {
        group.paidAmount += Number(item.amount || 0);
      } else {
        group.openAmount += Number(item.amount || 0);
      }

      if (new Date(item.due_date) < new Date(group.earliestDueDate)) {
        group.earliestDueDate = item.due_date;
      }

      if (new Date(item.due_date) > new Date(group.latestDueDate)) {
        group.latestDueDate = item.due_date;
      }

      if ((item.total_installments || 1) > group.totalInstallments) {
        group.totalInstallments = item.total_installments || 1;
      }

      if (!group.documentNumber && item.document_number) {
        group.documentNumber = item.document_number;
      }
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        items: sortTransactionsInGroup(group.items),
      }))
      .sort((a, b) => {
        const dueDiff =
          new Date(a.earliestDueDate).getTime() - new Date(b.earliestDueDate).getTime();
        if (dueDiff !== 0) return dueDiff;
        return a.title.localeCompare(b.title);
      });
  }, [transactions, invoiceSingular, getSourceLabel]);

  useEffect(() => {
    if (groupedInvoices.length === 0) {
      setSelectedId(null);
      setEvents([]);
      setAttachments([]);
      return;
    }

    setExpandedGroups((prev) => {
      const next = { ...prev };

      for (const group of groupedInvoices) {
        if (next[group.id] === undefined) {
          next[group.id] = group.items.length === 1;
        }
      }

      return next;
    });

    const allIds = groupedInvoices.flatMap((group) => group.items.map((item) => item.id));

    if (!selectedId || !allIds.includes(selectedId)) {
      setSelectedId(groupedInvoices[0].items[0].id);
    }
  }, [groupedInvoices, selectedId]);

  useEffect(() => {
    if (selectedId) {
      void fetchDetails(selectedId);
    }
  }, [selectedId, fetchDetails]);

  const selectedTransaction = useMemo(
    () => transactions.find((item) => item.id === selectedId) || null,
    [transactions, selectedId]
  );

  const selectedGroup = useMemo(
    () => groupedInvoices.find((group) => group.items.some((item) => item.id === selectedId)) || null,
    [groupedInvoices, selectedId]
  );

  const selectedGroupItems = useMemo(
    () => selectedGroup?.items || [],
    [selectedGroup]
  );

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

  const getStatusBadge = useCallback(
    (item: FinancialTransaction) => {
      const status = item.status || "pending";
      const isPaid =
        status === "paid" ||
        status === "received" ||
        item.workflow_status === "confirmed";

      const isDisputed =
        !!item.dispute_status &&
        item.dispute_status !== "none" &&
        item.dispute_status !== "resolved";

      const isAwaitingFinance =
        item.workflow_status === "awaiting_finance" ||
        item.workflow_status === "under_review";

      const isOverdue = !isPaid && new Date(item.due_date) < new Date();

      if (isPaid) {
        return (
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            Pago
          </span>
        );
      }

      if (isDisputed) {
        return (
          <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
            Contestação
          </span>
        );
      }

      if (isAwaitingFinance) {
        return (
          <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            Em análise
          </span>
        );
      }

      if (isOverdue) {
        return (
          <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
            Vencido
          </span>
        );
      }

      return (
        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
          Em aberto
        </span>
      );
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File, transactionId: string, attachmentType: string) => {
      if (!resolvedClientId) {
        throw new Error(`Não foi possível identificar o ${clientSingular.toLowerCase()} atual.`);
      }

      if (!storageReady) {
        throw new Error(storageWarning || "O storage não está disponível no momento.");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `financial/${resolvedClientId}/${transactionId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        const normalizedMessage = normalizeText(uploadError.message);
        const bucketMissing =
          normalizedMessage.includes("bucket") &&
          (normalizedMessage.includes("not found") ||
            normalizedMessage.includes("nao encontrado") ||
            normalizedMessage.includes("does not exist"));

        if (bucketMissing) {
          setStorageReady(false);
          setStorageWarning(
            `O bucket "${STORAGE_BUCKET}" não foi encontrado. Crie o bucket no Supabase Storage para anexos e comprovantes funcionarem.`
          );
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
    [clientSingular, resolvedClientId, storageReady, storageWarning]
  );

  const refreshAll = useCallback(
    async (transactionId: string) => {
      await fetchTransactions();
      setSelectedId(transactionId);
      await fetchDetails(transactionId);
    },
    [fetchDetails, fetchTransactions]
  );

  const handleReportPayment = useCallback(async () => {
    if (!selectedTransaction) return;

    if (!paymentForm.amount || !paymentForm.method || !paymentForm.message.trim()) {
      showToast("Preencha valor, forma de pagamento e mensagem.", "error");
      return;
    }

    setSubmitting(true);

    try {
      const parsedAmount = Number(String(paymentForm.amount).replace(/\./g, "").replace(",", "."));

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Informe um valor válido para o pagamento.");
      }

      const { data: eventData, error: eventError } = await supabase
        .from("financial_transaction_events")
        .insert({
          financial_transaction_id: selectedTransaction.id,
          author_id: currentUserId,
          author_type: "client",
          visibility: "shared",
          event_type: "payment_reported",
          title: `Pagamento informado pelo ${clientSingular.toLowerCase()}`,
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

        const { error: attachmentError } = await supabase
          .from("financial_transaction_attachments")
          .insert({
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

      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status: "awaiting_finance",
          payment_reported_amount: parsedAmount,
          payment_reported_method: paymentForm.method,
          payment_reported_reference: paymentForm.reference || null,
          payment_reported_at: new Date().toISOString(),
          customer_last_action_at: new Date().toISOString(),
          last_interaction_at: new Date().toISOString(),
        })
        .eq("id", selectedTransaction.id);

      if (updateError) {
        throw new Error(updateError.message || "Erro ao atualizar cobrança.");
      }

      setPaymentForm({
        amount: "",
        method: "pix",
        reference: "",
        message: "",
      });
      setPaymentFile(null);
      setOpenActionPanel(null);
      showToast("Pagamento informado com sucesso.", "success");
      await refreshAll(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao informar pagamento.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    clientSingular,
    currentUserId,
    paymentFile,
    paymentForm.amount,
    paymentForm.message,
    paymentForm.method,
    paymentForm.reference,
    refreshAll,
    selectedTransaction,
    showToast,
    uploadFile,
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
          title: `Contestação aberta pelo ${clientSingular.toLowerCase()}`,
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

        const { error: attachmentError } = await supabase
          .from("financial_transaction_attachments")
          .insert({
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

      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status: "disputed",
          dispute_status: "open",
          dispute_category: disputeForm.category,
          dispute_reason: disputeForm.reason.trim(),
          customer_last_action_at: new Date().toISOString(),
          last_interaction_at: new Date().toISOString(),
        })
        .eq("id", selectedTransaction.id);

      if (updateError) {
        throw new Error(updateError.message || "Erro ao atualizar contestação.");
      }

      setDisputeForm({
        category: "amount_divergence",
        reason: "",
        message: "",
      });
      setDisputeFile(null);
      setOpenActionPanel(null);
      showToast("Contestação registrada com sucesso.", "success");
      await refreshAll(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao abrir contestação.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    clientSingular,
    currentUserId,
    disputeFile,
    disputeForm.category,
    disputeForm.message,
    disputeForm.reason,
    refreshAll,
    selectedTransaction,
    showToast,
    uploadFile,
  ]);

  const resolveAttachmentUrls = useCallback(async () => {
    const pending = attachments.filter((file) => file.file_path && !signedUrls[file.id]);
    if (pending.length === 0) return;

    const nextMap: Record<string, string> = {};

    await Promise.all(
      pending.map(async (file) => {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(file.file_path, 3600);

        if (!error && data?.signedUrl) {
          nextMap[file.id] = data.signedUrl;
        }
      })
    );

    if (Object.keys(nextMap).length > 0) {
      setSignedUrls((prev) => ({ ...prev, ...nextMap }));
    }
  }, [attachments, signedUrls]);

  useEffect(() => {
    void resolveAttachmentUrls();
  }, [resolveAttachmentUrls]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const toggleActionPanel = useCallback((panel: Exclude<ActionPanelKey, null>) => {
    setOpenActionPanel((current) => (current === panel ? null : panel));
  }, []);

  const selectPreviousItem = useCallback(() => {
    if (!selectedGroup || selectedIndexInGroup <= 0) return;
    setSelectedId(selectedGroup.items[selectedIndexInGroup - 1].id);
  }, [selectedGroup, selectedIndexInGroup]);

  const selectNextItem = useCallback(() => {
    if (!selectedGroup || selectedIndexInGroup < 0) return;
    if (selectedIndexInGroup >= selectedGroup.items.length - 1) return;
    setSelectedId(selectedGroup.items[selectedIndexInGroup + 1].id);
  }, [selectedGroup, selectedIndexInGroup]);

  return (
    <main className="min-h-screen bg-[#0b0d12] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        {toast.text ? (
          <div
            className={`fixed bottom-6 right-6 z-[100] rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${
              toast.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                : "border-red-500/30 bg-red-500/15 text-red-200"
            }`}
          >
            {toast.text}
          </div>
        ) : null}

        <section className="flex flex-col gap-6">
          <header className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex flex-col gap-5 p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div
                    className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{
                      borderColor: `${brandColor}40`,
                      backgroundColor: `${brandColor}14`,
                      color: brandColor,
                    }}
                  >
                    <CreditCard size={14} />
                    {brandName}
                  </div>

                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {invoicePlural}
                  </h1>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
                    Acompanhe cobranças, consulte parcelas, anexe comprovantes e registre contestação
                    pelo portal do {clientSingular.toLowerCase()}.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Em aberto</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{currency(summary.totalOpen)}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Pagos</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-300">
                      {currency(summary.totalPaid)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Vencidos</p>
                    <p className="mt-2 text-2xl font-semibold text-red-300">
                      {currency(summary.totalOverdue)}
                    </p>
                  </div>
                </div>
              </div>

              {storageWarning ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {storageWarning}
                </div>
              ) : null}
            </div>
          </header>

          {loading ? (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-12 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-center gap-3 text-zinc-300">
                <Loader2 className="animate-spin" size={22} />
                Carregando {invoicePlural.toLowerCase()}...
              </div>
            </section>
          ) : groupedInvoices.length === 0 ? (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-10 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
              <FileText className="mx-auto mb-4 text-zinc-500" size={44} />
              <h2 className="text-xl font-semibold text-white">Nenhuma cobrança encontrada</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Não há {invoicePlural.toLowerCase()} vinculadas ao seu cadastro neste momento.
              </p>
            </section>
          ) : (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                <div className="border-b border-white/10 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                        Cobranças
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        {summary.totalGroups} grupos · {summary.totalCount} itens
                      </p>
                    </div>
                  </div>
                </div>

                <div className="max-h-[78vh] overflow-y-auto">
                  {groupedInvoices.map((group) => {
                    const isExpanded = expandedGroups[group.id];
                    const hasMany = group.items.length > 1;
                    const hasSelected = group.items.some((item) => item.id === selectedId);

                    return (
                      <div key={group.id} className="border-b border-white/8 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (hasMany) {
                              toggleGroup(group.id);
                            } else {
                              setSelectedId(group.items[0].id);
                            }
                          }}
                          className={`w-full px-5 py-4 text-left transition duration-200 ${
                            hasSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.035]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="line-clamp-2 text-sm font-semibold text-white">
                                  {group.title}
                                </p>

                                {group.sourceLabel ? (
                                  <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                                    {group.sourceLabel}
                                  </span>
                                ) : null}
                              </div>

                              <p className="mt-2 text-xs text-zinc-400">
                                Documento: {group.documentNumber || "-"}
                              </p>

                              <p className="mt-1 text-xs text-zinc-400">
                                {hasMany
                                  ? `${group.items.length} parcelas · De ${formatDate(
                                      group.earliestDueDate
                                    )} até ${formatDate(group.latestDueDate)}`
                                  : `Vencimento: ${formatDate(group.items[0].due_date)}`}
                              </p>
                            </div>

                            {hasMany ? (
                              isExpanded ? (
                                <ChevronDown className="mt-0.5 shrink-0 text-zinc-500" size={18} />
                              ) : (
                                <ChevronRight className="mt-0.5 shrink-0 text-zinc-500" size={18} />
                              )
                            ) : (
                              <ChevronRight className="mt-0.5 shrink-0 text-zinc-500" size={18} />
                            )}
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-white">
                                {currency(group.totalAmount)}
                              </p>
                              {hasMany ? (
                                <p className="mt-1 text-xs text-zinc-500">
                                  Em aberto: {currency(group.openAmount)} · Pago:{" "}
                                  {currency(group.paidAmount)}
                                </p>
                              ) : null}
                            </div>

                            {hasMany ? (
                              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                                {group.items.length} parcelas
                              </span>
                            ) : (
                              getStatusBadge(group.items[0])
                            )}
                          </div>
                        </button>

                        {hasMany && isExpanded ? (
                          <div className="border-t border-white/8 bg-black/10">
                            {group.items.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedId(item.id)}
                                className={`flex w-full items-center justify-between gap-3 border-b border-white/6 px-5 py-3 text-left transition duration-200 last:border-b-0 ${
                                  selectedId === item.id ? "bg-white/[0.08]" : "hover:bg-white/[0.035]"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white">
                                    Parcela {item.installment_number || 1}/
                                    {item.total_installments || group.items.length}
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-400">
                                    Vencimento: {formatDate(item.due_date)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold text-white">
                                    {currency(item.amount)}
                                  </span>
                                  {getStatusBadge(item)}
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

              <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                {!selectedTransaction ? (
                  <div className="p-8 text-sm text-zinc-400">
                    Selecione uma cobrança para visualizar os detalhes.
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    <div className="border-b border-white/10 p-6 sm:p-7">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <h2 className="text-2xl font-semibold tracking-tight text-white">
                            {selectedGroup?.title || selectedTransaction.description || invoiceSingular}
                          </h2>

                          <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
                            <span>Documento: {selectedTransaction.document_number || "-"}</span>
                            <span>Vencimento: {formatDate(selectedTransaction.due_date)}</span>
                            <span>
                              Parcela:{" "}
                              {selectedTransaction.installment_number &&
                              selectedTransaction.total_installments
                                ? `${selectedTransaction.installment_number}/${selectedTransaction.total_installments}`
                                : "Única"}
                            </span>
                            {selectedGroup?.sourceLabel ? <span>Origem: {selectedGroup.sourceLabel}</span> : null}
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 xl:items-end">
                          <p className="text-3xl font-semibold text-white">
                            {currency(selectedTransaction.amount)}
                          </p>
                          <div>{getStatusBadge(selectedTransaction)}</div>
                        </div>
                      </div>

                      {selectedGroupItems.length > 1 ? (
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={selectPreviousItem}
                            disabled={selectedIndexInGroup <= 0}
                            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ChevronLeft size={16} />
                            Anterior
                          </button>

                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-300">
                            Parcela {selectedIndexInGroup + 1} de {selectedGroupItems.length}
                          </div>

                          <button
                            type="button"
                            onClick={selectNextItem}
                            disabled={
                              selectedIndexInGroup < 0 ||
                              selectedIndexInGroup >= selectedGroupItems.length - 1
                            }
                            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Próxima
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-6 p-6 sm:p-7 2xl:grid-cols-[minmax(0,1fr)_360px]">
                      <div className="space-y-6">
                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                            Resumo
                          </h3>

                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Status financeiro
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {translateFinancialStatus(selectedTransaction.status)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Workflow
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {translateWorkflowStatus(selectedTransaction.workflow_status)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Pagamento informado
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {selectedTransaction.payment_reported_at
                                  ? formatDateTime(selectedTransaction.payment_reported_at)
                                  : "-"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Pagamento confirmado
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {selectedTransaction.payment_confirmed_at
                                  ? formatDateTime(selectedTransaction.payment_confirmed_at)
                                  : "-"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Categoria da contestação
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {translateDisputeCategory(selectedTransaction.dispute_category)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Motivo da contestação
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {selectedTransaction.dispute_reason || "-"}
                              </p>
                            </div>

                            <div className="md:col-span-2">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Observações
                              </p>
                              <p className="mt-1 text-sm leading-6 text-white">
                                {selectedTransaction.invoice_notes || selectedTransaction.notes || "-"}
                              </p>
                            </div>

                            <div className="md:col-span-2">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                Retorno do financeiro
                              </p>
                              <p className="mt-1 text-sm leading-6 text-white">
                                {selectedTransaction.resolution_notes || "-"}
                              </p>
                            </div>
                          </div>
                        </section>

                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                              Timeline
                            </h3>

                            {detailLoading ? <Loader2 className="animate-spin text-zinc-400" size={18} /> : null}
                          </div>

                          <div className="mt-4 space-y-3">
                            {events.length === 0 ? (
                              <p className="text-sm text-zinc-400">Nenhuma interação registrada.</p>
                            ) : (
                              events.map((event) => (
                                <div
                                  key={event.id}
                                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-white">
                                      {event.title || translateEventType(event.event_type)}
                                    </p>
                                    <span className="text-xs text-zinc-500">
                                      {formatDateTime(event.created_at)}
                                    </span>
                                  </div>

                                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                    {event.author_type === "client"
                                      ? clientSingular
                                      : event.author_type === "finance"
                                      ? "Financeiro"
                                      : "Sistema"}
                                  </p>

                                  <p className="mt-3 text-sm leading-6 text-zinc-200">
                                    {event.message || "-"}
                                  </p>

                                  {event.metadata && Object.keys(event.metadata).length > 0 ? (
                                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                      {Object.entries(event.metadata).map(([key, value]) => (
                                        <div
                                          key={key}
                                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400"
                                        >
                                          <span className="block uppercase tracking-[0.16em]">
                                            {formatMetadataLabel(key)}
                                          </span>
                                          <span className="mt-1 block text-sm text-white">
                                            {formatMetadataValue(key, value)}
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

                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                            Anexos
                          </h3>

                          <div className="mt-4 space-y-3">
                            {attachments.length === 0 ? (
                              <p className="text-sm text-zinc-400">Nenhum anexo disponível.</p>
                            ) : (
                              attachments.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-white">{file.file_name}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                      {file.attachment_type} · {formatDateTime(file.created_at)}
                                    </p>
                                  </div>

                                  <div className="flex gap-2">
                                    {signedUrls[file.id] ? (
                                      <a
                                        href={signedUrls[file.id]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                                      >
                                        <Paperclip size={16} />
                                        Abrir
                                      </a>
                                    ) : (
                                      <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-zinc-400">
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
                        <button
                          type="button"
                          onClick={() => toggleActionPanel("payment")}
                          className={`group w-full rounded-[24px] border p-4 text-left transition duration-200 ${
                            openActionPanel === "payment"
                              ? "border-emerald-500/30 bg-emerald-500/10"
                              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                                <CheckCircle2 size={18} />
                              </span>
                              <div>
                                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                                  Informar pagamento
                                </h3>
                                <p className="mt-1 text-sm text-zinc-400">
                                  Abra apenas quando precisar registrar um pagamento.
                                </p>
                              </div>
                            </div>

                            {openActionPanel === "payment" ? (
                              <ChevronDown className="text-zinc-400" size={18} />
                            ) : (
                              <ChevronRight className="text-zinc-400" size={18} />
                            )}
                          </div>
                        </button>

                        {openActionPanel === "payment" ? (
                          <section className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-5">
                            <div className="space-y-4">
                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Valor pago
                                </label>
                                <input
                                  value={paymentForm.amount}
                                  onChange={(e) =>
                                    setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-emerald-400"
                                  placeholder="0,00"
                                />
                              </div>

                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Forma de pagamento
                                </label>
                                <select
                                  value={paymentForm.method}
                                  onChange={(e) =>
                                    setPaymentForm((prev) => ({ ...prev, method: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-emerald-400"
                                >
                                  <option value="pix">PIX</option>
                                  <option value="boleto">Boleto</option>
                                  <option value="transferencia">Transferência</option>
                                  <option value="cartao">Cartão</option>
                                  <option value="outro">Outro</option>
                                </select>
                              </div>

                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Referência
                                </label>
                                <input
                                  value={paymentForm.reference}
                                  onChange={(e) =>
                                    setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-emerald-400"
                                  placeholder="ID da transação, banco ou observação"
                                />
                              </div>

                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Mensagem
                                </label>
                                <textarea
                                  value={paymentForm.message}
                                  onChange={(e) =>
                                    setPaymentForm((prev) => ({ ...prev, message: e.target.value }))
                                  }
                                  className="min-h-[120px] w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-emerald-400"
                                  placeholder="Descreva o pagamento realizado."
                                />
                              </div>

                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Comprovante
                                </label>
                                <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-3 text-sm text-white transition hover:border-emerald-400/60">
                                  <Upload size={16} />
                                  <span className="truncate">
                                    {paymentFile ? paymentFile.name : "Selecionar arquivo"}
                                  </span>
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
                                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {submitting ? (
                                  <Loader2 className="animate-spin" size={18} />
                                ) : (
                                  <CircleDollarSign size={18} />
                                )}
                                Registrar pagamento
                              </button>
                            </div>
                          </section>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => toggleActionPanel("dispute")}
                          className={`group w-full rounded-[24px] border p-4 text-left transition duration-200 ${
                            openActionPanel === "dispute"
                              ? "border-orange-500/30 bg-orange-500/10"
                              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
                                <AlertTriangle size={18} />
                              </span>
                              <div>
                                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                                  Contestar cobrança
                                </h3>
                                <p className="mt-1 text-sm text-zinc-400">
                                  Abra apenas quando houver divergência real nesta cobrança.
                                </p>
                              </div>
                            </div>

                            {openActionPanel === "dispute" ? (
                              <ChevronDown className="text-zinc-400" size={18} />
                            ) : (
                              <ChevronRight className="text-zinc-400" size={18} />
                            )}
                          </div>
                        </button>

                        {openActionPanel === "dispute" ? (
                          <section className="rounded-[24px] border border-orange-500/20 bg-orange-500/5 p-5">
                            <div className="space-y-4">
                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Categoria
                                </label>
                                <select
                                  value={disputeForm.category}
                                  onChange={(e) =>
                                    setDisputeForm((prev) => ({ ...prev, category: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-orange-400"
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
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Motivo curto
                                </label>
                                <input
                                  value={disputeForm.reason}
                                  onChange={(e) =>
                                    setDisputeForm((prev) => ({ ...prev, reason: e.target.value }))
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-orange-400"
                                  placeholder="Resumo objetivo do problema"
                                />
                              </div>

                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Descrição
                                </label>
                                <textarea
                                  value={disputeForm.message}
                                  onChange={(e) =>
                                    setDisputeForm((prev) => ({ ...prev, message: e.target.value }))
                                  }
                                  className="min-h-[120px] w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-orange-400"
                                  placeholder="Explique a contestação com detalhes."
                                />
                              </div>

                              <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                  Anexo
                                </label>
                                <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-3 text-sm text-white transition hover:border-orange-400/60">
                                  <Upload size={16} />
                                  <span className="truncate">
                                    {disputeFile ? disputeFile.name : "Selecionar arquivo"}
                                  </span>
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
                                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {submitting ? (
                                  <Loader2 className="animate-spin" size={18} />
                                ) : (
                                  <MessageSquare size={18} />
                                )}
                                Abrir contestação
                              </button>
                            </div>
                          </section>
                        ) : null}
                      </aside>
                    </div>
                  </div>
                )}
              </section>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}