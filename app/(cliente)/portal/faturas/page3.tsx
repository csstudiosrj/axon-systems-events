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
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// --- FUNÇÕES AUXILIARES DE FORMATAÇÃO E NORMALIZAÇÃO ---

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
    return `so_inst:${item.service_order_id}:${documentNumber || cleanedDescription || amount}:${totalInstallments}`;
  }
  if (item.quote_id && totalInstallments > 1) {
    return `q_inst:${item.quote_id}:${documentNumber || cleanedDescription || amount}:${totalInstallments}`;
  }
  if (documentNumber && totalInstallments > 1) {
    return `doc_inst:${documentNumber}:${totalInstallments}`;
  }
  if (cleanedDescription && totalInstallments > 1) {
    return `desc_inst:${cleanedDescription}:${amount}:${totalInstallments}`;
  }
  if (item.service_order_id) {
    return `so_sng:${item.service_order_id}:${documentNumber || cleanedDescription || amount}`;
  }
  if (item.quote_id) {
    return `q_sng:${item.quote_id}:${documentNumber || cleanedDescription || amount}`;
  }
  if (documentNumber) {
    return `doc_sng:${documentNumber}:${amount}`;
  }
  return `sng:${item.id}`;
}

function sortTransactionsInGroup(items: FinancialTransaction[]) {
  return [...items].sort((a, b) => {
    const instA = a.installment_number ?? 9999;
    const instB = b.installment_number ?? 9999;
    if (instA !== instB) return instA - instB;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}

// --- COMPONENTE PRINCIPAL ---

export default function PortalFaturasPage() {
  const { resolvedClientId, systemPreferences, companyProfile } = useSettings();

  // Estados
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

  // Configurações White Label
  const labels = systemPreferences?.custom_labels;
  const invoiceSingular = labels?.entity_invoice_singular || "Fatura";
  const invoicePlural = labels?.entity_invoice_plural || "Faturas";
  const clientSingular = labels?.entity_client_singular || "Cliente";
  const quoteSingular = labels?.entity_quote_singular || "Orçamento";
  const serviceOrderSingular = labels?.entity_service_order_singular || "Ordem de Serviço";
  const brandName = companyProfile?.company_name || "ARXUM Systems";
  const brandColor = companyProfile?.primary_color || "#138946";
  const currencyCode = systemPreferences?.currency_code || "BRL";

  // --- HELPERS DE INTERFACE ---

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToast({ text, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast({ type: "success", text: "" }), 4000);
  }, []);

  const formatCurrency = useCallback(
    (value: number | string | null | undefined) => {
      const num = typeof value === "string" ? parseFloat(value) : value;
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currencyCode,
      }).format(Number(num || 0));
    },
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

  const getStatusBadge = useCallback((item: FinancialTransaction) => {
    const isPaid = item.status === "paid" || item.status === "received" || item.workflow_status === "confirmed";
    const isDisputed = !!item.dispute_status && item.dispute_status !== "none" && item.dispute_status !== "resolved";
    const isAwaiting = item.workflow_status === "awaiting_finance" || item.workflow_status === "under_review";
    const isOverdue = !isPaid && new Date(item.due_date) < new Date();

    if (isPaid) return <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">Pago</span>;
    if (isDisputed) return <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">Contestação</span>;
    if (isAwaiting) return <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">Em análise</span>;
    if (isOverdue) return <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">Vencido</span>;
    return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">Em aberto</span>;
  }, []);

  // --- LOGICA DE DADOS ---

  const fetchTransactions = useCallback(async () => {
    if (!resolvedClientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);

    const { data, error } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("client_id", resolvedClientId)
      .order("due_date", { ascending: true });

    if (error) {
      showToast("Erro ao carregar cobranças.", "error");
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  }, [resolvedClientId, showToast]);

  const fetchDetails = useCallback(async (transactionId: string) => {
    setDetailLoading(true);
    const [ev, att] = await Promise.all([
      supabase.from("financial_transaction_events").select("*").eq("financial_transaction_id", transactionId).eq("visibility", "shared").order("created_at", { ascending: false }),
      supabase.from("financial_transaction_attachments").select("*").eq("financial_transaction_id", transactionId).eq("visibility", "shared").order("created_at", { ascending: false }),
    ]);
    setEvents(ev.data || []);
    setAttachments(att.data || []);
    setDetailLoading(false);
  }, []);

  useEffect(() => { void fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { if (selectedId) void fetchDetails(selectedId); }, [selectedId, fetchDetails]);

  // Agrupamento
  const groupedInvoices = useMemo(() => {
    const map = new Map<string, InvoiceGroup>();
    transactions.forEach(item => {
      const key = buildStrongGroupKey(item);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title: extractBaseTitle(item, invoiceSingular),
          documentNumber: item.document_number,
          totalAmount: 0, paidAmount: 0, openAmount: 0,
          earliestDueDate: item.due_date, latestDueDate: item.due_date,
          totalInstallments: item.total_installments || 1,
          sourceLabel: item.service_order_id ? serviceOrderSingular : item.quote_id ? quoteSingular : item.source,
          items: []
        });
      }
      const g = map.get(key)!;
      g.items.push(item);
      g.totalAmount += Number(item.amount);
      const isPaid = item.status === "paid" || item.status === "received" || item.workflow_status === "confirmed";
      if (isPaid) g.paidAmount += Number(item.amount); else g.openAmount += Number(item.amount);
      if (new Date(item.due_date) < new Date(g.earliestDueDate)) g.earliestDueDate = item.due_date;
      if (new Date(item.due_date) > new Date(g.latestDueDate)) g.latestDueDate = item.due_date;
    });
    return Array.from(map.values()).map(g => ({ ...g, items: sortTransactionsInGroup(g.items) }))
      .sort((a, b) => new Date(a.earliestDueDate).getTime() - new Date(b.earliestDueDate).getTime());
  }, [transactions, invoiceSingular, serviceOrderSingular, quoteSingular]);

  // Seleção inicial
  useEffect(() => {
    if (groupedInvoices.length > 0 && !selectedId) {
      setSelectedId(groupedInvoices[0].items[0].id);
    }
  }, [groupedInvoices, selectedId]);

  const selectedTransaction = useMemo(() => transactions.find(t => t.id === selectedId) || null, [transactions, selectedId]);
  const selectedGroup = useMemo(() => groupedInvoices.find(g => g.items.some(i => i.id === selectedId)), [groupedInvoices, selectedId]);

  const summary = useMemo(() => {
    const open = transactions.filter(t => !["paid", "received"].includes(t.status || "") && t.workflow_status !== "confirmed");
    const overdue = open.filter(t => new Date(t.due_date) < new Date());
    const paid = transactions.filter(t => ["paid", "received"].includes(t.status || "") || t.workflow_status === "confirmed");
    return {
      open: open.reduce((acc, t) => acc + Number(t.amount), 0),
      paid: paid.reduce((acc, t) => acc + Number(t.amount), 0),
      overdue: overdue.reduce((acc, t) => acc + Number(t.amount), 0),
    };
  }, [transactions]);

  // --- AÇÕES ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "payment" | "dispute") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showToast("Arquivo muito grande. Máximo 5MB.", "error");
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      showToast("Formato não permitido. Use PDF, JPG ou PNG.", "error");
      return;
    }

    if (type === "payment") setPaymentFile(file);
    else setDisputeFile(file);
  };

  const handleReportPayment = async () => {
    if (!selectedTransaction || submitting) return;
    const amountNum = parseCurrencyToNumber(paymentForm.amount);

    if (amountNum <= 0 || !paymentForm.message.trim()) {
      showToast("Informe o valor e uma mensagem descritiva.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const { data: ev, error: evErr } = await supabase.from("financial_transaction_events").insert({
        financial_transaction_id: selectedTransaction.id,
        author_id: currentUserId,
        author_type: "client",
        visibility: "shared",
        event_type: "payment_reported",
        title: `Pagamento informado pelo ${clientSingular.toLowerCase()}`,
        message: paymentForm.message.trim(),
        metadata: { valor: amountNum, forma_pagamento: paymentForm.method, referencia: paymentForm.reference }
      }).select().single();

      if (evErr) throw evErr;

      if (paymentFile) {
        const path = `financial/${resolvedClientId}/${selectedTransaction.id}/${Date.now()}-${paymentFile.name}`;
        const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, paymentFile);
        if (upErr) throw upErr;

        await supabase.from("financial_transaction_attachments").insert({
          financial_transaction_id: selectedTransaction.id,
          event_id: ev.id,
          uploaded_by: currentUserId,
          uploaded_by_type: "client",
          visibility: "shared",
          attachment_type: "receipt",
          file_name: paymentFile.name,
          file_path: path,
          mime_type: paymentFile.type,
          file_size: paymentFile.size
        });
      }

      await supabase.from("financial_transactions").update({
        workflow_status: "awaiting_finance",
        payment_reported_amount: amountNum,
        payment_reported_method: paymentForm.method,
        payment_reported_at: new Date().toISOString(),
        customer_last_action_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString(),
      }).eq("id", selectedTransaction.id);

      showToast("Pagamento registrado com sucesso!", "success");
      setOpenActionPanel(null);
      setPaymentForm({ amount: "", method: "pix", reference: "", message: "" });
      setPaymentFile(null);
      await fetchTransactions();
      await fetchDetails(selectedTransaction.id);
    } catch (err: any) {
      showToast(err.message || "Erro ao processar.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!selectedTransaction || submitting) return;
    if (!disputeForm.reason.trim() || !disputeForm.message.trim()) {
      showToast("Preencha o motivo e a descrição.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const { data: ev, error: evErr } = await supabase.from("financial_transaction_events").insert({
        financial_transaction_id: selectedTransaction.id,
        author_id: currentUserId,
        author_type: "client",
        visibility: "shared",
        event_type: "dispute_opened",
        title: `Contestação aberta pelo ${clientSingular.toLowerCase()}`,
        message: disputeForm.message.trim(),
        metadata: { categoria: disputeForm.category, motivo: disputeForm.reason }
      }).select().single();

      if (evErr) throw evErr;

      if (disputeFile) {
        const path = `financial/${resolvedClientId}/${selectedTransaction.id}/${Date.now()}-${disputeFile.name}`;
        const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, disputeFile);
        if (upErr) throw upErr;

        await supabase.from("financial_transaction_attachments").insert({
          financial_transaction_id: selectedTransaction.id,
          event_id: ev.id,
          uploaded_by: currentUserId,
          uploaded_by_type: "client",
          visibility: "shared",
          attachment_type: "dispute_evidence",
          file_name: disputeFile.name,
          file_path: path,
          mime_type: disputeFile.type,
          file_size: disputeFile.size
        });
      }

      await supabase.from("financial_transactions").update({
        workflow_status: "disputed",
        dispute_status: "open",
        dispute_category: disputeForm.category,
        dispute_reason: disputeForm.reason,
        customer_last_action_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString(),
      }).eq("id", selectedTransaction.id);

      showToast("Contestação enviada com sucesso.", "success");
      setOpenActionPanel(null);
      setDisputeForm({ category: "amount_divergence", reason: "", message: "" });
      setDisputeFile(null);
      await fetchTransactions();
      await fetchDetails(selectedTransaction.id);
    } catch (err: any) {
      showToast(err.message || "Erro ao processar.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Signed URLs para anexos
  useEffect(() => {
    const loadUrls = async () => {
      const newUrls: Record<string, string> = { ...signedUrls };
      for (const att of attachments) {
        if (!newUrls[att.id] && att.file_path) {
          const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(att.file_path, 3600);
          if (data?.signedUrl) newUrls[att.id] = data.signedUrl;
        }
      }
      setSignedUrls(newUrls);
    };
    if (attachments.length > 0) void loadUrls();
  }, [attachments, signedUrls]);

  return (
    <main className="min-h-screen bg-[#0b0d12] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Toast Notification */}
        {toast.text && (
          <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}>
            {toast.type === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span className="text-sm font-bold">{toast.text}</span>
            <button onClick={() => setToast({ ...toast, text: "" })} className="ml-2 opacity-50 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Header Section */}
        <header className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-8 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ borderColor: `${brandColor}40`, backgroundColor: `${brandColor}15`, color: brandColor }}>
                <CreditCard size={14} />
                {brandName}
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{invoicePlural}</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Gerencie seus pagamentos, acesse comprovantes e resolva pendências do seu portal {clientSingular.toLowerCase()}.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:w-[500px]">
              {[
                { label: "Em aberto", val: summary.open, color: "text-white" },
                { label: "Pagos", val: summary.paid, color: "text-emerald-400" },
                { label: "Vencidos", val: summary.overdue, color: "text-red-400" }
              ].map((card, i) => (
                <div key={i} className="rounded-2xl border border-white/5 bg-black/40 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{card.label}</p>
                  <p className={`mt-2 text-xl font-black ${card.color}`}>{formatCurrency(card.val)}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-[32px] border border-white/10 bg-white/[0.02]">
            <Loader2 className="animate-spin text-zinc-500" size={32} />
          </div>
        ) : groupedInvoices.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-[32px] border border-white/10 bg-white/[0.02] text-center">
            <FileText className="mb-4 text-zinc-700" size={48} />
            <h3 className="text-lg font-bold">Nenhuma fatura encontrada</h3>
            <p className="text-sm text-zinc-500">Você não possui cobranças registradas no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[400px_1fr]">
            
            {/* Sidebar: Lista de Faturas */}
            <aside className="h-fit overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] shadow-xl">
              <div className="border-b border-white/10 p-6">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Suas Cobranças</h2>
              </div>
              <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                {groupedInvoices.map((group) => {
                  const isExpanded = expandedGroups[group.id];
                  const hasSelected = group.items.some(i => i.id === selectedId);
                  
                  return (
                    <div key={group.id} className="border-b border-white/5 last:border-b-0">
                      <button
                        onClick={() => group.items.length > 1 ? setExpandedGroups(p => ({ ...p, [group.id]: !p[group.id] })) : setSelectedId(group.items[0].id)}
                        className={`group w-full p-6 text-left transition-all ${hasSelected && group.items.length === 1 ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-bold text-white">{group.title}</span>
                              {group.sourceLabel && (
                                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase text-zinc-500">{group.sourceLabel}</span>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-500">Doc: {group.documentNumber || "S/N"}</p>
                          </div>
                          {group.items.length > 1 && (
                            <ChevronDown size={16} className={`text-zinc-600 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          )}
                        </div>
                        <div className="mt-4 flex items-end justify-between">
                          <div>
                            <p className="text-lg font-black">{formatCurrency(group.totalAmount)}</p>
                            <p className="text-[10px] text-zinc-500">
                              {group.items.length > 1 ? `${group.items.length} parcelas` : `Venc: ${formatDate(group.items[0].due_date)}`}
                            </p>
                          </div>
                          {group.items.length === 1 && getStatusBadge(group.items[0])}
                        </div>
                      </button>

                      {isExpanded && group.items.length > 1 && (
                        <div className="bg-black/20">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setSelectedId(item.id)}
                              className={`relative flex w-full items-center justify-between border-t border-white/5 p-5 pl-8 text-left transition-all ${
                                selectedId === item.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                              }`}
                            >
                              {selectedId === item.id && (
                                <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: brandColor }} />
                              )}
                              <div>
                                <p className="text-xs font-bold">Parcela {item.installment_number}/{item.total_installments}</p>
                                <p className="text-[10px] text-zinc-500">{formatDate(item.due_date)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black">{formatCurrency(item.amount)}</p>
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

            {/* Main Content: Detalhes da Fatura */}
            <section className="min-w-0 space-y-6">
              {selectedTransaction ? (
                <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] shadow-xl">
                  {/* Detalhe Header */}
                  <div className="border-b border-white/10 p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight">{selectedGroup?.title || selectedTransaction.description}</h2>
                        <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-zinc-500">
                          <span className="flex items-center gap-1.5"><FileText size={14} /> Doc: {selectedTransaction.document_number || "-"}</span>
                          <span className="flex items-center gap-1.5"><CreditCard size={14} /> Parcela: {selectedTransaction.installment_number || 1}/{selectedTransaction.total_installments || 1}</span>
                          <span className="flex items-center gap-1.5"><CircleDollarSign size={14} /> Vencimento: {formatDate(selectedTransaction.due_date)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-black">{formatCurrency(selectedTransaction.amount)}</p>
                        <div className="mt-2 flex justify-end">{getStatusBadge(selectedTransaction)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 p-8 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-8">
                      {/* Timeline */}
                      <section>
                        <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Histórico da Fatura</h3>
                        <div className="space-y-4">
                          {detailLoading ? (
                            <Loader2 className="animate-spin text-zinc-700" size={20} />
                          ) : events.length === 0 ? (
                            <p className="text-sm text-zinc-600">Nenhuma interação registrada.</p>
                          ) : (
                            events.map(ev => (
                              <div key={ev.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-zinc-400">{ev.title}</span>
                                  <span className="text-[10px] text-zinc-600">{formatDateTime(ev.created_at)}</span>
                                </div>
                                <p className="text-sm leading-relaxed text-zinc-300">{ev.message}</p>
                                {ev.metadata && (
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {Object.entries(ev.metadata).map(([k, v]) => (
                                      <div key={k} className="rounded-lg bg-black/40 px-3 py-1.5">
                                        <span className="block text-[8px] font-black uppercase text-zinc-600">{k.replace("_", " ")}</span>
                                        <span className="text-[11px] font-bold text-zinc-400">{String(v)}</span>
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
                      <section>
                        <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Documentos e Comprovantes</h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {attachments.map(att => (
                            <a key={att.id} href={signedUrls[att.id]} target="_blank" rel="noreferrer" 
                              className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.05]">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400 group-hover:text-white">
                                <Paperclip size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold">{att.file_name}</p>
                                <p className="text-[9px] uppercase font-black text-zinc-600">{att.attachment_type}</p>
                              </div>
                            </a>
                          ))}
                          {attachments.length === 0 && <p className="text-sm text-zinc-600">Nenhum anexo disponível.</p>}
                        </div>
                      </section>
                    </div>

                    {/* Painéis de Ação */}
                    <aside className="space-y-4">
                      {/* Botão Informar Pagamento */}
                      <div className={`rounded-[24px] border transition-all ${openActionPanel === "payment" ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                        <button onClick={() => setOpenActionPanel(p => p === "payment" ? null : "payment")}
                          className="flex w-full items-center justify-between p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                              <CheckCircle2 size={20} />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-black uppercase tracking-widest">Paguei</p>
                              <p className="text-[10px] text-zinc-500">Informar pagamento</p>
                            </div>
                          </div>
                          <ChevronDown size={16} className={`transition-transform ${openActionPanel === "payment" ? "rotate-180" : ""}`} />
                        </button>

                        {openActionPanel === "payment" && (
                          <div className="space-y-4 p-5 pt-0">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Valor Pago</label>
                              <input 
                                type="text"
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm(p => ({ ...p, amount: handleCurrencyInput(e.target.value) }))}
                                placeholder="R$ 0,00"
                                className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm font-bold outline-none focus:border-emerald-500/50"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Forma</label>
                              <select 
                                value={paymentForm.method}
                                onChange={(e) => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                                className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm font-bold outline-none focus:border-emerald-500/50"
                              >
                                <option value="pix">PIX</option>
                                <option value="boleto">Boleto</option>
                                <option value="transferencia">Transferência</option>
                                <option value="cartao">Cartão</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Mensagem</label>
                              <textarea 
                                value={paymentForm.message}
                                onChange={(e) => setPaymentForm(p => ({ ...p, message: e.target.value }))}
                                className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-sm font-medium outline-none focus:border-emerald-500/50"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 transition-hover hover:bg-black/40">
                                <Upload size={16} className="text-zinc-500" />
                                <span className="truncate text-[11px] font-bold text-zinc-400">{paymentFile ? paymentFile.name : "Anexar Comprovante"}</span>
                                <input type="file" className="hidden" onChange={(e) => handleFileChange(e, "payment")} accept=".pdf,.jpg,.jpeg,.png" />
                              </label>
                            </div>
                            <button 
                              onClick={handleReportPayment}
                              disabled={submitting}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 p-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {submitting ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Confirmar</>}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Botão Contestar */}
                      <div className={`rounded-[24px] border transition-all ${openActionPanel === "dispute" ? "border-orange-500/40 bg-orange-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                        <button onClick={() => setOpenActionPanel(p => p === "dispute" ? null : "dispute")}
                          className="flex w-full items-center justify-between p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                              <AlertTriangle size={20} />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-black uppercase tracking-widest">Problema</p>
                              <p className="text-[10px] text-zinc-500">Contestar valor ou data</p>
                            </div>
                          </div>
                          <ChevronDown size={16} className={`transition-transform ${openActionPanel === "dispute" ? "rotate-180" : ""}`} />
                        </button>

                        {openActionPanel === "dispute" && (
                          <div className="space-y-4 p-5 pt-0">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Motivo</label>
                              <input 
                                type="text"
                                value={disputeForm.reason}
                                onChange={(e) => setDisputeForm(p => ({ ...p, reason: e.target.value }))}
                                placeholder="Ex: Valor incorreto"
                                className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm font-bold outline-none focus:border-orange-500/50"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Descrição</label>
                              <textarea 
                                value={disputeForm.message}
                                onChange={(e) => setDisputeForm(p => ({ ...p, message: e.target.value }))}
                                className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-sm font-medium outline-none focus:border-orange-500/50"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 transition-hover hover:bg-black/40">
                                <Upload size={16} className="text-zinc-500" />
                                <span className="truncate text-[11px] font-bold text-zinc-400">{disputeFile ? disputeFile.name : "Anexar Evidência"}</span>
                                <input type="file" className="hidden" onChange={(e) => handleFileChange(e, "dispute")} accept=".pdf,.jpg,.jpeg,.png" />
                              </label>
                            </div>
                            <button 
                              onClick={handleOpenDispute}
                              disabled={submitting}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 p-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-orange-500 disabled:opacity-50"
                            >
                              {submitting ? <Loader2 className="animate-spin" size={16} /> : <><MessageSquare size={16} /> Abrir Chamado</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </aside>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[32px] border border-white/10 bg-white/[0.02] p-12 text-center">
                  <p className="text-zinc-500">Selecione uma fatura para ver os detalhes e realizar ações.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </main>
  );
}