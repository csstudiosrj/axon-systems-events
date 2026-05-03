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
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";

// --- TIPAGENS ROBUSTAS ---

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

type ToastState = { type: "success" | "error"; text: string };
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

// --- UTILITÁRIOS DE FORMATAÇÃO ---

function normalizeText(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function removeInstallmentSuffix(value: string | null | undefined) {
  return (value || "").replace(/[-–—]?\s*parcela\s*\d+\s*\/\s*\d+/i, "").replace(/\s+/g, " ").trim();
}

function buildStrongGroupKey(item: FinancialTransaction) {
  const totalInstallments = item.total_installments || 1;
  const cleanedDescription = normalizeText(removeInstallmentSuffix(item.description));
  const docNum = normalizeText(item.document_number);
  if (item.service_order_id && totalInstallments > 1) return `so_inst:${item.service_order_id}:${docNum || cleanedDescription}:${totalInstallments}`;
  if (item.quote_id && totalInstallments > 1) return `q_inst:${item.quote_id}:${docNum || cleanedDescription}:${totalInstallments}`;
  if (docNum && totalInstallments > 1) return `doc_inst:${docNum}:${totalInstallments}`;
  if (item.service_order_id) return `so_sng:${item.service_order_id}`;
  if (item.quote_id) return `q_sng:${item.quote_id}`;
  return `sng:${item.id}`;
}

export default function PortalFaturasPage() {
  const { resolvedClientId, systemPreferences, companyProfile } = useSettings();

  // Estados Principais
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [attachments, setAttachments] = useState<FinancialAttachment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ type: "success", text: "" });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openActionPanel, setOpenActionPanel] = useState<ActionPanelKey>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Estados de Formulário
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [disputeFile, setDisputeFile] = useState<File | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "pix", reference: "", message: "" });
  const [disputeForm, setDisputeForm] = useState({ category: "amount_divergence", reason: "", message: "" });
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toastTimer = useRef<number | null>(null);

  // White Label Labels
  const labels = systemPreferences?.custom_labels;
  const invoiceSingular = labels?.entity_invoice_singular || "Fatura";
  const invoicePlural = labels?.entity_invoice_plural || "Faturas";
  const clientSingular = labels?.entity_client_singular || "Cliente";
  const quoteSingular = labels?.entity_quote_singular || "Orçamento";
  const serviceOrderSingular = labels?.entity_service_order_singular || "Ordem de Serviço";
  const brandName = companyProfile?.company_name || "ARXUM Systems";
  const brandColor = companyProfile?.primary_color || "#138946";
  const currencyCode = systemPreferences?.currency_code || "BRL";

  // --- MÁSCARA DE MOEDA E FORMATAÇÃO ---

  const formatCurrency = useCallback((val: number | null | undefined) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currencyCode }).format(Number(val || 0));
  }, [currencyCode]);

  const handleCurrencyMask = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const floatValue = (Number(digits) / 100).toFixed(2);
    if (digits === "") return "";
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(floatValue));
  };

  const parseCurrencyToNumber = (value: string) => {
    return Number(value.replace(/\./g, "").replace(",", "."));
  };

  const formatDate = (val: string | null) => val ? new Date(val).toLocaleDateString("pt-BR") : "-";
  const formatDateTime = (val: string | null) => val ? new Date(val).toLocaleString("pt-BR") : "-";

  const showToast = useCallback((text: string, type: "success" | "error") => {
    setToast({ text, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast({ type: "success", text: "" }), 5000);
  }, []);

  // --- BUSCA DE DADOS ---

  const fetchTransactions = useCallback(async () => {
    if (!resolvedClientId) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);

    const { data, error } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("client_id", resolvedClientId)
      .order("due_date", { ascending: true });

    if (error) {
      showToast("Erro ao carregar dados financeiros.", "error");
    } else {
      setTransactions(data || []);
      // Lógica de Notificações: Se finance_last_action_at for posterior ao customer_last_action_at
      const unread = (data || []).filter(t => t.finance_last_action_at && (!t.customer_last_action_at || new Date(t.finance_last_action_at) > new Date(t.customer_last_action_at))).length;
      setUnreadNotifications(unread);
    }
    setLoading(false);
  }, [resolvedClientId, showToast]);

  const fetchDetails = useCallback(async (id: string) => {
    setDetailLoading(true);
    const [evRes, attRes] = await Promise.all([
      supabase.from("financial_transaction_events").select("*").eq("financial_transaction_id", id).eq("visibility", "shared").order("created_at", { ascending: false }),
      supabase.from("financial_transaction_attachments").select("*").eq("financial_transaction_id", id).eq("visibility", "shared").order("created_at", { ascending: false })
    ]);
    setEvents(evRes.data || []);
    setAttachments(attRes.data || []);
    setDetailLoading(false);
  }, []);

  useEffect(() => { void fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { if (selectedId) void fetchDetails(selectedId); }, [selectedId, fetchDetails]);

  // Alerta na Aba do Navegador
  useEffect(() => {
    if (unreadNotifications > 0) {
      document.title = `(${unreadNotifications}) Atualização em ${invoicePlural} | ${brandName}`;
    } else {
      document.title = `${invoicePlural} | ${brandName}`;
    }
  }, [unreadNotifications, invoicePlural, brandName]);

  // --- AGRUPAMENTO ---

  const groupedInvoices = useMemo(() => {
    const map = new Map<string, InvoiceGroup>();
    transactions.forEach(item => {
      const key = buildStrongGroupKey(item);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title: removeInstallmentSuffix(item.description) || invoiceSingular,
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
    return Array.from(map.values()).sort((a, b) => new Date(a.earliestDueDate).getTime() - new Date(b.earliestDueDate).getTime());
  }, [transactions, invoiceSingular, serviceOrderSingular, quoteSingular]);

  useEffect(() => {
    if (groupedInvoices.length > 0 && !selectedId) setSelectedId(groupedInvoices[0].items[0].id);
  }, [groupedInvoices, selectedId]);

  const selectedTransaction = useMemo(() => transactions.find(t => t.id === selectedId) || null, [transactions, selectedId]);
  const selectedGroup = useMemo(() => groupedInvoices.find(g => g.items.some(i => i.id === selectedId)), [groupedInvoices, selectedId]);

  // --- AÇÕES PROFISSIONAIS ---

  const handleReportPayment = async () => {
    if (!selectedTransaction || submitting) return;
    const amountNum = parseCurrencyToNumber(paymentForm.amount);
    if (amountNum <= 0 || !paymentForm.message.trim()) return showToast("Preencha o valor e a mensagem de confirmação.", "error");

    setSubmitting(true);
    try {
      const { data: ev, error: evErr } = await supabase.from("financial_transaction_events").insert({
        financial_transaction_id: selectedTransaction.id,
        author_id: currentUserId,
        author_type: "client",
        visibility: "shared",
        event_type: "payment_reported",
        title: "Notificação de Pagamento Realizado",
        message: paymentForm.message.trim(),
        metadata: { valor_informado: amountNum, metodo: paymentForm.method, referencia: paymentForm.reference }
      }).select().single();

      if (evErr) throw evErr;

      if (paymentFile) {
        const path = `financial/${resolvedClientId}/${selectedTransaction.id}/${Date.now()}-${paymentFile.name}`;
        await supabase.storage.from(STORAGE_BUCKET).upload(path, paymentFile);
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
        payment_reported_at: new Date().toISOString(),
        customer_last_action_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString()
      }).eq("id", selectedTransaction.id);

      showToast("Notificação de pagamento enviada ao financeiro.", "success");
      setOpenActionPanel(null);
      setPaymentForm({ amount: "", method: "pix", reference: "", message: "" });
      setPaymentFile(null);
      fetchTransactions();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!selectedTransaction || submitting) return;
    if (!disputeForm.reason.trim() || !disputeForm.message.trim()) return showToast("Informe o motivo e a descrição da contestação.", "error");

    setSubmitting(true);
    try {
      const { data: ev, error: evErr } = await supabase.from("financial_transaction_events").insert({
        financial_transaction_id: selectedTransaction.id,
        author_id: currentUserId,
        author_type: "client",
        visibility: "shared",
        event_type: "dispute_opened",
        title: "Abertura de Contestação Formal",
        message: disputeForm.message.trim(),
        metadata: { categoria: disputeForm.category, motivo_resumo: disputeForm.reason }
      }).select().single();

      if (evErr) throw evErr;

      if (disputeFile) {
        const path = `financial/${resolvedClientId}/${selectedTransaction.id}/${Date.now()}-${disputeFile.name}`;
        await supabase.storage.from(STORAGE_BUCKET).upload(path, disputeFile);
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
        last_interaction_at: new Date().toISOString()
      }).eq("id", selectedTransaction.id);

      showToast("Contestação formal registrada com sucesso.", "success");
      setOpenActionPanel(null);
      setDisputeForm({ category: "amount_divergence", reason: "", message: "" });
      setDisputeFile(null);
      fetchTransactions();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Signed URLs
  useEffect(() => {
    const loadUrls = async () => {
      const newUrls = { ...signedUrls };
      for (const att of attachments) {
        if (!newUrls[att.id] && att.file_path) {
          const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(att.file_path, 3600);
          if (data?.signedUrl) newUrls[att.id] = data.signedUrl;
        }
      }
      setSignedUrls(newUrls);
    };
    if (attachments.length > 0) loadUrls();
  }, [attachments, signedUrls]);

  // --- RENDERIZAÇÃO ---

  const getStatusBadge = (item: FinancialTransaction) => {
    const isPaid = item.status === "paid" || item.status === "received" || item.workflow_status === "confirmed";
    const isDisputed = !!item.dispute_status && item.dispute_status !== "none" && item.dispute_status !== "resolved";
    const isAwaiting = item.workflow_status === "awaiting_finance" || item.workflow_status === "under_review";
    const isOverdue = !isPaid && new Date(item.due_date) < new Date();

    if (isPaid) return <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">Liquidado</span>;
    if (isDisputed) return <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-400">Em Contestação</span>;
    if (isAwaiting) return <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-400">Em Análise</span>;
    if (isOverdue) return <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-400">Vencido</span>;
    return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">Pendente</span>;
  };

  return (
    <main className="min-h-screen bg-[#0b0d12] px-6 py-10 text-white selection:bg-emerald-500/30">
      <div className="mx-auto max-w-[1600px]">
        
        {/* Toast Notification */}
        {toast.text && (
          <div className={`fixed bottom-8 right-8 z-[100] flex items-center gap-4 rounded-[20px] border p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl animate-in fade-in slide-in-from-right-10 ${
            toast.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}>
            {toast.type === "success" ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest opacity-50">{toast.type === "success" ? "Sucesso" : "Erro de Sistema"}</span>
              <span className="text-sm font-bold">{toast.text}</span>
            </div>
            <button onClick={() => setToast({ ...toast, text: "" })} className="ml-4 rounded-full p-1 hover:bg-white/10"><X size={18} /></button>
          </div>
        )}

        {/* Header Profissional */}
        <header className="mb-10 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-10 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em]"
                  style={{ borderColor: `${brandColor}40`, backgroundColor: `${brandColor}15`, color: brandColor }}>
                  <CreditCard size={14} />
                  {brandName}
                </div>
                {unreadNotifications > 0 && (
                  <div className="flex items-center gap-2 rounded-full bg-orange-500/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-orange-400 animate-pulse">
                    <Bell size={12} />
                    {unreadNotifications} Novas Atualizações
                  </div>
                )}
              </div>
              <h1 className="text-4xl font-black tracking-tighter sm:text-5xl">{invoicePlural}</h1>
              <p className="max-w-2xl text-lg font-medium leading-relaxed text-zinc-400">
                Central de gestão financeira. Monitore liquidações, anexe comprovantes oficiais e registre contestações formais diretamente com nosso departamento financeiro.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:w-[600px]">
              {[
                { label: "Total em Aberto", val: transactions.filter(t => t.status !== "paid").reduce((acc, t) => acc + Number(t.amount), 0), color: "text-white" },
                { label: "Total Liquidado", val: transactions.filter(t => t.status === "paid").reduce((acc, t) => acc + Number(t.amount), 0), color: "text-emerald-400" },
                { label: "Total Vencido", val: transactions.filter(t => t.status !== "paid" && new Date(t.due_date) < new Date()).reduce((acc, t) => acc + Number(t.amount), 0), color: "text-red-400" }
              ].map((card, i) => (
                <div key={i} className="rounded-[24px] border border-white/5 bg-black/40 p-6 shadow-inner">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{card.label}</p>
                  <p className={`mt-3 text-2xl font-black ${card.color}`}>{formatCurrency(card.val)}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex h-[400px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.02]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-emerald-500" size={40} />
              <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Sincronizando Dados...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 xl:grid-cols-[450px_1fr]">
            
            {/* Sidebar: Listagem de Grupos */}
            <aside className="h-fit overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-2xl">
              <div className="border-b border-white/10 bg-white/[0.02] p-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Portfólio de Cobranças</h2>
                  <span className="rounded-lg bg-white/5 px-3 py-1 text-[10px] font-bold text-zinc-400">{groupedInvoices.length} Grupos</span>
                </div>
              </div>
              <div className="max-h-[75vh] overflow-y-auto custom-scrollbar">
                {groupedInvoices.map((group) => {
                  const isExpanded = expandedGroups[group.id];
                  const hasSelected = group.items.some(i => i.id === selectedId);
                  
                  return (
                    <div key={group.id} className="border-b border-white/5 last:border-b-0">
                      <button
                        onClick={() => group.items.length > 1 ? setExpandedGroups(p => ({ ...p, [group.id]: !p[group.id] })) : setSelectedId(group.items[0].id)}
                        className={`group w-full p-8 text-left transition-all duration-300 ${hasSelected && group.items.length === 1 ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}
                      >
                        <div className="flex items-start justify-between gap-6">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="truncate text-base font-black text-white">{group.title}</span>
                              {group.sourceLabel && (
                                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-500">{group.sourceLabel}</span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-zinc-500">Documento: {group.documentNumber || "Não Identificado"}</p>
                          </div>
                          {group.items.length > 1 && (
                            <div className={`rounded-full p-1 transition-transform duration-300 ${isExpanded ? "rotate-180 bg-white/10" : "bg-white/5"}`}>
                              <ChevronDown size={18} className="text-zinc-400" />
                            </div>
                          )}
                        </div>
                        <div className="mt-6 flex items-end justify-between">
                          <div>
                            <p className="text-2xl font-black tracking-tight">{formatCurrency(group.totalAmount)}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                              {group.items.length > 1 ? `${group.items.length} Parcelas Programadas` : `Vencimento: ${formatDate(group.items[0].due_date)}`}
                            </p>
                          </div>
                          {group.items.length === 1 && getStatusBadge(group.items[0])}
                        </div>
                      </button>

                      {isExpanded && group.items.length > 1 && (
                        <div className="bg-black/30 border-t border-white/5">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setSelectedId(item.id)}
                              className={`relative flex w-full items-center justify-between border-b border-white/5 p-6 pl-12 text-left transition-all last:border-b-0 ${
                                selectedId === item.id ? "bg-white/[0.08]" : "hover:bg-white/[0.03]"
                              }`}
                            >
                              {selectedId === item.id && (
                                <div className="absolute left-0 top-0 h-full w-1.5" style={{ backgroundColor: brandColor }} />
                              )}
                              <div className="space-y-1">
                                <p className="text-sm font-black">Parcela {item.installment_number}/{item.total_installments}</p>
                                <p className="text-[11px] font-bold text-zinc-500">{formatDate(item.due_date)}</p>
                              </div>
                              <div className="text-right space-y-2">
                                <p className="text-base font-black">{formatCurrency(item.amount)}</p>
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

            {/* Conteúdo Principal: Detalhes e Ações */}
            <section className="min-w-0 space-y-8">
              {selectedTransaction ? (
                <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-2xl">
                  
                  {/* Detalhe Header */}
                  <div className="border-b border-white/10 bg-white/[0.02] p-10">
                    <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-6">
                        <h2 className="text-3xl font-black tracking-tighter">{selectedGroup?.title || selectedTransaction.description}</h2>
                        <div className="flex flex-wrap gap-6">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Documento Fiscal</span>
                            <p className="text-sm font-bold flex items-center gap-2"><FileText size={16} className="text-emerald-500" /> {selectedTransaction.document_number || "Pendente"}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Identificação</span>
                            <p className="text-sm font-bold flex items-center gap-2"><CreditCard size={16} className="text-emerald-500" /> Parcela {selectedTransaction.installment_number || 1} de {selectedTransaction.total_installments || 1}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Data de Vencimento</span>
                            <p className="text-sm font-bold flex items-center gap-2"><CircleDollarSign size={16} className="text-emerald-500" /> {formatDate(selectedTransaction.due_date)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-3">
                        <p className="text-5xl font-black tracking-tighter">{formatCurrency(selectedTransaction.amount)}</p>
                        <div className="flex justify-end">{getStatusBadge(selectedTransaction)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-10 p-10 2xl:grid-cols-[1fr_380px]">
                    <div className="space-y-12">
                      
                      {/* Timeline de Interações */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-3">
                          <History size={20} className="text-zinc-500" />
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Histórico de Movimentações</h3>
                        </div>
                        <div className="space-y-6 relative before:absolute before:left-6 before:top-0 before:h-full before:w-px before:bg-white/5">
                          {detailLoading ? (
                            <div className="flex items-center gap-3 pl-12"><Loader2 className="animate-spin text-zinc-700" size={20} /> <span className="text-xs font-bold text-zinc-600">Recuperando histórico...</span></div>
                          ) : events.length === 0 ? (
                            <p className="pl-12 text-sm font-medium text-zinc-600">Nenhuma interação registrada para esta cobrança.</p>
                          ) : (
                            events.map(ev => (
                              <div key={ev.id} className="relative pl-12">
                                <div className="absolute left-[21px] top-2 h-2.5 w-2.5 rounded-full bg-zinc-800 border border-zinc-600" />
                                <div className="rounded-[24px] border border-white/5 bg-white/[0.02] p-6 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{ev.title}</span>
                                      <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Autor: {ev.author_type === 'client' ? clientSingular : 'Departamento Financeiro'}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-600">{formatDateTime(ev.created_at)}</span>
                                  </div>
                                  <p className="text-sm leading-relaxed font-medium text-zinc-300">{ev.message}</p>
                                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                                    <div className="flex flex-wrap gap-3 pt-2">
                                      {Object.entries(ev.metadata).map(([k, v]) => (
                                        <div key={k} className="rounded-xl bg-black/40 px-4 py-2 border border-white/5">
                                          <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-600">{k.replace("_", " ")}</span>
                                          <span className="text-[11px] font-black text-zinc-400">{String(v)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      {/* Anexos e Comprovantes */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-3">
                          <Paperclip size={20} className="text-zinc-500" />
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Documentação e Anexos</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {attachments.map(att => (
                            <a key={att.id} href={signedUrls[att.id]} target="_blank" rel="noreferrer" 
                              className="group flex items-center gap-5 rounded-[24px] border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.06] hover:border-white/10">
                              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-500 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                                <Paperclip size={24} />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p className="truncate text-sm font-black text-zinc-200">{att.file_name}</p>
                                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-600">{att.attachment_type.replace("_", " ")}</p>
                              </div>
                            </a>
                          ))}
                          {attachments.length === 0 && <p className="text-sm font-medium text-zinc-600">Nenhum documento anexado.</p>}
                        </div>
                      </section>
                    </div>

                    {/* Painéis de Ação Profissionais */}
                    <aside className="space-y-6">
                      
                      {/* Notificar Pagamento */}
                      <div className={`rounded-[28px] border transition-all duration-500 ${openActionPanel === "payment" ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_50px_rgba(16,185,129,0.1)]" : "border-white/5 bg-white/[0.02]"}`}>
                        <button onClick={() => setOpenActionPanel(p => p === "payment" ? null : "payment")}
                          className="flex w-full items-center justify-between p-8">
                          <div className="flex items-center gap-5">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 shadow-inner">
                              <CheckCircle2 size={28} />
                            </div>
                            <div className="text-left space-y-1">
                              <p className="text-sm font-black uppercase tracking-widest">Notificar Pagamento</p>
                              <p className="text-[11px] font-bold text-zinc-500">Registrar comprovante oficial</p>
                            </div>
                          </div>
                          <ChevronDown size={20} className={`text-zinc-600 transition-transform duration-500 ${openActionPanel === "payment" ? "rotate-180" : ""}`} />
                        </button>

                        {openActionPanel === "payment" && (
                          <div className="space-y-6 p-8 pt-0 animate-in fade-in slide-in-from-top-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Valor Efetivamente Pago</label>
                              <input type="text" value={paymentForm.amount} onChange={(e) => setPaymentForm(p => ({ ...p, amount: handleCurrencyMask(e.target.value) }))}
                                placeholder="R$ 0,00" className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-base font-black outline-none focus:border-emerald-500/50 transition-colors" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Método de Transferência</label>
                              <select value={paymentForm.method} onChange={(e) => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm font-bold outline-none focus:border-emerald-500/50 transition-colors appearance-none">
                                <option value="pix">PIX (Instantâneo)</option>
                                <option value="boleto">Boleto Bancário</option>
                                <option value="transferencia">TED / DOC</option>
                                <option value="cartao">Cartão de Crédito</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mensagem de Acompanhamento</label>
                              <textarea value={paymentForm.message} onChange={(e) => setPaymentForm(p => ({ ...p, message: e.target.value }))}
                                placeholder="Descreva detalhes do pagamento ou observações para o financeiro..."
                                className="h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-sm font-medium outline-none focus:border-emerald-500/50 transition-colors" />
                            </div>
                            <div className="space-y-2">
                              <label className="flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-black/20 p-4 transition-all hover:bg-black/40 hover:border-emerald-500/40">
                                <Upload size={20} className="text-zinc-500" />
                                <span className="max-w-full truncate text-[11px] font-black uppercase tracking-widest text-zinc-400">{paymentFile ? paymentFile.name : "Anexar Comprovante (PDF/JPG)"}</span>
                                <input type="file" className="hidden" onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f && f.size > MAX_FILE_SIZE) return showToast("Arquivo excede 5MB", "error");
                                  setPaymentFile(f || null);
                                }} accept=".pdf,.jpg,.jpeg,.png" />
                              </label>
                            </div>
                            <button onClick={handleReportPayment} disabled={submitting}
                              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 p-5 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-emerald-500 hover:shadow-[0_10px_30px_rgba(16,185,129,0.3)] disabled:opacity-50">
                              {submitting ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={20} /> Confirmar Notificação</>}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Contestação Formal */}
                      <div className={`rounded-[28px] border transition-all duration-500 ${openActionPanel === "dispute" ? "border-orange-500/40 bg-orange-500/5 shadow-[0_0_50px_rgba(249,115,22,0.1)]" : "border-white/5 bg-white/[0.02]"}`}>
                        <button onClick={() => setOpenActionPanel(p => p === "dispute" ? null : "dispute")}
                          className="flex w-full items-center justify-between p-8">
                          <div className="flex items-center gap-5">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 shadow-inner">
                              <AlertTriangle size={28} />
                            </div>
                            <div className="text-left space-y-1">
                              <p className="text-sm font-black uppercase tracking-widest">Contestação Formal</p>
                              <p className="text-[11px] font-bold text-zinc-500">Divergência de valores ou prazos</p>
                            </div>
                          </div>
                          <ChevronDown size={20} className={`text-zinc-600 transition-transform duration-500 ${openActionPanel === "dispute" ? "rotate-180" : ""}`} />
                        </button>

                        {openActionPanel === "dispute" && (
                          <div className="space-y-6 p-8 pt-0 animate-in fade-in slide-in-from-top-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Natureza da Divergência</label>
                              <select value={disputeForm.category} onChange={(e) => setDisputeForm(p => ({ ...p, category: e.target.value }))}
                                className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm font-bold outline-none focus:border-orange-500/50 transition-colors appearance-none">
                                <option value="amount_divergence">Valor Divergente do Contratado</option>
                                <option value="duplicate_charge">Cobrança Duplicada</option>
                                <option value="service_not_delivered">Serviço/Produto Não Entregue</option>
                                <option value="wrong_due_date">Data de Vencimento Incorreta</option>
                                <option value="other">Outras Divergências</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Resumo do Motivo</label>
                              <input type="text" value={disputeForm.reason} onChange={(e) => setDisputeForm(p => ({ ...p, reason: e.target.value }))}
                                placeholder="Ex: Valor da parcela difere do contrato assinado"
                                className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm font-bold outline-none focus:border-orange-500/50 transition-colors" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Detalhamento da Contestação</label>
                              <textarea value={disputeForm.message} onChange={(e) => setDisputeForm(p => ({ ...p, message: e.target.value }))}
                                placeholder="Explique detalhadamente o motivo da sua contestação para análise do financeiro..."
                                className="h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-sm font-medium outline-none focus:border-orange-500/50 transition-colors" />
                            </div>
                            <div className="space-y-2">
                              <label className="flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-black/20 p-4 transition-all hover:bg-black/40 hover:border-orange-500/40">
                                <Upload size={20} className="text-zinc-500" />
                                <span className="max-w-full truncate text-[11px] font-black uppercase tracking-widest text-zinc-400">{disputeFile ? disputeFile.name : "Anexar Evidência Probatória"}</span>
                                <input type="file" className="hidden" onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f && f.size > MAX_FILE_SIZE) return showToast("Arquivo excede 5MB", "error");
                                  setDisputeFile(f || null);
                                }} accept=".pdf,.jpg,.jpeg,.png" />
                              </label>
                            </div>
                            <button onClick={handleOpenDispute} disabled={submitting}
                              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-orange-600 p-5 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-orange-500 hover:shadow-[0_10px_30px_rgba(249,115,22,0.3)] disabled:opacity-50">
                              {submitting ? <Loader2 className="animate-spin" size={20} /> : <><MessageSquare size={20} /> Abrir Chamado de Análise</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </aside>
                  </div>
                </div>
              ) : (
                <div className="flex h-[600px] flex-col items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.02] p-20 text-center">
                  <ShieldAlert className="mb-6 text-zinc-800" size={64} />
                  <h3 className="text-xl font-black uppercase tracking-widest text-zinc-500">Nenhum Item Selecionado</h3>
                  <p className="mt-4 max-w-md text-sm font-medium text-zinc-600">Selecione uma cobrança na lista lateral para visualizar o histórico completo, documentos e realizar ações financeiras.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </main>
  );
}