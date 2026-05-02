"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useSettings } from "../../../providers/SettingsProvider";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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

const STORAGE_BUCKET = "files-main";

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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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

  const currency = (value: number | null | undefined) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value || 0));

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR");
  };

  const translateFinancialStatus = (status: string | null) => {
    const map: Record<string, string> = {
      pending: "Pendente",
      paid: "Pago",
      received: "Recebido",
      overdue: "Vencido",
      cancelled: "Cancelado",
    };
    return map[status || ""] || status || "-";
  };

  const translateWorkflowStatus = (status: string | null) => {
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
  };

  const translateDisputeCategory = (value: string | null) => {
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

  const translateEventType = (value: string) => {
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
  };

  const buildGroupKey = (item: FinancialTransaction) => {
    if (item.service_order_id) return `os:${item.service_order_id}`;
    if (item.quote_id) return `quote:${item.quote_id}`;
    if (item.document_number) return `doc:${item.document_number}`;

    const normalizedDescription = (item.description || "").replace(/-\s*parcela\s*\d+\/\d+/i, "").trim();
    if (normalizedDescription) return `desc:${normalizedDescription}`;

    return `single:${item.id}`;
  };

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
      setTransactions([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as FinancialTransaction[];
    setTransactions(rows);
    setLoading(false);
  }, [resolvedClientId]);

  const fetchDetails = useCallback(async (transactionId: string) => {
    setDetailLoading(true);

    const [eventsResult, attachmentsResult] = await Promise.all([
      supabase
        .from("financial_transaction_events")
        .select("id, financial_transaction_id, author_id, author_type, visibility, event_type, title, message, metadata, created_at")
        .eq("financial_transaction_id", transactionId)
        .eq("visibility", "shared")
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_transaction_attachments")
        .select("id, financial_transaction_id, event_id, uploaded_by, uploaded_by_type, visibility, attachment_type, file_name, file_path, file_url, mime_type, file_size, created_at")
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
      const normalizedTitle = (item.description || "Fatura").replace(/-\s*parcela\s*\d+\/\d+/i, "").trim();

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title: normalizedTitle,
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
      group.items.push(item);
      group.totalAmount += Number(item.amount || 0);

      const isPaid = item.status === "paid" || item.status === "received" || item.workflow_status === "confirmed";
      if (isPaid) {
        group.paidAmount += Number(item.amount || 0);
      } else {
        group.openAmount += Number(item.amount || 0);
      }

      if (new Date(item.due_date) < new Date(group.earliestDueDate)) group.earliestDueDate = item.due_date;
      if (new Date(item.due_date) > new Date(group.latestDueDate)) group.latestDueDate = item.due_date;
      if ((item.total_installments || 1) > group.totalInstallments) group.totalInstallments = item.total_installments || 1;
      if (!group.documentNumber && item.document_number) group.documentNumber = item.document_number;
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.earliestDueDate).getTime() - new Date(b.earliestDueDate).getTime()
    );
  }, [transactions]);

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
      fetchDetails(selectedId);
    }
  }, [selectedId, fetchDetails]);

  const selectedTransaction = useMemo(
    () => transactions.find((item) => item.id === selectedId) || null,
    [transactions, selectedId]
  );

  const summary = useMemo(() => {
    const today = new Date();
    const open = transactions.filter((item) => item.status !== "paid" && item.status !== "received");
    const paid = transactions.filter((item) => item.status === "paid" || item.status === "received");
    const overdue = open.filter((item) => new Date(item.due_date) < today);

    return {
      totalOpen: open.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      totalPaid: paid.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      totalOverdue: overdue.reduce((acc, item) => acc + Number(item.amount || 0), 0),
    };
  }, [transactions]);

  const selectedGroup = useMemo(
    () => groupedInvoices.find((group) => group.items.some((item) => item.id === selectedId)) || null,
    [groupedInvoices, selectedId]
  );

  const getStatusBadge = (item: FinancialTransaction) => {
    const status = item.status || "pending";
    const isPaid = status === "paid" || status === "received" || item.workflow_status === "confirmed";
    const isDisputed = item.dispute_status && item.dispute_status !== "none" && item.dispute_status !== "resolved";
    const isAwaitingFinance = item.workflow_status === "awaiting_finance" || item.workflow_status === "under_review";
    const isOverdue = !isPaid && new Date(item.due_date) < new Date();

    if (isPaid) {
      return <span className="inline-flex rounded-full border border-cs-green/20 bg-cs-green/10 px-3 py-1 text-xs font-bold text-cs-green">Pago</span>;
    }

    if (isDisputed) {
      return <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400">Contestação</span>;
    }

    if (isAwaitingFinance) {
      return <span className="inline-flex rounded-full border border-cs-gold/20 bg-cs-gold/10 px-3 py-1 text-xs font-bold text-cs-gold">Em análise</span>;
    }

    if (isOverdue) {
      return <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">Vencido</span>;
    }

    return <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">Em aberto</span>;
  };

  const uploadFile = async (file: File, transactionId: string, attachmentType: string) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `financial/${resolvedClientId}/${transactionId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });

    if (uploadError) {
      throw new Error(uploadError.message || "Erro ao enviar arquivo.");
    }

    return {
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size || null,
      attachment_type: attachmentType,
    };
  };

  const refreshAll = async (transactionId: string) => {
    await fetchTransactions();
    setSelectedId(transactionId);
    await fetchDetails(transactionId);
  };

  const handleReportPayment = async () => {
    if (!selectedTransaction) return;
    if (!paymentForm.amount || !paymentForm.method || !paymentForm.message.trim()) {
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
            valor: Number(paymentForm.amount),
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
          payment_reported_amount: Number(paymentForm.amount),
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

      setPaymentForm({ amount: "", method: "pix", reference: "", message: "" });
      setPaymentFile(null);
      showToast("Pagamento informado com sucesso.", "success");
      await refreshAll(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao informar pagamento.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDispute = async () => {
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

      setDisputeForm({ category: "amount_divergence", reason: "", message: "" });
      setDisputeFile(null);
      showToast("Contestação registrada com sucesso.", "success");
      await refreshAll(selectedTransaction.id);
    } catch (error: any) {
      showToast(error?.message || "Erro ao abrir contestação.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const resolveAttachmentUrls = useCallback(async () => {
    const pending = attachments.filter((file) => file.file_path && !signedUrls[file.id]);
    if (pending.length === 0) return;

    const nextMap: Record<string, string> = {};

    await Promise.all(
      pending.map(async (file) => {
        const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.file_path, 3600);
        if (data?.signedUrl) {
          nextMap[file.id] = data.signedUrl;
        }
      })
    );

    if (Object.keys(nextMap).length > 0) {
      setSignedUrls((prev) => ({ ...prev, ...nextMap }));
    }
  }, [attachments, signedUrls]);

  useEffect(() => {
    resolveAttachmentUrls();
  }, [resolveAttachmentUrls]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <main className="min-h-screen bg-background text-white p-8">
      {toast.text ? (
        <div className={`fixed bottom-6 right-6 z-[100] rounded-lg border px-5 py-3 text-sm font-bold shadow-2xl ${toast.type === "success" ? "border-cs-green bg-[#1a1413] text-cs-green" : "border-red-500 bg-[#1a1413] text-red-400"}`}>
          {toast.text}
        </div>
      ) : null}

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-surface/50 bg-surface p-6 shadow-lg">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl">
            <CreditCard className="text-cs-gold" size={28} />
            Faturas
          </h1>
          <p className="mt-2 text-sm text-text-secondary sm:text-base">
            Acompanhe cobranças, informe pagamento, anexe comprovantes e conteste lançamentos pelo portal do {clientSingular.toLowerCase()}.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-surface/50 bg-surface p-5 shadow-md">
            <p className="text-xs uppercase tracking-wider text-text-secondary">Em aberto</p>
            <p className="mt-3 text-2xl font-bold text-white">{currency(summary.totalOpen)}</p>
          </div>
          <div className="rounded-2xl border border-surface/50 bg-surface p-5 shadow-md">
            <p className="text-xs uppercase tracking-wider text-text-secondary">Pagos</p>
            <p className="mt-3 text-2xl font-bold text-cs-green">{currency(summary.totalPaid)}</p>
          </div>
          <div className="rounded-2xl border border-surface/50 bg-surface p-5 shadow-md">
            <p className="text-xs uppercase tracking-wider text-text-secondary">Vencidos</p>
            <p className="mt-3 text-2xl font-bold text-red-400">{currency(summary.totalOverdue)}</p>
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-cs-gold" size={38} />
          </div>
        ) : groupedInvoices.length === 0 ? (
          <section className="rounded-2xl border border-surface/50 bg-surface p-10 text-center shadow-lg">
            <FileText className="mx-auto mb-4 text-surface" size={44} />
            <h2 className="text-xl font-bold text-white">Nenhuma fatura encontrada</h2>
            <p className="mt-2 text-sm text-text-secondary">Não há cobranças vinculadas ao seu cadastro neste momento.</p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-surface/50 bg-surface shadow-lg overflow-hidden">
              <div className="border-b border-surface/50 px-5 py-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Cobranças</h2>
              </div>
              <div className="max-h-[900px] overflow-y-auto">
                {groupedInvoices.map((group) => {
                  const isExpanded = expandedGroups[group.id];
                  const hasMany = group.items.length > 1;
                  const hasSelected = group.items.some((item) => item.id === selectedId);

                  return (
                    <div key={group.id} className="border-b border-surface/40">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasMany) {
                            toggleGroup(group.id);
                          } else {
                            setSelectedId(group.items[0].id);
                          }
                        }}
                        className={`w-full px-5 py-4 text-left transition-colors hover:bg-background/30 ${hasSelected ? "bg-background/20" : "bg-transparent"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 font-semibold text-white">{group.title}</p>
                            <p className="mt-1 text-xs text-text-secondary">Documento: {group.documentNumber || "-"}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {hasMany
                                ? `Parcelas: ${group.items.length} · De ${formatDate(group.earliestDueDate)} até ${formatDate(group.latestDueDate)}`
                                : `Vencimento: ${formatDate(group.items[0].due_date)}`}
                            </p>
                          </div>
                          {hasMany ? (
                            isExpanded ? <ChevronDown className="shrink-0 text-text-secondary" size={18} /> : <ChevronRight className="shrink-0 text-text-secondary" size={18} />
                          ) : (
                            <ChevronRight className="shrink-0 text-text-secondary" size={18} />
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-white">{currency(group.totalAmount)}</span>
                          {hasMany ? (
                            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">
                              {group.items.length} parcelas
                            </span>
                          ) : (
                            getStatusBadge(group.items[0])
                          )}
                        </div>
                      </button>

                      {hasMany && isExpanded ? (
                        <div className="border-t border-surface/30 bg-background/20">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedId(item.id)}
                              className={`flex w-full items-center justify-between gap-3 border-b border-surface/20 px-5 py-3 text-left transition-colors hover:bg-background/30 last:border-b-0 ${selectedId === item.id ? "bg-background/30" : "bg-transparent"}`}
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  Parcela {item.installment_number || 1}/{item.total_installments || group.items.length}
                                </p>
                                <p className="mt-1 text-xs text-text-secondary">Vencimento: {formatDate(item.due_date)}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-white">{currency(item.amount)}</span>
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
            </div>

            <div className="rounded-2xl border border-surface/50 bg-surface shadow-lg">
              {!selectedTransaction ? (
                <div className="p-8 text-sm text-text-secondary">Selecione uma cobrança.</div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="border-b border-surface/50 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white">{selectedGroup?.title || selectedTransaction.description}</h2>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm text-text-secondary">
                          <span>Documento: {selectedTransaction.document_number || "-"}</span>
                          <span>Vencimento: {formatDate(selectedTransaction.due_date)}</span>
                          <span>Parcela: {selectedTransaction.installment_number && selectedTransaction.total_installments ? `${selectedTransaction.installment_number}/${selectedTransaction.total_installments}` : "Única"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-extrabold text-white">{currency(selectedTransaction.amount)}</p>
                        <div className="mt-3 flex justify-end">{getStatusBadge(selectedTransaction)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 p-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-6">
                      <section className="rounded-2xl border border-surface/50 bg-background/30 p-5">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white">Resumo</h3>
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-text-secondary">Status financeiro</p>
                            <p className="mt-1 text-sm font-medium text-white">{translateFinancialStatus(selectedTransaction.status)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-text-secondary">Workflow</p>
                            <p className="mt-1 text-sm font-medium text-white">{translateWorkflowStatus(selectedTransaction.workflow_status)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-text-secondary">Pagamento informado</p>
                            <p className="mt-1 text-sm font-medium text-white">{selectedTransaction.payment_reported_at ? formatDateTime(selectedTransaction.payment_reported_at) : "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-text-secondary">Pagamento confirmado</p>
                            <p className="mt-1 text-sm font-medium text-white">{selectedTransaction.payment_confirmed_at ? formatDateTime(selectedTransaction.payment_confirmed_at) : "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-text-secondary">Categoria da contestação</p>
                            <p className="mt-1 text-sm font-medium text-white">{translateDisputeCategory(selectedTransaction.dispute_category)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-text-secondary">Motivo da contestação</p>
                            <p className="mt-1 text-sm font-medium text-white">{selectedTransaction.dispute_reason || "-"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-xs uppercase tracking-wider text-text-secondary">Observações</p>
                            <p className="mt-1 text-sm text-white">{selectedTransaction.invoice_notes || selectedTransaction.notes || "-"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-xs uppercase tracking-wider text-text-secondary">Resultado / retorno do financeiro</p>
                            <p className="mt-1 text-sm text-white">{selectedTransaction.resolution_notes || "-"}</p>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-surface/50 bg-background/30 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Timeline</h3>
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
                                  {event.author_type === "client" ? "Cliente" : event.author_type === "finance" ? "Financeiro" : "Sistema"}
                                </p>
                                <p className="mt-3 text-sm text-zinc-200">{event.message || "-"}</p>
                                {event.metadata && Object.keys(event.metadata).length > 0 ? (
                                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {Object.entries(event.metadata).map(([key, value]) => (
                                      <div key={key} className="rounded-lg border border-surface/40 bg-background/30 px-3 py-2 text-xs text-text-secondary">
                                        <span className="block uppercase tracking-wider">{key.replaceAll("_", " ")}</span>
                                        <span className="mt-1 block text-white">{String(value ?? "-")}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-surface/50 bg-background/30 p-5">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white">Anexos</h3>
                        <div className="mt-4 space-y-3">
                          {attachments.length === 0 ? (
                            <p className="text-sm text-text-secondary">Nenhum anexo disponível.</p>
                          ) : (
                            attachments.map((file) => (
                              <div key={file.id} className="flex flex-col gap-3 rounded-xl border border-surface/50 bg-surface p-4 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-white">{file.file_name}</p>
                                  <p className="mt-1 text-xs uppercase tracking-wider text-text-secondary">{file.attachment_type} · {formatDateTime(file.created_at)}</p>
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
                    </div>

                    <div className="space-y-6">
                      <section className="rounded-2xl border border-cs-green/20 bg-cs-green/5 p-5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="text-cs-green" size={18} />
                          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Informar pagamento</h3>
                        </div>
                        <div className="mt-4 space-y-4">
                          <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Valor pago</label>
                            <input
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                              className="w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-green"
                              placeholder="0,00"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Forma de pagamento</label>
                            <select
                              value={paymentForm.method}
                              onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value }))}
                              className="w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-green"
                            >
                              <option value="pix">PIX</option>
                              <option value="boleto">Boleto</option>
                              <option value="transferencia">Transferência</option>
                              <option value="cartao">Cartão</option>
                              <option value="outro">Outro</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Referência</label>
                            <input
                              value={paymentForm.reference}
                              onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                              className="w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-green"
                              placeholder="ID da transação, banco ou observação"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Mensagem</label>
                            <textarea
                              value={paymentForm.message}
                              onChange={(e) => setPaymentForm((prev) => ({ ...prev, message: e.target.value }))}
                              className="min-h-[110px] w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-cs-green"
                              placeholder="Descreva o pagamento realizado."
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">Comprovante</label>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface bg-background px-4 py-3 text-sm text-white hover:border-cs-green">
                              <Upload size={16} />
                              <span>{paymentFile ? paymentFile.name : "Selecionar arquivo"}</span>
                              <input type="file" className="hidden" onChange={(e) => setPaymentFile(e.target.files?.[0] || null)} />
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={handleReportPayment}
                            disabled={submitting}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cs-green px-4 py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {submitting ? <Loader2 className="animate-spin" size={18} /> : <CircleDollarSign size={18} />}
                            Registrar pagamento
                          </button>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="text-orange-400" size={18} />
                          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Contestar cobrança</h3>
                        </div>
                        <div className="mt-4 space-y-4">
                          <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Categoria</label>
                            <select
                              value={disputeForm.category}
                              onChange={(e) => setDisputeForm((prev) => ({ ...prev, category: e.target.value }))}
                              className="w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400"
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
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Motivo curto</label>
                            <input
                              value={disputeForm.reason}
                              onChange={(e) => setDisputeForm((prev) => ({ ...prev, reason: e.target.value }))}
                              className="w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400"
                              placeholder="Resumo objetivo do problema"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Descrição</label>
                            <textarea
                              value={disputeForm.message}
                              onChange={(e) => setDisputeForm((prev) => ({ ...prev, message: e.target.value }))}
                              className="min-h-[110px] w-full rounded-lg border border-surface bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400"
                              placeholder="Explique a contestação com detalhes."
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">Anexo</label>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-surface bg-background px-4 py-3 text-sm text-white hover:border-orange-400">
                              <Upload size={16} />
                              <span>{disputeFile ? disputeFile.name : "Selecionar arquivo"}</span>
                              <input type="file" className="hidden" onChange={(e) => setDisputeFile(e.target.files?.[0] || null)} />
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={handleOpenDispute}
                            disabled={submitting}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {submitting ? <Loader2 className="animate-spin" size={18} /> : <MessageSquare size={18} />}
                            Abrir contestação
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}