"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useSettings } from "@/app/providers/SettingsProvider";
import { 
  Wallet, Plus, Loader2, ArrowLeft, ArrowUpRight, ArrowDownRight, 
  DollarSign, Clock, CheckCircle, XCircle, Save, Trash2, 
  Search, Filter, FileText, Building, CreditCard, Eye, 
  Edit, AlertTriangle, Upload, Download, ExternalLink, 
  Receipt, Send, Mail, MessageCircle, ChevronRight, Users,
  TrendingUp, BarChart3, UserCheck, Percent, AlertCircle
} from "lucide-react";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface Client { 
  id: string; 
  company_name: string; 
  email?: string; 
  phone?: string; 
}

interface Profile { 
  id: string; 
  full_name: string; 
  email: string; 
  commission_percentage: number; 
  role: string; 
}

interface ServiceOrder { 
  id: string; 
  quotes?: { 
    id: string; 
    title: string; 
    salesperson_id: string; 
  }; 
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
  clients?: Client;
  service_orders?: ServiceOrder;
  member?: Profile;
}

interface Toast { message: string; type: "success" | "error" | "warning"; }

export default function FinanceiroPage() {
  const router = useRouter();
  const { systemPreferences, companyProfile } = useSettings();
  
  // --- EXTRAÇÃO DE LABELS E CONFIGURAÇÕES (ARXUM ENGINE) ---
  const labels = systemPreferences?.custom_labels || {};
  const currency = systemPreferences?.currency_code || "BRL";
  const categories = systemPreferences?.financial_categories || { income: [], expense: [] };

  const financialLabel = labels.menu_financial || "Hub Financeiro";
  const receivableLabel = labels.entity_receivable_plural || "Contas a Receber";
  const payableLabel = labels.entity_payable_plural || "Contas a Pagar";
  const transactionSingular = labels.entity_transaction_singular || "Lançamento";
  const clientSingular = labels.entity_client_singular || "Cliente";

  // Estados de Interface
  const [activeTab, setActiveTab] = useState<"dashboard" | "receber" | "pagar" | "pessoal" | "clientes">("dashboard");
  const [view, setView] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);

  // Estados de Dados
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);

  // UI States
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setForm] = useState({
    description: "", type: "income" as "income" | "expense", 
    expense_type: "administrative" as any, category: "", 
    amount: "", status: "pending" as any, dueDate: "", paymentDate: "",
    serviceOrderId: "", clientId: "", memberId: "", paymentMethod: "pix", attachmentUrl: ""
  });

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes, osRes, pRes] = await Promise.all([
        supabase.from("financial_transactions").select("*, clients(*), member:profiles!member_id(*), service_orders(id, quotes(id, title, salesperson_id))").order("due_date", { ascending: true }),
        supabase.from("clients").select("*").order("company_name"),
        supabase.from("service_orders").select("id, quotes(id, title, salesperson_id)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("full_name")
      ]);

      if (tRes.data) setTransactions(tRes.data as unknown as Transaction[]);
      if (cRes.data) setClients(cRes.data as Client[]);
      if (osRes.data) setServiceOrders(osRes.data as any[]);
      if (pRes.data) setTeam(pRes.data as Profile[]);
    } catch (err) {
      showToast("Erro ao sincronizar com ARXUM Cloud.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- BUSCA PREDITIVA ---
  const filteredClientsList = useMemo(() => 
    clients.filter(c => c.company_name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8),
  [clients, clientSearch]);

  const filteredTeamList = useMemo(() => 
    team.filter(t => t.full_name.toLowerCase().includes(memberSearch.toLowerCase())).slice(0, 8),
  [team, memberSearch]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `financial/attachments/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('axon-assets').upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('axon-assets').getPublicUrl(path);
      setForm(prev => ({ ...prev, attachmentUrl: data.publicUrl }));
      showToast("Documento processado com sucesso.", "success");
    } catch (err: any) { 
      showToast(err.message, "error"); 
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

    const payload = {
      description: formData.description,
      type: formData.type,
      expense_type: formData.type === 'expense' ? formData.expense_type : null,
      category: formData.category || (formData.type === 'income' ? categories.income[0] : categories.expense[0]),
      amount: Number(formData.amount),
      status: formData.status,
      due_date: formData.dueDate,
      payment_date: formData.status === 'paid' ? (formData.paymentDate || new Date().toISOString().split('T')[0]) : null,
      service_order_id: formData.serviceOrderId || null,
      client_id: formData.clientId || null,
      member_id: formData.memberId || null,
      payment_method: formData.paymentMethod,
      attachment_url: formData.attachmentUrl || null
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

  const resetForm = () => {
    setEditId(null);
    setForm({
      description: "", type: "income", expense_type: "administrative", category: "", 
      amount: "", status: "pending", dueDate: "", paymentDate: "",
      serviceOrderId: "", clientId: "", memberId: "", paymentMethod: "pix", attachmentUrl: ""
    });
    setClientSearch("");
    setMemberSearch("");
  };

  const openEditForm = (t: Transaction) => {
    setIsDetailModalOpen(false);
    setEditId(t.id);
    setForm({
      description: t.description,
      type: t.type,
      expense_type: t.expense_type || "administrative",
      category: t.category,
      amount: t.amount.toString(),
      status: t.status,
      dueDate: t.due_date,
      paymentDate: t.payment_date || "",
      serviceOrderId: t.service_order_id || "",
      clientId: t.client_id || "",
      memberId: t.member_id || "",
      paymentMethod: t.payment_method || "pix",
      attachmentUrl: t.attachment_url || ""
    });
    setView("create");
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const payload: any = { status: newStatus };
    payload.payment_date = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
    
    const { error } = await supabase.from("financial_transactions").update(payload).eq("id", id);
    if (!error) {
      showToast("Status financeiro atualizado.", "success");
      fetchData();
      if (selectedTransaction?.id === id) {
        setSelectedTransaction({ ...selectedTransaction, status: newStatus as any, payment_date: payload.payment_date });
      }
    }
  };

  const sendInvoiceEmail = async (t: Transaction) => {
    setIsSendingMail(true);
    try {
      const res = await fetch('/api/finance/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: t.id, companyName: companyProfile.company_name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Cobrança disparada via e-mail.", "success");
      fetchData();
    } catch (err: any) { 
      showToast(err.message, "error"); 
    } finally { 
      setIsSendingMail(false); 
    }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);
  const isOverdue = (date: string, status: string) => new Date(date) < new Date(new Date().setHours(0,0,0,0)) && status === 'pending';

  const sendWhatsApp = (t: Transaction) => {
    const phone = t.clients?.phone?.replace(/\D/g, "");
    if (!phone) { showToast("Cliente sem telefone cadastrado.", "warning"); return; }
    const msg = `Olá, ${t.clients?.company_name}. Consta em nosso sistema um lançamento pendente: ${t.description} no valor de ${formatCurrency(t.amount)}, com vencimento em ${new Date(t.due_date).toLocaleDateString('pt-BR')}. Poderia nos enviar o comprovante?`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // --- KPI CALCULATIONS ---
  const stats = useMemo(() => {
    const paidIn = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((a, b) => a + Number(b.amount), 0);
    const paidOut = transactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((a, b) => a + Number(b.amount), 0);
    const pendingIn = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((a, b) => a + Number(b.amount), 0);
    const overdueIn = transactions.filter(t => t.type === 'income' && isOverdue(t.due_date, t.status)).reduce((a, b) => a + Number(b.amount), 0);
    return { balance: paidIn - paidOut, pendingIn, overdueIn, paidIn, paidOut };
  }, [transactions]);

  const personnelStats = useMemo(() => {
    const personnelTrans = transactions.filter(t => t.expense_type === 'personnel');
    const totalSalaries = personnelTrans.filter(t => t.category.toLowerCase().includes('salário')).reduce((a, b) => a + Number(b.amount), 0);
    const totalCommissions = personnelTrans.filter(t => t.category.toLowerCase().includes('comissão')).reduce((a, b) => a + Number(b.amount), 0);
    return { totalSalaries, totalCommissions };
  }, [transactions]);

  const clientSummary = useMemo(() => {
    return clients.map(c => {
      const cTrans = transactions.filter(t => t.client_id === c.id && t.type === 'income');
      const ltv = cTrans.filter(t => t.status === 'paid').reduce((a, b) => a + Number(b.amount), 0);
      const debt = cTrans.filter(t => t.status === 'pending').reduce((a, b) => a + Number(b.amount), 0);
      return { ...c, ltv, debt };
    }).filter(c => c.ltv > 0 || c.debt > 0);
  }, [clients, transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => 
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transactions, searchTerm]);

  const renderTable = (typeFilter: "income" | "expense", expenseType?: string) => {
    const filtered = filteredTransactions.filter(t => 
      t.type === typeFilter && 
      (!expenseType || t.expense_type === expenseType)
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
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-background/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-bold text-white group-hover:text-cs-green transition-colors">{t.description}</p>
                    <p className="text-[10px] font-black uppercase text-text-secondary">
                      {t.clients?.company_name || t.member?.full_name || t.category}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold ${isOverdue(t.due_date, t.status) ? 'text-red-500' : 'text-white'}`}>
                      {new Date(t.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black text-white">{formatCurrency(t.amount)}</td>
                  <td className="px-6 py-4">
                    <select
                      value={t.status}
                      onChange={(e) => updateStatus(t.id, e.target.value)}
                      className={`text-[10px] rounded-full px-3 py-1 font-black uppercase border focus:outline-none cursor-pointer ${
                        t.status === 'paid' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' :
                        t.status === 'cancelled' ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' :
                        isOverdue(t.due_date, t.status) ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        'bg-cs-gold/10 text-cs-gold border-cs-gold/20'
                      }`}
                    >
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { setSelectedTransaction(t); setIsDetailModalOpen(true); }} className="text-text-secondary hover:text-white transition-all"><Eye size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative pb-12">
      {/* TOASTS ARXUM */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border bg-[#1a1413] ${
          toast.type === 'success' ? 'border-cs-green text-cs-green' : 'border-red-500 text-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold uppercase tracking-widest">{toast.message}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 border border-surface/50 rounded-xl shadow-lg">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Wallet className="text-cs-green" size={28} /> {financialLabel}
          </h3>
          <p className="text-[10px] text-text-secondary mt-1 uppercase font-black tracking-[0.2em]">Gestão Financeira ARXUM Cloud</p>
        </div>
        <button onClick={() => { resetForm(); setView("create"); }} className="bg-cs-green text-white px-8 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg flex items-center gap-2">
          <Plus size={18} /> Novo {transactionSingular}
        </button>
      </div>

      {view === "list" && (
        <>
          <div className="flex gap-2 border-b border-surface/50">
            {[
              { id: "dashboard", label: "Visão Geral", icon: TrendingUp },
              { id: "receber", label: receivableLabel, icon: ArrowUpRight },
              { id: "pagar", label: payableLabel, icon: ArrowDownRight },
              { id: "pessoal", label: "Gestão de Pessoal", icon: Users },
              { id: "clientes", label: "Análise por " + clientSingular, icon: Building }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === tab.id ? 'border-cs-green text-cs-green' : 'border-transparent text-text-secondary hover:text-white'}`}>
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-cs-green">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Saldo Realizado</p>
                  <p className={`text-3xl font-black ${stats.balance >= 0 ? 'text-white' : 'text-red-500'}`}>{formatCurrency(stats.balance)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Total a Receber</p>
                  <p className="text-3xl font-black text-cs-green">{formatCurrency(stats.pendingIn)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-red-500">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Inadimplência Real</p>
                  <p className="text-3xl font-black text-red-500">{formatCurrency(stats.overdueIn)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Folha Mensal</p>
                  <p className="text-3xl font-black text-cs-gold">{formatCurrency(personnelStats.totalSalaries + personnelStats.totalCommissions)}</p>
                </div>
              </div>

              <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                  <TrendingUp size={16} className="text-cs-gold" /> Projeção de Recebíveis (Aging)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Vencidos', val: stats.overdueIn, color: 'bg-red-500' },
                    { label: 'Próx. 7 dias', val: stats.pendingIn * 0.4, color: 'bg-cs-gold' },
                    { label: '15-30 dias', val: stats.pendingIn * 0.3, color: 'bg-blue-500' },
                    { label: '30+ dias', val: stats.pendingIn * 0.3, color: 'bg-cs-green' }
                  ].map(b => (
                    <div key={b.label} className="space-y-2">
                      <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                        <div className={`h-full ${b.color}`} style={{ width: `${(b.val / (stats.pendingIn || 1)) * 100}%` }}></div>
                      </div>
                      <p className="text-[9px] font-black text-text-secondary uppercase">{b.label}</p>
                      <p className="text-sm font-bold text-white">{formatCurrency(b.val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "pessoal" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-text-secondary uppercase">Salários Pagos</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(personnelStats.totalSalaries)}</p>
                  </div>
                  <UserCheck className="text-cs-green opacity-20" size={48} />
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-text-secondary uppercase">Comissões Pagas</p>
                    <p className="text-2xl font-black text-white text-cs-gold">{formatCurrency(personnelStats.totalCommissions)}</p>
                  </div>
                  <Percent className="text-cs-gold opacity-20" size={48} />
                </div>
              </div>
              {renderTable("expense", "personnel")}
            </div>
          )}

          {activeTab === "receber" && renderTable("income")}
          {activeTab === "pagar" && renderTable("expense", "administrative")}

          {activeTab === "clientes" && (
            <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-2xl animate-in fade-in">
              <table className="w-full text-left text-sm">
                <thead className="bg-background/50 text-[10px] uppercase tracking-widest text-text-secondary font-black">
                  <tr>
                    <th className="px-8 py-5">Identificação do {clientSingular}</th>
                    <th className="px-8 py-5">LTV (Total Pago)</th>
                    <th className="px-8 py-5">Saldo Devedor</th>
                    <th className="px-8 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface/50">
                  {clientSummary.map(c => (
                    <tr key={c.id} className="hover:bg-background/40 transition-colors group">
                      <td className="px-8 py-6 font-black text-white uppercase tracking-tight">{c.company_name}</td>
                      <td className="px-8 py-6 font-bold text-cs-green">{formatCurrency(c.ltv)}</td>
                      <td className="px-8 py-6 font-bold text-red-400">{formatCurrency(c.debt)}</td>
                      <td className="px-8 py-6 text-right">
                        <button onClick={() => { setSearchTerm(c.company_name); setActiveTab("receber"); }} className="text-[10px] font-black uppercase text-cs-gold hover:underline">Ver Extrato</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* FORMULÁRIO DE LANÇAMENTO */}
      {view === "create" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <button onClick={() => { resetForm(); setView("list"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-all uppercase text-[10px] font-black tracking-widest">
            <ArrowLeft size={16} /> Voltar ao Fluxo
          </button>
          <div className="bg-surface border border-surface/50 p-8 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-8 border-b border-surface/50 pb-4 uppercase tracking-tighter">
              {editId ? "Ajustar Lançamento" : `Novo Registro Financeiro`}
            </h2>
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex gap-2 p-1 bg-background rounded-lg border border-surface/50 w-fit">
                    <button type="button" onClick={() => setForm({...formData, type: 'income'})} className={`px-8 py-2 rounded text-[10px] font-black uppercase transition-all ${formData.type === 'income' ? 'bg-cs-green text-white shadow-lg' : 'text-text-secondary'}`}>Receita</button>
                    <button type="button" onClick={() => setForm({...formData, type: 'expense'})} className={`px-8 py-2 rounded text-[10px] font-black uppercase transition-all ${formData.type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-text-secondary'}`}>Despesa</button>
                  </div>

                  {formData.type === 'expense' && (
                    <div className="flex gap-2">
                      {['administrative', 'personnel', 'operational'].map(t => (
                        <button key={t} type="button" onClick={() => setForm({...formData, expense_type: t as any})} className={`flex-1 py-2 rounded text-[9px] font-black uppercase border border-surface transition-all ${formData.expense_type === t ? 'bg-white text-black' : 'text-text-secondary'}`}>{t}</button>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Descrição *</label>
                    <input type="text" required value={formData.description} onChange={e => setForm({...formData, description: e.target.value})} className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Valor ({currency}) *</label>
                      <input type="number" step="0.01" required value={formData.amount} onChange={e => setForm({...formData, amount: e.target.value})} className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Vencimento *</label>
                      <input type="date" required value={formData.dueDate} onChange={e => setForm({...formData, dueDate: e.target.value})} className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none" style={{ colorScheme: 'dark' }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Categoria (Plano de Contas)</label>
                    <select value={formData.category} onChange={e => setForm({...formData, category: e.target.value})} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                      {(formData.type === 'income' ? categories.income : categories.expense).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  {formData.type === 'income' && (
                    <div className="relative">
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Vincular {clientSingular}</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                        <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-background border border-surface rounded-md pl-9 pr-4 py-2.5 text-white text-sm focus:border-cs-green outline-none" placeholder="Pesquisar cliente..." />
                      </div>
                      {clientSearch && filteredClientsList.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-surface border border-surface/50 rounded-md shadow-2xl">
                          {filteredClientsList.map(c => (
                            <button key={c.id} type="button" onClick={() => { setForm({...formData, clientId: c.id}); setClientSearch(c.company_name); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-cs-green/20 border-b border-surface/50 last:border-0">{c.company_name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {formData.expense_type === 'personnel' && (
                    <div className="relative">
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Colaborador Beneficiado</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                        <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="w-full bg-background border border-surface rounded-md pl-9 pr-4 py-2.5 text-white text-sm focus:border-cs-green outline-none" placeholder="Pesquisar membro..." />
                      </div>
                      {memberSearch && filteredTeamList.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-surface border border-surface/50 rounded-md shadow-2xl">
                          {filteredTeamList.map(m => (
                            <button key={m.id} type="button" onClick={() => { setForm({...formData, memberId: m.id}); setMemberSearch(m.full_name); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-cs-gold/20 border-b border-surface/50 last:border-0">{m.full_name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Centro de Custos (OS)</label>
                    <select value={formData.serviceOrderId} onChange={e => setForm({...formData, serviceOrderId: e.target.value})} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                      <option value="">Administrativo / Geral</option>
                      {serviceOrders.map(os => <option key={os.id} value={os.id}>OS: {os.quotes?.title}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Anexo</label>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full bg-surface border border-surface/50 py-3 rounded-md text-[10px] font-black uppercase text-white hover:bg-background transition-all flex items-center justify-center gap-2">
                        {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} {formData.attachmentUrl ? "Trocar" : "Upload"}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Método</label>
                      <select value={formData.paymentMethod} onChange={e => setForm({...formData, paymentMethod: e.target.value})} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                        <option value="pix">PIX</option>
                        <option value="boleto">Boleto</option>
                        <option value="transfer">TED/DOC</option>
                        <option value="credit_card">Cartão</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-8 border-t border-surface/50 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="bg-cs-green text-white px-12 py-4 rounded-md font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center gap-3">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Finalizar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES */}
      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[150] backdrop-blur-md p-4">
          <div className="bg-[#1a1413] border border-surface/50 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 bg-background/50 border-b border-surface/50 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{selectedTransaction.description}</h2>
                <div className="flex gap-2">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border ${selectedTransaction.type === 'income' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>{selectedTransaction.type}</span>
                  <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase bg-surface border border-surface/50 text-text-secondary">{selectedTransaction.category}</span>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-text-secondary hover:text-white transition-colors bg-surface p-2 rounded-full border border-surface/50"><XCircle size={24} /></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Montante</p>
                  <p className="text-xl font-black text-white">{formatCurrency(selectedTransaction.amount)}</p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Vencimento</p>
                  <p className="text-sm font-bold text-white">{new Date(selectedTransaction.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Status Atual</p>
                  <p className="text-sm font-bold uppercase text-cs-gold">{selectedTransaction.status}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-surface/50 pb-2">Ações de Cobrança</h4>
                  <div className="flex gap-3">
                    <button onClick={() => sendWhatsApp(selectedTransaction)} className="flex-1 flex items-center justify-center gap-2 bg-cs-green/10 text-cs-green border border-cs-green/20 py-3 rounded-md font-black text-[10px] uppercase hover:bg-cs-green/20 transition-all"><MessageCircle size={16} /> WhatsApp</button>
                    <button onClick={() => sendInvoiceEmail(selectedTransaction)} disabled={isSendingMail} className="flex-1 flex items-center justify-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 py-3 rounded-md font-black text-[10px] uppercase hover:bg-blue-500/20 transition-all">
                      {isSendingMail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />} E-mail
                    </button>
                  </div>
                  <button onClick={() => router.push(`/financeiro/fatura/${selectedTransaction.id}`)} className="w-full flex items-center justify-center gap-2 bg-surface border border-surface/50 py-3 rounded-md font-black text-[10px] uppercase text-white hover:bg-background transition-all"><Receipt size={16} /> Gerar Fatura PDF</button>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-surface/50 pb-2">Comprovante</h4>
                  {selectedTransaction.attachment_url ? (
                    <a href={selectedTransaction.attachment_url} target="_blank" className="block p-4 bg-background border border-surface/50 rounded-lg text-center hover:border-cs-green transition-all">
                      <Download size={24} className="mx-auto mb-2 text-cs-green" />
                      <p className="text-[10px] font-black text-white uppercase">Baixar Anexo</p>
                    </a>
                  ) : <p className="text-[10px] text-text-secondary italic uppercase">Nenhum documento anexado.</p>}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-surface/50 bg-background/80 flex justify-between items-center">
              <button onClick={async () => { await supabase.from("financial_transactions").delete().eq("id", selectedTransaction.id); setIsDetailModalOpen(false); fetchData(); showToast("Removido.", "success"); }} className="flex items-center gap-2 text-xs font-black uppercase text-red-500 hover:text-red-400 transition-colors"><Trash2 size={16} /> Excluir</button>
              <div className="flex gap-4">
                <button onClick={() => openEditForm(selectedTransaction)} className="bg-surface border border-surface/50 text-white px-6 py-2.5 rounded-md text-xs font-black uppercase tracking-widest hover:bg-surface/80 transition-all">Editar</button>
                {selectedTransaction.status === 'pending' && (
                  <button onClick={() => updateStatus(selectedTransaction.id, 'paid')} className="bg-cs-green text-white px-8 py-2.5 rounded-md text-xs font-black uppercase tracking-widest shadow-lg hover:bg-opacity-90 transition-all">Dar Baixa</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] backdrop-blur-sm">
          <div className="bg-[#1a1413] border border-surface/50 rounded-xl w-full max-w-sm p-8 text-center space-y-6 shadow-2xl">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Remover Registro?</h3>
            <p className="text-sm text-text-secondary font-medium">Esta ação é irreversível e afetará os relatórios de DRE e Fluxo de Caixa.</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 border border-surface rounded-md text-xs font-black uppercase text-text-secondary hover:text-white transition-all">Cancelar</button>
              <button onClick={async () => {
                await supabase.from("financial_transactions").delete().eq("id", confirmDeleteId);
                setConfirmDeleteId(null);
                setIsDetailModalOpen(false);
                fetchData();
                showToast("Registro removido.", "success");
              }} className="flex-1 py-3 bg-red-600 text-white rounded-md text-xs font-black uppercase shadow-lg hover:bg-red-500 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---
function InputField({ label, value, onChange, type = "text", placeholder = "" }: { label: string, value: string, onChange: (v: string) => void, type?: string, placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all" style={{ colorScheme: 'dark' }} />
    </div>
  );
}