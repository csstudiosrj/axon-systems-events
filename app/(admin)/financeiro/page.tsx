"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  Wallet, Plus, Loader2, ArrowLeft, ArrowUpRight,
  CheckCircle, XCircle, Save, Trash2, Search, Building, Eye,
  AlertTriangle, Upload, Download, Receipt, Mail, MessageCircle,
  Users, TrendingUp, UserCheck, Percent, BarChart3, PieChart,
  DollarSign, Zap
} from "lucide-react";

// ─── INTERFACES ──────────────────────────────────────────────────────────────

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
  status: "pending" | "paid" | "cancelled";
  due_date: string;
  payment_date?: string;
  service_order_id?: string;
  client_id?: string;
  member_id?: string;
  attachment_url?: string;
  payment_method?: string;
  last_notified_at?: string;
  invoice_hash?: string;
  quote_id?: string;
  clients?: Client;
  service_orders?: ServiceOrder;
  member?: Profile;
  quote?: Quote;
}

interface Toast {
  message: string;
  type: "success" | "error" | "warning";
}

type TabId = "dashboard" | "receber" | "pagar_admin" | "pagar_operacional" | "pessoal" | "clientes";

// ─── DEFAULTS WHITE-LABEL ────────────────────────────────────────────────────

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

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

const isOverdue = (date: string, status: string) =>
  new Date(date + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0)) &&
  status === "pending";

const statusLabel = (t: Transaction) => {
  if (t.status === "paid") return "Pago";
  if (t.status === "cancelled") return "Cancelado";
  if (isOverdue(t.due_date, t.status)) return "Vencido";
  return "Pendente";
};

const statusClass = (t: Transaction) => {
  if (t.status === "paid") return "bg-cs-green/10 text-cs-green border-cs-green/20";
  if (t.status === "cancelled") return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  if (isOverdue(t.due_date, t.status)) return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-cs-gold/10 text-cs-gold border-cs-gold/20";
};

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

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

  // Labels white-label
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

  const currency = sys?.currency_code || "BRL";

  // Categorias white-label com fallback
  const incomeCategories: string[] = useMemo(() => {
    const raw = sys?.financial_categories?.income;
    return raw?.length ? raw : DEFAULT_INCOME_CATEGORIES;
  }, [sys]);

  const expenseAdminCategories: string[] = DEFAULT_EXPENSE_ADMIN_CATEGORIES;
  const expenseOpCategories: string[] = DEFAULT_EXPENSE_OPERATIONAL_CATEGORIES;
  const expensePersonnelCategories: string[] = DEFAULT_EXPENSE_PERSONNEL_CATEGORIES;

  // ─── STATES ──────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [view, setView] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [approvedQuotes, setApprovedQuotes] = useState<ApprovedQuote[]>([]);

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const formatCurrency = useCallback(
    (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v),
    [currency]
  );

  // ─── FETCH ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes, osRes, pRes] = await Promise.all([
        supabase
          .from("financial_transactions")
          .select(
            "*, clients(*), member:profiles!member_id(id, full_name, email, role, commission_percentage), service_orders(id, quote_id, quotes(id, title, salesperson_id)), quote:quotes!quote_id(id, title, salesperson_id, final_amount, client_id)"
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
      ]);

      if (tRes.data) setTransactions(tRes.data as unknown as Transaction[]);
      if (cRes.data) setClients(cRes.data as Client[]);
      if (osRes.data) setApprovedQuotes(osRes.data as unknown as ApprovedQuote[]);
      if (pRes.data) setTeam(pRes.data as unknown as Profile[]);
    } catch {
      showToast("Erro ao sincronizar com a nuvem.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── BUSCA PREDITIVA ─────────────────────────────────────────────────────

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

  // ─── KPIs ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const paidIn = transactions
      .filter((t) => t.type === "income" && t.status === "paid")
      .reduce((a, b) => a + Number(b.amount), 0);
    const paidOut = transactions
      .filter((t) => t.type === "expense" && t.status === "paid")
      .reduce((a, b) => a + Number(b.amount), 0);
    const pendingIn = transactions
      .filter((t) => t.type === "income" && t.status === "pending")
      .reduce((a, b) => a + Number(b.amount), 0);
    const overdueIn = transactions
      .filter((t) => t.type === "income" && isOverdue(t.due_date, t.status))
      .reduce((a, b) => a + Number(b.amount), 0);
    return { balance: paidIn - paidOut, pendingIn, overdueIn, paidIn, paidOut };
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

    // Comissões por membro
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

    return {
      totalSalaries,
      totalCommissions,
      commissionByMember: Object.values(byMember).sort((a, b) => b.total - a.total),
    };
  }, [transactions, L]);

  // Gráfico de despesas por categoria
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense" && t.status === "paid")
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
          const ltv = ct.filter((t) => t.status === "paid").reduce((a, b) => a + Number(b.amount), 0);
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
          (t.category?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
      ),
    [transactions, searchTerm]
  );

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

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
      status: t.status,
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
    else if (tab === "pagar_admin") { setFormType("expense"); setExpenseType("administrative"); }
    else if (tab === "pagar_operacional") { setFormType("expense"); setExpenseType("operational"); }
    else if (tab === "pessoal") { setFormType("expense"); setExpenseType("personnel"); }
    else setFormType("income");
    setView("create");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `financial/attachments/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("axon-assets").upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("axon-assets").getPublicUrl(path);
      setForm((prev) => ({ ...prev, attachmentUrl: data.publicUrl }));
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

    // Centro de custo só faz sentido para receitas e despesas operacionais
    const hasServiceOrder = formType === "income" || expenseType === "operational";

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
          ? formData.paymentDate || new Date().toISOString().split("T")[0]
          : null,
      service_order_id: null,
      quote_id: hasServiceOrder ? formData.serviceOrderId || null : null,
      client_id: formType === "income" ? formData.clientId || null : null,
      member_id: expenseType === "personnel" && formType === "expense" ? formData.memberId || null : null,
      payment_method: formData.paymentMethod,
      attachment_url: formData.attachmentUrl || null,
    };

    const { error } = editId
      ? await supabase.from("financial_transactions").update(payload).eq("id", editId)
      : await supabase.from("financial_transactions").insert([payload]);

    if (!error) {
      showToast("Lançamento gravado com sucesso.", "success");
      setView("list");
      fetchData();
      resetForm();
    } else {
      showToast(error.message, "error");
    }
    setIsSubmitting(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const payload: Record<string, unknown> = { status: newStatus };
    payload.payment_date =
      newStatus === "paid" ? new Date().toISOString().split("T")[0] : null;
    const { error } = await supabase
      .from("financial_transactions")
      .update(payload)
      .eq("id", id);
    if (!error) {
      showToast("Status atualizado.", "success");
      fetchData();
      setSelectedTransaction((prev) =>
        prev?.id === id ? { ...prev, status: newStatus as Transaction["status"] } : prev
      );
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
      fetchData();
      showToast("Registro removido.", "success");
    } else {
      showToast("Erro ao excluir.", "error");
    }
  };

  const sendWhatsApp = (t: Transaction) => {
    const phone = t.clients?.phone?.replace(/\D/g, "");
    if (!phone) { showToast(`${L.cliente} sem telefone cadastrado.`, "warning"); return; }
    const msg = `Olá, ${t.clients?.company_name}. Há um lançamento pendente: ${t.description} no valor de ${formatCurrency(t.amount)}, com vencimento em ${new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR")}.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const sendInvoiceEmail = async (t: Transaction) => {
    if (!t.clients?.email) { showToast(`${L.cliente} sem e-mail cadastrado.`, "warning"); return; }
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
      fetchData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Erro ao enviar e-mail.", "error");
    } finally {
      setIsSendingMail(false);
    }
  };

  // ─── RENDER TABELA ────────────────────────────────────────────────────────

  const renderTable = (
    typeFilter: "income" | "expense",
    expFilter?: "administrative" | "operational" | "personnel"
  ) => {
    const rows = filteredTransactions.filter(
      (t) => t.type === typeFilter && (!expFilter || t.expense_type === expFilter)
    );

    return (
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-xl">
        <div className="p-4 border-b border-surface/50 bg-surface/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input
              type="text"
              placeholder="Filtrar lançamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-surface rounded-md text-xs text-white focus:border-cs-green outline-none transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background/50 text-[10px] uppercase tracking-widest text-text-secondary font-black">
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
                  <td colSpan={6} className="px-6 py-10 text-center text-text-secondary text-xs uppercase font-black tracking-widest">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="hover:bg-background/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-white group-hover:text-cs-green transition-colors">{t.description}</p>
                      <p className="text-[10px] font-black uppercase text-text-secondary">
                        {t.clients?.company_name || t.member?.full_name || "—"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs text-text-secondary">{t.category}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold ${isOverdue(t.due_date, t.status) ? "text-red-500" : "text-white"}`}>
                        {new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-white">{formatCurrency(Number(t.amount))}</td>
                    <td className="px-6 py-4">
                      <select
                        value={t.status}
                        onChange={(e) => updateStatus(t.id, e.target.value)}
                        className={`text-[10px] rounded-full px-3 py-1 font-black uppercase border focus:outline-none cursor-pointer ${statusClass(t)}`}
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => { setSelectedTransaction(t); setIsDetailModalOpen(true); }}
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
    );
  };

  // ─── CATEGORIAS DO FORM ATUAL ─────────────────────────────────────────────

  const currentCategories = useMemo(() => {
    if (formType === "income") return incomeCategories;
    if (expenseType === "administrative") return expenseAdminCategories;
    if (expenseType === "operational") return expenseOpCategories;
    return expensePersonnelCategories;
  }, [formType, expenseType, incomeCategories]);

  // ─── TABS ─────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "dashboard" as TabId, label: "Visão Geral", icon: TrendingUp },
    { id: "receber" as TabId, label: L.receber, icon: ArrowUpRight },
    { id: "pagar_admin" as TabId, label: L.pagarAdmin, icon: DollarSign },
    { id: "pagar_operacional" as TabId, label: L.pagarOp, icon: Zap },
    { id: "pessoal" as TabId, label: L.pessoal, icon: Users },
    { id: "clientes" as TabId, label: L.clientes, icon: Building },
  ];

  // ─── CORES DO GRÁFICO (usa primary_color do settings) ────────────────────
  const CHART_COLORS = [
    "bg-cs-green", "bg-cs-gold", "bg-blue-500", "bg-purple-500",
    "bg-red-500", "bg-orange-500", "bg-cyan-500", "bg-pink-500",
  ];

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 relative pb-12">

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border bg-[#1a1413] ${
          toast.type === "success" ? "border-cs-green text-cs-green" :
          toast.type === "warning" ? "border-cs-gold text-cs-gold" :
          "border-red-500 text-red-500"
        }`}>
          {toast.type === "success" ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold uppercase tracking-widest">{toast.message}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 border border-surface/50 rounded-xl shadow-lg">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Wallet className="text-cs-green" size={28} /> {L.hub}
          </h3>
          <p className="text-[10px] text-text-secondary mt-1 uppercase font-black tracking-[0.2em]">
            {companyProfile?.company_name as string || "ARXUM"} · Gestão Financeira
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

      {/* ── LISTA ─────────────────────────────────────────────────────────── */}
      {view === "list" && (
        <>
          {/* TABS */}
          <div className="flex gap-0 border-b border-surface/50 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-cs-green text-cs-green"
                    : "border-transparent text-text-secondary hover:text-white"
                }`}
              >
                <tab.icon size={13} /> {tab.label}
              </button>
            ))}
          </div>

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-500">

              {/* KPI cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-cs-green">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Saldo Realizado</p>
                  <p className={`text-3xl font-black ${stats.balance >= 0 ? "text-white" : "text-red-500"}`}>{formatCurrency(stats.balance)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">{L.receber} Pendentes</p>
                  <p className="text-3xl font-black text-cs-green">{formatCurrency(stats.pendingIn)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-red-500">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Inadimplência Real</p>
                  <p className="text-3xl font-black text-red-500">{formatCurrency(stats.overdueIn)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Folha + {L.comissao}</p>
                  <p className="text-3xl font-black text-cs-gold">{formatCurrency(personnelStats.totalSalaries + personnelStats.totalCommissions)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Aging */}
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
                          <div
                            className={`h-full ${b.color} transition-all`}
                            style={{ width: `${Math.min((b.val / (stats.pendingIn || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[9px] font-black text-text-secondary uppercase">{b.label}</p>
                        <p className="text-sm font-bold text-white">{formatCurrency(b.val)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gráfico despesas por categoria */}
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <PieChart size={16} className="text-cs-gold" /> Centro de Custos — Despesas Efetivadas
                  </h4>
                  {expenseByCategory.length === 0 ? (
                    <p className="text-text-secondary text-xs uppercase font-black text-center py-8">Sem despesas efetivadas.</p>
                  ) : (
                    <div className="space-y-3">
                      {expenseByCategory.map((item, i) => (
                        <div key={item.cat} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-text-secondary uppercase truncate max-w-[60%]">{item.cat}</span>
                            <span className="text-xs font-black text-white">{formatCurrency(item.val)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                            <div
                              className={`h-full ${CHART_COLORS[i % CHART_COLORS.length]} transition-all`}
                              style={{ width: `${(item.val / (totalExpenses || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-surface/50 flex justify-between">
                        <span className="text-[10px] font-black text-text-secondary uppercase">Total Despesas</span>
                        <span className="text-xs font-black text-red-400">{formatCurrency(totalExpenses)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── RECEBER ───────────────────────────────────────────────────── */}
          {activeTab === "receber" && renderTable("income")}

          {/* ── PAGAR ADMINISTRATIVO ──────────────────────────────────────── */}
          {activeTab === "pagar_admin" && renderTable("expense", "administrative")}

          {/* ── PAGAR OPERACIONAL ─────────────────────────────────────────── */}
          {activeTab === "pagar_operacional" && renderTable("expense", "operational")}

          {/* ── PESSOAL ───────────────────────────────────────────────────── */}
          {activeTab === "pessoal" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-text-secondary uppercase">{L.salario}s Pagos</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(personnelStats.totalSalaries)}</p>
                  </div>
                  <UserCheck className="text-cs-green opacity-20" size={48} />
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-text-secondary uppercase">{L.comissao}s Pagas</p>
                    <p className="text-2xl font-black text-cs-gold">{formatCurrency(personnelStats.totalCommissions)}</p>
                  </div>
                  <Percent className="text-cs-gold opacity-20" size={48} />
                </div>
              </div>

              {/* Ranking de comissões por colaborador */}
              {personnelStats.commissionByMember.length > 0 && (
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart3 size={16} className="text-cs-gold" /> Ranking de {L.comissao}s por {L.colaborador}
                  </h4>
                  <div className="space-y-3">
                    {personnelStats.commissionByMember.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-text-secondary w-5 text-right">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-bold text-white">{m.name}</span>
                            <span className="text-xs font-black text-cs-gold">{formatCurrency(m.total)}</span>
                          </div>
                          <div className="h-1.5 bg-background rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cs-gold transition-all"
                              style={{ width: `${(m.total / (personnelStats.commissionByMember[0]?.total || 1)) * 100}%` }}
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

          {/* ── CLIENTES ──────────────────────────────────────────────────── */}
          {activeTab === "clientes" && (
            <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-2xl animate-in fade-in">
              <table className="w-full text-left text-sm">
                <thead className="bg-background/50 text-[10px] uppercase tracking-widest text-text-secondary font-black">
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
                            onClick={() => { setSearchTerm(c.company_name); setActiveTab("receber"); }}
                            className="text-[10px] font-black uppercase text-cs-gold hover:underline"
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

      {/* ── FORMULÁRIO ────────────────────────────────────────────────────── */}
      {view === "create" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <button
            onClick={() => { resetForm(); setView("list"); }}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-all uppercase text-[10px] font-black tracking-widest"
          >
            <ArrowLeft size={16} /> Voltar ao Fluxo
          </button>

          <div className="bg-surface border border-surface/50 p-8 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-8 border-b border-surface/50 pb-4 uppercase tracking-tighter">
              {editId ? `Ajustar ${L.transacao}` : `Novo ${L.transacao}`}
            </h2>

            <form onSubmit={handleSave} className="space-y-8">

              {/* Tipo: Receita / Despesa */}
              <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-background rounded-lg border border-surface/50 w-fit">
                  <button
                    type="button"
                    onClick={() => setFormType("income")}
                    className={`px-8 py-2 rounded text-[10px] font-black uppercase transition-all ${formType === "income" ? "bg-cs-green text-white shadow-lg" : "text-text-secondary"}`}
                  >
                    {L.receita}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("expense")}
                    className={`px-8 py-2 rounded text-[10px] font-black uppercase transition-all ${formType === "expense" ? "bg-red-500 text-white shadow-lg" : "text-text-secondary"}`}
                  >
                    {L.despesa}
                  </button>
                </div>

                {/* Sub-tipo de despesa */}
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
                        className={`flex-1 py-2 rounded text-[9px] font-black uppercase border border-surface transition-all ${
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

                {/* Coluna esquerda */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">
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
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">
                        Valor ({currency}) *
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
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">
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

                  {/* Categoria — select com opções pré-definidas */}
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">
                      Categoria
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none transition-all"
                    >
                      <option value="">Selecionar...</option>
                      {currentCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "pending" | "paid" | "cancelled" }))}
                        className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none transition-all"
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago / Efetivado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">
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
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">
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

                {/* Coluna direita */}
                <div className="space-y-6">

                  {/* Vincular cliente (apenas receita) */}
                  {formType === "income" && (
                    <div className="relative">
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">
                        Vincular {L.cliente}
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => { setClientSearch(e.target.value); if (!e.target.value) setForm((p) => ({ ...p, clientId: "" })); }}
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
                              onClick={() => { setForm((p) => ({ ...p, clientId: c.id })); setClientSearch(c.company_name); }}
                              className="w-full text-left px-4 py-2 text-xs text-white hover:bg-cs-green/20 border-b border-surface/50 last:border-0"
                            >
                              {c.company_name}
                            </button>
                          ))}
                        </div>
                      )}
                      {formData.clientId && (
                        <p className="text-[10px] text-cs-green mt-1 font-black">✓ {L.cliente} vinculado</p>
                      )}
                    </div>
                  )}

                  {/* Centro de Custos (OS) — receita e operacional */}
                  {(formType === "income" || (formType === "expense" && expenseType === "operational")) && (
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">
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
                        <p className="text-[10px] text-text-secondary mt-1">Nenhum {L.orcamento} aprovado localizado.</p>
                      )}
                    </div>
                  )}

                  {/* Colaborador + comissão (pessoal) */}
                  {formType === "expense" && expenseType === "personnel" && (
                    <>
                      <div className="relative">
                        <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">
                          {L.colaborador}
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                          <input
                            type="text"
                            value={memberSearch}
                            onChange={(e) => { setMemberSearch(e.target.value); if (!e.target.value) setForm((p) => ({ ...p, memberId: "" })); }}
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
                                onClick={() => { setForm((p) => ({ ...p, memberId: m.id })); setMemberSearch(m.full_name); }}
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
                          <p className="text-[10px] text-cs-gold mt-1 font-black">✓ {L.colaborador} vinculado</p>
                        )}
                      </div>

                      {/* Campo de comissão dedicado */}
                      {formData.category.toLowerCase().includes("comiss") && (
                        <div className="bg-cs-gold/5 border border-cs-gold/20 rounded-lg p-4 space-y-3">
                          <p className="text-[10px] font-black text-cs-gold uppercase tracking-widest">{L.comissao} de Venda</p>
                          {formData.memberId && (() => {
                            const member = team.find((m) => m.id === formData.memberId);
                            return member?.commission_percentage ? (
                              <p className="text-[10px] text-text-secondary">
                                Taxa cadastrada: <strong className="text-white">{member.commission_percentage}%</strong>
                                {formData.amount ? (
                                  <> · Calculado: <strong className="text-cs-gold">{formatCurrency(Number(formData.amount) * member.commission_percentage / 100)}</strong></>
                                ) : null}
                              </p>
                            ) : null;
                          })()}
                          <div>
                            <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">
                              Valor da {L.comissao} ({currency})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Valor final a pagar..."
                              value={formData.commissionAmount}
                              onChange={(e) => setForm((p) => ({ ...p, commissionAmount: e.target.value, amount: e.target.value }))}
                              className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-gold outline-none transition-all"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Anexo */}
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">
                      Comprovante / Anexo
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-surface border border-surface/50 py-3 rounded-md text-[10px] font-black uppercase text-white hover:bg-background transition-all flex items-center justify-center gap-2"
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
                      <p className="text-[10px] text-cs-green mt-1 font-black">✓ Arquivo anexado</p>
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

      {/* ── MODAL DETALHES ────────────────────────────────────────────────── */}
      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[150] backdrop-blur-md p-4">
          <div className="bg-[#1a1413] border border-surface/50 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

            <div className="p-8 bg-background/50 border-b border-surface/50 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                  {selectedTransaction.description}
                </h2>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border ${
                    selectedTransaction.type === "income"
                      ? "bg-cs-green/10 text-cs-green border-cs-green/20"
                      : "bg-red-500/10 text-red-500 border-red-500/20"
                  }`}>
                    {selectedTransaction.type === "income" ? L.receita : L.despesa}
                  </span>
                  <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase bg-surface border border-surface/50 text-text-secondary">
                    {selectedTransaction.category}
                  </span>
                  {(selectedTransaction.quote || selectedTransaction.service_orders?.quotes) && (
                    <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      {L.orcamento}: {selectedTransaction.quote?.title || selectedTransaction.service_orders?.quotes?.title || "—"}
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

            <div className="p-8 overflow-y-auto space-y-8 flex-1">
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Montante</p>
                  <p className="text-xl font-black text-white">{formatCurrency(Number(selectedTransaction.amount))}</p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Vencimento</p>
                  <p className="text-sm font-bold text-white">
                    {new Date(selectedTransaction.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Status</p>
                  <p className={`text-sm font-bold uppercase ${statusClass(selectedTransaction).split(" ")[1]}`}>
                    {statusLabel(selectedTransaction)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-surface/50 pb-2">
                    Cobrança
                  </h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => sendWhatsApp(selectedTransaction)}
                      className="flex-1 flex items-center justify-center gap-2 bg-cs-green/10 text-cs-green border border-cs-green/20 py-3 rounded-md font-black text-[10px] uppercase hover:bg-cs-green/20 transition-all"
                    >
                      <MessageCircle size={16} /> WhatsApp
                    </button>
                    <button
                      onClick={() => sendInvoiceEmail(selectedTransaction)}
                      disabled={isSendingMail}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 py-3 rounded-md font-black text-[10px] uppercase hover:bg-blue-500/20 transition-all disabled:opacity-50"
                    >
                      {isSendingMail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />} E-mail
                    </button>
                  </div>
                  <button
                    onClick={() => router.push(`/financeiro/fatura/${selectedTransaction.id}`)}
                    className="w-full flex items-center justify-center gap-2 bg-surface border border-surface/50 py-3 rounded-md font-black text-[10px] uppercase text-white hover:bg-background transition-all"
                  >
                    <Receipt size={16} /> Gerar Fatura PDF
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-surface/50 pb-2">
                    Comprovante
                  </h4>
                  {selectedTransaction.attachment_url ? (
                    <a
                      href={selectedTransaction.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-background border border-surface/50 rounded-lg text-center hover:border-cs-green transition-all"
                    >
                      <Download size={24} className="mx-auto mb-2 text-cs-green" />
                      <p className="text-[10px] font-black text-white uppercase">Baixar Anexo</p>
                    </a>
                  ) : (
                    <p className="text-[10px] text-text-secondary italic uppercase">Nenhum documento anexado.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-surface/50 bg-background/80 flex justify-between items-center">
              <button
                onClick={() => setConfirmDeleteId(selectedTransaction.id)}
                className="flex items-center gap-2 text-xs font-black uppercase text-red-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={16} /> Excluir
              </button>
              <div className="flex gap-4">
                <button
                  onClick={() => openEditForm(selectedTransaction)}
                  className="bg-surface border border-surface/50 text-white px-6 py-2.5 rounded-md text-xs font-black uppercase tracking-widest hover:bg-surface/80 transition-all"
                >
                  Editar
                </button>
                {selectedTransaction.status === "pending" && (
                  <button
                    onClick={() => updateStatus(selectedTransaction.id, "paid")}
                    className="bg-cs-green text-white px-8 py-2.5 rounded-md text-xs font-black uppercase tracking-widest shadow-lg hover:bg-opacity-90 transition-all"
                  >
                    Dar Baixa
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR EXCLUSÃO ──────────────────────────────────────── */}
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