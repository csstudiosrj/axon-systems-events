"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
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
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function removeInstallmentSuffix(value: string | null | undefined) {
  return (value || "")
    .replace(/[-â€“â€”]?\s*parcela\s*\d+\s*\/\s*\d+/i, "")
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
  const cleanedDescription = normalizeText(
    removeInstallmentSuffix(item.description)
  );
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

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `O arquivo "${file.name}" excede o limite de 5MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB.`;
  }
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.type);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  if (!mimeOk && !extOk) {
    return `Formato nÃ£o permitido. Utilize PDF, JPG, JPEG, PNG ou WEBP.`;
  }
  return null;
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
  // Signed URLs gerenciadas via ref para evitar loop
  const signedUrlsRef = useRef<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [openActionPanel, setOpenActionPanel] = useState<ActionPanelKey>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Controla quais IDs jÃ¡ foram marcados como lidos nesta sessÃ£o
  const readTransactionIdsRef = useRef<Set<string>>(new Set());

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
  const quoteSingular = labels?.entity_quote_singular || "OrÃ§amento";
  const serviceOrderSingular =
    labels?.entity_service_order_singular || "Ordem de ServiÃ§o";
  const brandName = companyProfile?.company_name || "ARXUM Systems";
  const brandColor = companyProfile?.primary_color || "#138946";
  const currencyCode = systemPreferences?.currency_code || "BRL";

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToast({ text, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast({ type: "success", text: "" }),
      4000
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

  const handleCurrencyInput = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits === "") return "";
    const floatValue = Number(digits) / 100;
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(floatValue);
  };

  const parseCurrencyToNumber = (value: string): number => {
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
      under_review: "Em anÃ¡lise",
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
      duplicate_charge: "CobranÃ§a duplicada",
      service_not_delivered: "ServiÃ§o nÃ£o entregue",
      wrong_due_date: "Data incorreta",
      wrong_document: "Documento incorreto",
      unknown_charge: "CobranÃ§a desconhecida",
      other: "Outro",
    };
    return map[value || ""] || value || "-";
  }, []);

  const translateEventType = useCallback((value: string) => {
    const map: Record<string, string> = {
      charge_created: "CobranÃ§a criada",
      payment_reported: "Pagamento informado",
      payment_receipt_attached: "Comprovante anexado",
      dispute_opened: "ContestaÃ§Ã£o aberta",
      dispute_comment: "ComentÃ¡rio da contestaÃ§Ã£o",
      finance_comment: "ComentÃ¡rio do financeiro",
      payment_confirmed: "Pagamento confirmado",
      payment_rejected: "Pagamento rejeitado",
      charge_adjusted: "CobranÃ§a ajustada",
      charge_cancelled: "CobranÃ§a cancelada",
      status_changed: "Status alterado",
      resolution_added: "ResoluÃ§Ã£o registrada",
      attachment_added: "Anexo incluÃ­do",
    };
    return map[value] || value;
  }, []);

  const translatePaymentMethod = useCallback((value: string | null) => {
    const map: Record<string, string> = {
      pix: "PIX",
      boleto: "Boleto",
      transferencia: "TransferÃªncia",
      cartao: "CartÃ£o",
      outro: "Outro",
    };
    return map[value || ""] || value || "-";
  }, []);

  const formatMetadataLabel = useCallback((key: string) => {
    const map: Record<string, string> = {
      valor: "Valor",
      forma_pagamento: "Forma de pagamento",
      referencia: "ReferÃªncia",
      categoria: "Categoria",
      motivo: "Motivo",
      tipo_pagamento: "Tipo de pagamento",
      valor_devido: "Valor devido",
    };
    return map[key] || key.replaceAll("_", " ");
  }, []);

  const formatMetadataValue = useCallback(
    (key: string, value: unknown) => {
      if (value === null || value === undefined || value === "") return "-";
      if (
        (key === "valor" || key === "valor_devido") &&
        typeof value === "number"
      )
        return currency(value);
      if (key === "forma_pagamento" && typeof value === "string")
        return translatePaymentMethod(value);
      if (key === "categoria" && typeof value === "string")
        return translateDisputeCategory(value);
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

  // â”€â”€ Fetch principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      console.error("Erro ao carregar cobranÃ§as:", error);
      setTransactions([]);
      setLoading(false);
      showToast(
        "NÃ£o foi possÃ­vel carregar as cobranÃ§as. Tente novamente.",
        "error"
      );
      return;
    }

    const rows = dedupeTransactions((data || []) as FinancialTransaction[]);
    setTransactions(rows);

    // Recalcula notificaÃ§Ãµes excluindo IDs jÃ¡ vistos nesta sessÃ£o
    const unread = rows.filter(
      (t) =>
        t.finance_last_action_at &&
        (!t.customer_last_action_at ||
          new Date(t.finance_last_action_at) >
            new Date(t.customer_last_action_at)) &&
        !readTransactionIdsRef.current.has(t.id)
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
      console.error("Erro ao carregar histÃ³rico:", eventsResult.error);
      setEvents([]);
    } else {
      setEvents((eventsResult.data || []) as FinancialEvent[]);
    }

    if (attachmentsResult.error) {
      console.error("Erro ao carregar anexos:", attachmentsResult.error);
      setAttachments([]);
    } else {
      setAttachments(
        (attachmentsResult.data || []) as FinancialAttachment[]
      );
    }
    setDetailLoading(false);
  }, []);

  // â”€â”€ Marcar como lida â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const markTransactionAsRead = useCallback(
    async (transactionId: string) => {
      if (readTransactionIdsRef.current.has(transactionId)) return;

      const transaction = transactions.find((t) => t.id === transactionId);
      if (!transaction) return;

      const hasUnreadUpdate =
        transaction.finance_last_action_at &&
        (!transaction.customer_last_action_at ||
          new Date(transaction.finance_last_action_at) >
            new Date(transaction.customer_last_action_at));

      if (!hasUnreadUpdate) return;

      readTransactionIdsRef.current.add(transactionId);

      // Decrementa o contador imediatamente, sem esperar o banco
      setUnreadNotifications((prev) => Math.max(0, prev - 1));

      // Persiste em background
      supabase
        .from("financial_transactions")
        .update({ customer_last_action_at: new Date().toISOString() })
        .eq("id", transactionId)
        .then(({ error }) => {
          if (error) console.error("Erro ao marcar fatura como lida:", error);
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

  // â”€â”€ Realtime: atualizaÃ§Ã£o em tempo real do portal do cliente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!resolvedClientId) return;

    const channel = supabase
      .channel(`portal-faturas-${resolvedClientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_transactions",
          filter: `client_id=eq.${resolvedClientId}`,
        },
        () => {
          void fetchTransactions();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_transaction_events",
        },
        (payload) => {
          // Atualiza detalhes apenas se o evento pertence Ã  fatura selecionada
          setSelectedId((currentSelectedId) => {
            if (
              currentSelectedId &&
              (payload.new as { financial_transaction_id?: string })
                ?.financial_transaction_id === currentSelectedId
            ) {
              void fetchDetails(currentSelectedId);
            }
            return currentSelectedId;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_transaction_attachments",
        },
        (payload) => {
          setSelectedId((currentSelectedId) => {
            if (
              currentSelectedId &&
              (payload.new as { financial_transaction_id?: string })
                ?.financial_transaction_id === currentSelectedId
            ) {
              void fetchDetails(currentSelectedId);
            }
            return currentSelectedId;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedClientId, fetchTransactions, fetchDetails]);

  // â”€â”€ TÃ­tulo dinÃ¢mico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (unreadNotifications > 0) {
      document.title = `(${unreadNotifications}) AtualizaÃ§Ãµes em ${invoicePlural} | ${brandName}`;
    } else {
      document.title = `${invoicePlural} | ${brandName}`;
    }
  }, [unreadNotifications, invoicePlural, brandName]);

  // â”€â”€ Grupos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      .map((group) => ({
        ...group,
        items: sortTransactionsInGroup(group.items),
      }))
      .sort(
        (a, b) =>
          new Date(a.earliestDueDate).getTime() -
          new Date(b.earliestDueDate).getTime()
      );
  }, [transactions, invoiceSingular, getSourceLabel]);

  // Seleciona o primeiro item automaticamente
  useEffect(() => {
    if (groupedInvoices.length > 0 && !selectedId) {
      setSelectedId(groupedInvoices[0].items[0].id);
    }
  }, [groupedInvoices, selectedId]);

  // Ao trocar de fatura: busca detalhes, limpa formulÃ¡rios, marca como lida
  useEffect(() => {
    if (selectedId) {
      void fetchDetails(selectedId);
      void markTransactionAsRead(selectedId);
      setOpenActionPanel(null);
      setPaymentForm({ amount: "", method: "pix", reference: "", message: "" });
      setDisputeForm({
        category: "amount_divergence",
        reason: "",
        message: "",
      });
      setPaymentFile(null);
      setDisputeFile(null);
    }
  }, [selectedId, fetchDetails, markTransactionAsRead]);

  // â”€â”€ Signed URLs via ref â€” sem loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Derivados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selectedTransaction = useMemo(
    () => transactions.find((item) => item.id === selectedId) || null,
    [transactions, selectedId]
  );
  const selectedGroup = useMemo(
    () =>
      groupedInvoices.find((group) =>
        group.items.some((item) => item.id === selectedId)
      ) || null,
    [groupedInvoices, selectedId]
  );
  const selectedGroupItems = useMemo(
    () => selectedGroup?.items || [],
    [selectedGroup]
  );
  const selectedIndexInGroup = useMemo(() => {
    if (!selectedTransaction || !selectedGroup) return -1;
    return selectedGroup.items.findIndex(
      (item) => item.id === selectedTransaction.id
    );
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
    const overdue = open.filter(
      (item) => new Date(item.due_date) < today
    );

    return {
      totalOpen: open.reduce(
        (acc, item) => acc + Number(item.amount || 0),
        0
      ),
      totalPaid: paid.reduce(
        (acc, item) => acc + Number(item.amount || 0),
        0
      ),
      totalOverdue: overdue.reduce(
        (acc, item) => acc + Number(item.amount || 0),
        0
      ),
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
    const isOverdue =
      !isPaid && new Date(item.due_date) < new Date();

    if (isPaid)
      return (
        <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          Pago
        </span>
      );
    if (isDisputed)
      return (
        <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
          ContestaÃ§Ã£o
        </span>
      );
    if (isAwaiting)
      return (
        <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
          Em anÃ¡lise
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

  // â”€â”€ File handler centralizado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleFileChange = (
    file: File | null,
    setter: React.Dispatch<React.SetStateAction<File | null>>
  ) => {
    if (!file) {
      setter(null);
      return;
    }
    const validationError = validateFile(file);
    if (validationError) {
      showToast(validationError, "error");
      setter(null);
      return;
    }
    setter(file);
  };

  // â”€â”€ Handler: Notificar Pagamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleReportPayment = async () => {
    if (!selectedTransaction || submitting) return;

    const amountNum = parseCurrencyToNumber(paymentForm.amount);
    if (amountNum <= 0) {
      showToast("Informe o valor pago para prosseguir.", "error");
      return;
    }
    if (!paymentForm.message.trim()) {
      showToast(
        "Preencha a mensagem descrevendo o pagamento realizado.",
        "error"
      );
      return;
    }

    const isPartialPayment =
      amountNum < Number(selectedTransaction.amount || 0);
    const nowIso = new Date().toISOString();

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
          title: isPartialPayment
            ? "NotificaÃ§Ã£o de Pagamento Parcial Realizado"
            : "NotificaÃ§Ã£o de Pagamento Realizado",
          message: paymentForm.message.trim(),
          metadata: {
            valor: amountNum,
            forma_pagamento: paymentForm.method,
            referencia: paymentForm.reference || null,
            tipo_pagamento: isPartialPayment ? "parcial" : "integral",
            ...(isPartialPayment && {
              valor_devido: Number(selectedTransaction.amount),
            }),
          },
        })
        .select("id")
        .single();

      if (eventError) {
        showToast(
          `Erro ao registrar o evento: ${eventError.message}`,
          "error"
        );
        setSubmitting(false);
        return;
      }

      if (paymentFile) {
        const path = `financial/${resolvedClientId}/${selectedTransaction.id}/${Date.now()}-${paymentFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, paymentFile);

        if (uploadError) {
          showToast(
            `Evento registrado, mas upload do comprovante falhou: ${uploadError.message}`,
            "error"
          );
        } else {
          const { error: attachError } = await supabase
            .from("financial_transaction_attachments")
            .insert({
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

          if (attachError) {
            showToast(
              `Comprovante enviado, mas erro ao registrar o anexo: ${attachError.message}`,
              "error"
            );
          }
        }
      }

      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status: "awaiting_finance",
          payment_reported_amount: amountNum,
          payment_reported_method: paymentForm.method,
          payment_reported_reference: paymentForm.reference || null,
          payment_reported_at: nowIso,
          customer_last_action_at: nowIso,
          last_interaction_at: nowIso,
          ...(isPartialPayment && { dispute_status: "partial_payment" }),
        })
        .eq("id", selectedTransaction.id);

      if (updateError) {
        showToast(
          `Evento registrado, mas erro ao atualizar o status: ${updateError.message}`,
          "error"
        );
        setSubmitting(false);
        return;
      }

      if (isPartialPayment) {
        showToast(
          `Pagamento parcial de ${currency(amountNum)} registrado. O financeiro analisarÃ¡ o valor informado.`,
          "success"
        );
      } else {
        showToast("NotificaÃ§Ã£o de pagamento enviada com sucesso.", "success");
      }

      setOpenActionPanel(null);
      setPaymentForm({ amount: "", method: "pix", reference: "", message: "" });
      setPaymentFile(null);
      // O Realtime jÃ¡ vai atualizar automaticamente,
      // mas chamamos fetch para garantir consistÃªncia imediata
      await fetchTransactions();
      if (selectedTransaction.id)
        await fetchDetails(selectedTransaction.id);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Erro inesperado.";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // â”€â”€ Handler: Registrar ContestaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleOpenDispute = async () => {
    if (!selectedTransaction || submitting) return;

    if (!disputeForm.reason.trim()) {
      showToast("Preencha o motivo resumido da contestaÃ§Ã£o.", "error");
      return;
    }
    if (!disputeForm.message.trim()) {
      showToast("Preencha o detalhamento da contestaÃ§Ã£o.", "error");
      return;
    }

    const nowIso = new Date().toISOString();
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
          title: "Abertura de ContestaÃ§Ã£o Formal",
          message: disputeForm.message.trim(),
          metadata: {
            categoria: disputeForm.category,
            motivo: disputeForm.reason.trim(),
          },
        })
        .select("id")
        .single();

      if (eventError) {
        showToast(
          `Erro ao registrar o evento: ${eventError.message}`,
          "error"
        );
        setSubmitting(false);
        return;
      }

      if (disputeFile) {
        const path = `financial/${resolvedClientId}/${selectedTransaction.id}/${Date.now()}-${disputeFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, disputeFile);

        if (uploadError) {
          showToast(
            `ContestaÃ§Ã£o registrada, mas upload da evidÃªncia falhou: ${uploadError.message}`,
            "error"
          );
        } else {
          const { error: attachError } = await supabase
            .from("financial_transaction_attachments")
            .insert({
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

          if (attachError) {
            showToast(
              `EvidÃªncia enviada, mas erro ao registrar o anexo: ${attachError.message}`,
              "error"
            );
          }
        }
      }

      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update({
          workflow_status: "disputed",
          dispute_status: "open",
          dispute_category: disputeForm.category,
          dispute_reason: disputeForm.reason.trim(),
          customer_last_action_at: nowIso,
          last_interaction_at: nowIso,
        })
        .eq("id", selectedTransaction.id);

      if (updateError) {
        showToast(
          `ContestaÃ§Ã£o registrada, mas erro ao atualizar o status: ${updateError.message}`,
          "error"
        );
        setSubmitting(false);
        return;
      }

      showToast("ContestaÃ§Ã£o formal registrada com sucesso.", "success");
      setOpenActionPanel(null);
      setDisputeForm({
        category: "amount_divergence",
        reason: "",
        message: "",
      });
      setDisputeFile(null);
      await fetchTransactions();
      if (selectedTransaction.id)
        await fetchDetails(selectedTransaction.id);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Erro inesperado.";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectPreviousItem = () => {
    if (selectedGroup && selectedIndexInGroup > 0)
      setSelectedId(selectedGroup.items[selectedIndexInGroup - 1].id);
  };

  const selectNextItem = () => {
    if (
      selectedGroup &&
      selectedIndexInGroup < selectedGroup.items.length - 1
    )
      setSelectedId(selectedGroup.items[selectedIndexInGroup + 1].id);
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                      <div className="flex animate-pulse items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-400">
                        <Bell size={14} />
                        {unreadNotifications}{" "}
                        {unreadNotifications === 1
                          ? "AtualizaÃ§Ã£o"
                          : "AtualizaÃ§Ãµes"}
                      </div>
                    )}
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {invoicePlural}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
                    GestÃ£o financeira centralizada. Acompanhe liquidaÃ§Ãµes, anexe
                    comprovantes oficiais e registre contestaÃ§Ãµes formais pelo
                    portal do {clientSingular.toLowerCase()}.
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
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                      Pagos
                    </p>
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
              <h2 className="text-xl font-semibold text-white">
                Nenhuma cobranÃ§a encontrada
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                NÃ£o hÃ¡ registros financeiros vinculados ao seu cadastro.
              </p>
            </section>
          ) : (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              {/* Sidebar */}
              <aside className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                <div className="border-b border-white/10 px-5 py-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                    CobranÃ§as
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {summary.totalGroups} Grupos Â· {summary.totalCount} Itens
                  </p>
                </div>
                <div className="custom-scrollbar max-h-[78vh] overflow-y-auto">
                  {groupedInvoices.map((group) => {
                    const isExpanded = expandedGroups[group.id];
                    const hasSelected = group.items.some(
                      (i) => i.id === selectedId
                    );
                    return (
                      <div
                        key={group.id}
                        className="border-b border-white/[0.08] last:border-b-0"
                      >
                        <button
                          onClick={() =>
                            group.items.length > 1
                              ? toggleGroup(group.id)
                              : setSelectedId(group.items[0].id)
                          }
                          className={`w-full px-5 py-4 text-left transition ${
                            hasSelected
                              ? "bg-white/[0.07]"
                              : "hover:bg-white/[0.035]"
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
                                <ChevronDown
                                  size={18}
                                  className="text-zinc-500"
                                />
                              ) : (
                                <ChevronRight
                                  size={18}
                                  className="text-zinc-500"
                                />
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
                          <div className="border-t border-white/[0.08] bg-black/10">
                            {group.items.map((item) => {
                              const isActive = selectedId === item.id;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => setSelectedId(item.id)}
                                  style={
                                    isActive
                                      ? {
                                          borderLeft: `3px solid ${brandColor}`,
                                          paddingLeft: "17px",
                                        }
                                      : {
                                          borderLeft:
                                            "3px solid transparent",
                                          paddingLeft: "17px",
                                        }
                                  }
                                  className={`flex w-full items-center justify-between border-b border-white/[0.06] py-3 pr-5 text-left transition last:border-b-0 ${
                                    isActive
                                      ? "bg-white/[0.08]"
                                      : "hover:bg-white/[0.035]"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white">
                                      Parcela{" "}
                                      {item.installment_number ?? "-"}/
                                      {item.total_installments ?? "-"}
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
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>

              {/* Ãrea de Detalhes */}
              <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                {!selectedTransaction ? (
                  <div className="p-8 text-sm italic text-zinc-400">
                    Selecione uma cobranÃ§a para visualizar os detalhes.
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    <div className="border-b border-white/10 p-6 sm:p-7">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <h2 className="text-2xl font-semibold tracking-tight text-white">
                            {selectedGroup?.title ||
                              selectedTransaction.description}
                          </h2>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-zinc-400">
                            <span className="flex items-center gap-1.5">
                              <FileText size={14} /> Doc:{" "}
                              {selectedTransaction.document_number || "-"}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CircleDollarSign size={14} /> Vencimento:{" "}
                              {formatDate(selectedTransaction.due_date)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CreditCard size={14} /> Parcela:{" "}
                              {selectedTransaction.installment_number ?? "-"}/
                              {selectedTransaction.total_installments ?? "-"}
                            </span>
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
                            Parcela {selectedIndexInGroup + 1} de{" "}
                            {selectedGroupItems.length}
                          </div>
                          <button
                            onClick={selectNextItem}
                            disabled={
                              selectedIndexInGroup >=
                              selectedGroupItems.length - 1
                            }
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-40"
                          >
                            PrÃ³xima <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-6 p-6 sm:p-7 2xl:grid-cols-[minmax(0,1fr)_360px]">
                      <div className="space-y-6">
                        {/* Resumo */}
                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                            Resumo da CobranÃ§a
                          </h3>
                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                Status Financeiro
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {translateFinancialStatus(
                                  selectedTransaction.status
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                Fluxo de Trabalho
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {translateWorkflowStatus(
                                  selectedTransaction.workflow_status
                                )}
                              </p>
                            </div>
                            {selectedTransaction.dispute_status &&
                              selectedTransaction.dispute_status !== "none" && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                    Status da ContestaÃ§Ã£o
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-orange-300">
                                    {translateDisputeCategory(
                                      selectedTransaction.dispute_category
                                    )}{" "}
                                    â€”{" "}
                                    {selectedTransaction.dispute_status}
                                  </p>
                                </div>
                              )}
                            {selectedTransaction.payment_reported_amount &&
                              selectedTransaction.payment_reported_amount >
                                0 && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                    Pagamento Notificado
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-amber-300">
                                    {currency(
                                      selectedTransaction.payment_reported_amount
                                    )}{" "}
                                    via{" "}
                                    {translatePaymentMethod(
                                      selectedTransaction.payment_reported_method
                                    )}{" "}
                                    em{" "}
                                    {formatDate(
                                      selectedTransaction.payment_reported_at
                                    )}
                                  </p>
                                </div>
                              )}
                            <div className="md:col-span-2">
                              <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                ObservaÃ§Ãµes do Financeiro
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-white">
                                {selectedTransaction.resolution_notes ||
                                  selectedTransaction.invoice_notes ||
                                  "-"}
                              </p>
                            </div>
                          </div>
                        </section>

                        {/* HistÃ³rico */}
                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                              HistÃ³rico de InteraÃ§Ãµes
                            </h3>
                            {detailLoading && (
                              <Loader2
                                className="animate-spin text-zinc-500"
                                size={18}
                              />
                            )}
                          </div>
                          <div className="space-y-3">
                            {events.length === 0 ? (
                              <p className="text-sm italic text-zinc-500">
                                Nenhuma interaÃ§Ã£o registrada.
                              </p>
                            ) : (
                              events.map((ev) => (
                                <div
                                  key={ev.id}
                                  className={`rounded-2xl border p-4 ${
                                    ev.author_type === "finance" ||
                                    ev.author_type === "system"
                                      ? "border-blue-500/20 bg-blue-500/5"
                                      : "border-white/10 bg-white/[0.04]"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-semibold text-white">
                                      {ev.title ||
                                        translateEventType(ev.event_type)}
                                    </p>
                                    <span className="shrink-0 text-[10px] text-zinc-500">
                                      {formatDateTime(ev.created_at)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[10px] font-bold uppercase text-zinc-600">
                                    {ev.author_type === "client"
                                      ? clientSingular
                                      : ev.author_type === "finance"
                                      ? "Financeiro"
                                      : "Sistema"}
                                  </p>
                                  {ev.message && (
                                    <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                                      {ev.message}
                                    </p>
                                  )}
                                  {ev.metadata &&
                                    Object.keys(ev.metadata).length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {Object.entries(ev.metadata).map(
                                          ([k, v]) => (
                                            <div
                                              key={k}
                                              className="rounded-lg border border-white/5 bg-black/30 px-3 py-1.5"
                                            >
                                              <span className="block text-[9px] font-black uppercase text-zinc-600">
                                                {formatMetadataLabel(k)}
                                              </span>
                                              <span className="text-xs font-bold text-zinc-400">
                                                {formatMetadataValue(k, v)}
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
                        <section className="rounded-[24px] border border-white/10 bg-black/15 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
                            Anexos e Documentos
                          </h3>
                          <div className="mt-4 space-y-3">
                            {attachments.length === 0 ? (
                              <p className="text-sm italic text-zinc-500">
                                Nenhum anexo disponÃ­vel.
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
                                    <p className="text-[10px] font-bold uppercase text-zinc-600">
                                      {file.attachment_type} Â·{" "}
                                      {formatDateTime(file.created_at)}
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
                                    <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/5 px-4 text-xs font-bold text-zinc-600">
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />{" "}
                                      Carregando
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </section>
                      </div>

                      {/* PainÃ©is de AÃ§Ã£o */}
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
                              setOpenActionPanel((p) =>
                                p === "payment" ? null : "payment"
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
                                  Notificar Pagamento
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                  Informar liquidaÃ§Ã£o desta parcela
                                </p>
                              </div>
                            </div>
                            <ChevronDown
                              size={18}
                              className={`text-zinc-500 transition ${
                                openActionPanel === "payment"
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </button>

                          {openActionPanel === "payment" && (
                            <div className="animate-in fade-in slide-in-from-top-2 space-y-4 p-5 pt-0">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Valor Pago
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={paymentForm.amount}
                                  onChange={(e) =>
                                    setPaymentForm((p) => ({
                                      ...p,
                                      amount: handleCurrencyInput(
                                        e.target.value
                                      ),
                                    }))
                                  }
                                  placeholder="0,00"
                                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-emerald-500/50"
                                />
                                {paymentForm.amount &&
                                  parseCurrencyToNumber(paymentForm.amount) >
                                    0 &&
                                  parseCurrencyToNumber(paymentForm.amount) <
                                    Number(
                                      selectedTransaction.amount || 0
                                    ) && (
                                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-400">
                                      âš  Valor inferior ao devido (
                                      {currency(selectedTransaction.amount)}).
                                      SerÃ¡ registrado como pagamento parcial e
                                      encaminhado ao financeiro para anÃ¡lise.
                                    </p>
                                  )}
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Forma de Pagamento
                                </label>
                                <select
                                  value={paymentForm.method}
                                  onChange={(e) =>
                                    setPaymentForm((p) => ({
                                      ...p,
                                      method: e.target.value,
                                    }))
                                  }
                                  className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-emerald-500/50"
                                >
                                  <option value="pix">PIX</option>
                                  <option value="boleto">Boleto</option>
                                  <option value="transferencia">
                                    TransferÃªncia
                                  </option>
                                  <option value="cartao">CartÃ£o</option>
                                  <option value="outro">Outro</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  CÃ³digo de ReferÃªncia / AutenticaÃ§Ã£o{" "}
                                  <span className="normal-case text-zinc-600">
                                    (opcional)
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  value={paymentForm.reference}
                                  onChange={(e) =>
                                    setPaymentForm((p) => ({
                                      ...p,
                                      reference: e.target.value,
                                    }))
                                  }
                                  placeholder="Ex: cÃ³digo E2E, NSU, ID da transaÃ§Ã£o"
                                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-emerald-500/50"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  DescriÃ§Ã£o do Pagamento Realizado
                                </label>
                                <textarea
                                  value={paymentForm.message}
                                  onChange={(e) =>
                                    setPaymentForm((p) => ({
                                      ...p,
                                      message: e.target.value,
                                    }))
                                  }
                                  placeholder="Descreva os detalhes do pagamento efetuado..."
                                  className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-medium outline-none focus:border-emerald-500/50"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/20 p-4 transition hover:bg-black/40">
                                  <Upload size={16} className="text-zinc-500" />
                                  <span className="truncate text-xs font-bold text-zinc-400">
                                    {paymentFile
                                      ? paymentFile.name
                                      : "Anexar Comprovante de Pagamento"}
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    onChange={(e) =>
                                      handleFileChange(
                                        e.target.files?.[0] || null,
                                        setPaymentFile
                                      )
                                    }
                                  />
                                </label>
                                <p className="text-[10px] text-zinc-600">
                                  PDF, JPG, PNG ou WEBP Â· MÃ¡ximo 5MB
                                </p>
                              </div>

                              <button
                                onClick={handleReportPayment}
                                disabled={submitting}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 p-4 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {submitting ? (
                                  <Loader2
                                    className="animate-spin"
                                    size={16}
                                  />
                                ) : (
                                  "Confirmar NotificaÃ§Ã£o de Pagamento"
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* ContestaÃ§Ã£o Formal */}
                        <div
                          className={`rounded-[24px] border transition ${
                            openActionPanel === "dispute"
                              ? "border-orange-500/30 bg-orange-500/10"
                              : "border-white/10 bg-white/[0.04]"
                          }`}
                        >
                          <button
                            onClick={() =>
                              setOpenActionPanel((p) =>
                                p === "dispute" ? null : "dispute"
                              )
                            }
                            className="flex w-full items-center justify-between p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
                                <AlertTriangle size={20} />
                              </div>
                              <div className="text-left">
                                <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
                                  Registrar ContestaÃ§Ã£o Formal
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                  DivergÃªncia de valores, datas ou serviÃ§os
                                </p>
                              </div>
                            </div>
                            <ChevronDown
                              size={18}
                              className={`text-zinc-500 transition ${
                                openActionPanel === "dispute"
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </button>

                          {openActionPanel === "dispute" && (
                            <div className="animate-in fade-in slide-in-from-top-2 space-y-4 p-5 pt-0">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Categoria da ContestaÃ§Ã£o
                                </label>
                                <select
                                  value={disputeForm.category}
                                  onChange={(e) =>
                                    setDisputeForm((p) => ({
                                      ...p,
                                      category: e.target.value,
                                    }))
                                  }
                                  className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-orange-500/50"
                                >
                                  <option value="amount_divergence">
                                    Valor divergente
                                  </option>
                                  <option value="duplicate_charge">
                                    CobranÃ§a duplicada
                                  </option>
                                  <option value="service_not_delivered">
                                    ServiÃ§o nÃ£o entregue
                                  </option>
                                  <option value="wrong_due_date">
                                    Data incorreta
                                  </option>
                                  <option value="wrong_document">
                                    Documento incorreto
                                  </option>
                                  <option value="unknown_charge">
                                    CobranÃ§a desconhecida
                                  </option>
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
                                    setDisputeForm((p) => ({
                                      ...p,
                                      reason: e.target.value,
                                    }))
                                  }
                                  placeholder="Ex: valor cobrado difere do contrato"
                                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold outline-none focus:border-orange-500/50"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                  Detalhamento da ContestaÃ§Ã£o
                                </label>
                                <textarea
                                  value={disputeForm.message}
                                  onChange={(e) =>
                                    setDisputeForm((p) => ({
                                      ...p,
                                      message: e.target.value,
                                    }))
                                  }
                                  placeholder="Descreva detalhadamente a divergÃªncia identificada..."
                                  className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-medium outline-none focus:border-orange-500/50"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/20 p-4 transition hover:bg-black/40">
                                  <Upload size={16} className="text-zinc-500" />
                                  <span className="truncate text-xs font-bold text-zinc-400">
                                    {disputeFile
                                      ? disputeFile.name
                                      : "Anexar EvidÃªncia Documental"}
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    onChange={(e) =>
                                      handleFileChange(
                                        e.target.files?.[0] || null,
                                        setDisputeFile
                                      )
                                    }
                                  />
                                </label>
                                <p className="text-[10px] text-zinc-600">
                                  PDF, JPG, PNG ou WEBP Â· MÃ¡ximo 5MB
                                </p>
                              </div>

                              <button
                                onClick={handleOpenDispute}
                                disabled={submitting}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 p-4 text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-900/20 transition hover:bg-orange-500 disabled:opacity-50"
                              >
                                {submitting ? (
                                  <Loader2
                                    className="animate-spin"
                                    size={16}
                                  />
                                ) : (
                                  "Abrir ContestaÃ§Ã£o Formal"
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