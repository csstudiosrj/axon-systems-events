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
  Receipt, Send, Mail, MessageCircle, ChevronRight, TrendingUp
} from "lucide-react";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface Client { 
  id: string; 
  company_name: string; 
  email?: string; 
  phone?: string; 
}

interface Quote { 
  id: string; 
  title: string; 
}

interface ServiceOrder { 
  id: string; 
  quotes?: Quote | any; 
}

interface Transaction {
  id: string;
  description: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  due_date: string;
  payment_date?: string;
  service_order_id?: string;
  client_id?: string;
  attachment_url?: string;
  payment_method?: string;
  clients?: Client;
  service_orders?: ServiceOrder;
  quotes?: Quote;
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "receber" | "pagar" | "clientes">("dashboard");
  const [view, setView] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Estados de Dados
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);

  // UI States
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setForm] = useState({
    description: "", type: "income" as "income" | "expense", category: "", 
    amount: "", status: "pending" as any, dueDate: "", paymentDate: "",
    serviceOrderId: "", clientId: "", paymentMethod: "pix", attachmentUrl: ""
  });

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tRes, cRes, osRes] = await Promise.all([
      supabase.from("financial_transactions").select("*, clients(*), service_orders(id, quotes(title)), quotes(title)").order("due_date", { ascending: true }),
      supabase.from("clients").select("*").order("company_name"),
      supabase.from("service_orders").select("id, quotes(title)").order("created_at", { ascending: false })
    ]);

    if (tRes.data) setTransactions(tRes.data as unknown as Transaction[]);
    if (cRes.data) setClients(cRes.data as Client[]);
    if (osRes.data) setServiceOrders(osRes.data as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `financial/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('axon-assets').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('axon-assets').getPublicUrl(path);
      setForm(prev => ({ ...prev, attachmentUrl: data.publicUrl }));
      showToast("Comprovante anexado com sucesso.", "success");
    } catch (err: any) { showToast(err.message, "error"); }
    finally { setUploading(false); }
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
      category: formData.category || (formData.type === 'income' ? categories.income[0] : categories.expense[0]),
      amount: Number(formData.amount),
      status: formData.status,
      due_date: formData.dueDate,
      payment_date: formData.status === 'paid' ? (formData.paymentDate || new Date().toISOString().split('T')[0]) : null,
      service_order_id: formData.serviceOrderId || null,
      client_id: formData.clientId || null,
      payment_method: formData.paymentMethod,
      attachment_url: formData.attachmentUrl || null
    };

    const { error } = editId 
      ? await supabase.from("financial_transactions").update(payload).eq("id", editId)
      : await supabase.from("financial_transactions").insert([payload]);

    if (!error) {
      showToast("Lançamento processado na ARXUM Cloud.", "success");
      resetForm();
      setView("list");
      fetchData();
    } else { showToast(error.message, "error"); }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setEditId(null);
    setForm({
      description: "", type: "income", category: "", amount: "", 
      status: "pending", dueDate: "", paymentDate: "",
      serviceOrderId: "", clientId: "", paymentMethod: "pix", attachmentUrl: ""
    });
  };

  const openEditForm = (t: Transaction) => {
    setIsDetailModalOpen(false);
    setEditId(t.id);
    setForm({
      description: t.description,
      type: t.type,
      category: t.category,
      amount: t.amount.toString(),
      status: t.status,
      dueDate: t.due_date,
      paymentDate: t.payment_date || "",
      serviceOrderId: t.service_order_id || "",
      clientId: t.client_id || "",
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
      showToast("Status atualizado.", "success");
      fetchData();
      if (selectedTransaction?.id === id) {
        setSelectedTransaction({ ...selectedTransaction, status: newStatus as any, payment_date: payload.payment_date });
      }
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

  // --- CÁLCULOS DASHBOARD ---
  const stats = useMemo(() => {
    const paidIn = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((a, b) => a + b.amount, 0);
    const paidOut = transactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((a, b) => a + b.amount, 0);
    const pendingIn = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((a, b) => a + b.amount, 0);
    const overdueIn = transactions.filter(t => t.type === 'income' && isOverdue(t.due_date, t.status)).reduce((a, b) => a + b.amount, 0);
    return { balance: paidIn - paidOut, pendingIn, overdueIn, paidIn, paidOut };
  }, [transactions]);

  const clientSummary = useMemo(() => {
    return clients.map(c => {
      const cTrans = transactions.filter(t => t.client_id === c.id && t.type === 'income');
      const ltv = cTrans.filter(t => t.status === 'paid').reduce((a, b) => a + b.amount, 0);
      const debt = cTrans.filter(t => t.status === 'pending').reduce((a, b) => a + b.amount, 0);
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

  const renderTable = (typeFilter: "income" | "expense") => {
    const filtered = filteredTransactions.filter(t => t.type === typeFilter);
    return (
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-xl">
        <div className="p-4 border-b border-surface/50 bg-surface/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-white">
            {typeFilter === 'income' ? receivableLabel : payableLabel}
          </h4>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input 
              type="text" 
              placeholder="Filtrar por cliente ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-surface rounded-md text-xs text-white focus:border-cs-green outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-[10px] uppercase tracking-widest text-text-secondary font-black">
              <tr>
                <th className="px-6 py-4">Lançamento / Cliente</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-cs-green" size={32} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-text-secondary italic">Nenhum registro localizado.</td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-background/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${t.type === 'income' ? 'bg-cs-green/10 text-cs-green' : 'bg-red-500/10 text-red-500'}`}>
                          {t.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        </div>
                        <div>
                          <p className="font-bold text-white group-hover:text-cs-green transition-colors">{t.description}</p>
                          <p className="text-[10px] font-black uppercase text-text-secondary">{t.clients?.company_name || t.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className={isOverdue(t.due_date, t.status) ? 'text-red-500' : 'text-text-secondary'} />
                        <span className={`text-xs font-bold ${isOverdue(t.due_date, t.status) ? 'text-red-500' : 'text-white'}`}>
                          {new Date(t.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                      </div>
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
                      <button 
                        onClick={() => { setSelectedTransaction(t); setIsDetailModalOpen(true); }} 
                        className="bg-surface border border-surface/50 text-text-secondary hover:text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Detalhes
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

  return (
    <div className="space-y-6 relative pb-12">
      {/* TOASTS ARXUM */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border bg-[#1a1413] ${
          toast.type === 'success' ? 'border-cs-green text-cs-green' : 'border-red-500 text-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold uppercase tracking-widest">{toast.message}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 border border-surface/50 rounded-xl shadow-lg">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Wallet className="text-cs-green" size={28} /> {financialLabel}
          </h3>
          <p className="text-[10px] text-text-secondary mt-1.5 uppercase font-black tracking-[0.2em]">Fluxo de Caixa Consolidado ARXUM</p>
        </div>
        <button onClick={() => { resetForm(); setView("create"); }} className="bg-cs-green text-white px-8 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg flex items-center gap-2">
          <Plus size={18} /> Novo {transactionSingular}
        </button>
      </div>

      {view === "list" && (
        <>
          <div className="flex gap-2 border-b border-surface/50">
            {["dashboard", "receber", "pagar", "clientes"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-cs-green text-cs-green' : 'border-transparent text-text-secondary hover:text-white'}`}>
                {tab === 'dashboard' ? 'Visão Geral' : tab === 'receber' ? receivableLabel : tab === 'pagar' ? payableLabel : 'Visão por ' + clientSingular}
              </button>
            ))}
          </div>

          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-cs-green">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Saldo em Caixa</p>
                  <p className={`text-3xl font-black ${stats.balance >= 0 ? 'text-white' : 'text-red-500'}`}>{formatCurrency(stats.balance)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">A Receber (Total)</p>
                  <p className="text-3xl font-black text-cs-green">{formatCurrency(stats.pendingIn)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl border-l-4 border-l-red-500">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">Inadimplência Real</p>
                  <p className="text-3xl font-black text-red-500">{formatCurrency(stats.overdueIn)}</p>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                  <p className="text-[10px] font-black text-text-secondary uppercase mb-2">LTV Médio</p>
                  <p className="text-3xl font-black text-cs-gold">{formatCurrency(stats.paidIn / (clients.length || 1))}</p>
                </div>
              </div>

              <div className="bg-surface border border-surface/50 p-6 rounded-xl">
                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                  <TrendingUp size={16} className="text-cs-gold" /> Projeção de Recebíveis (Aging)
                </h4>
                <div className="grid grid-cols-4 gap-4">
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

          {(activeTab === "receber" || activeTab === "pagar") && renderTable(activeTab === "receber" ? "income" : "expense")}
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
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Vincular {clientSingular}</label>
                    <select value={formData.clientId} onChange={e => setForm({...formData, clientId: e.target.value})} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                      <option value="">Nenhum</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Centro de Custos (OS)</label>
                    <select value={formData.serviceOrderId} onChange={e => setForm({...formData, serviceOrderId: e.target.value})} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                      <option value="">Administrativo</option>
                      {serviceOrders.map(os => <option key={os.id} value={os.id}>OS: {os.quotes?.title}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Status</label>
                      <select value={formData.status} onChange={e => setForm({...formData, status: e.target.value})} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago / Efetivado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Anexo</label>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full bg-surface border border-surface/50 py-3 rounded-md text-[10px] font-black uppercase text-white hover:bg-background transition-all flex items-center justify-center gap-2">
                        {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} {formData.attachmentUrl ? "Trocar" : "Upload"}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-8 border-t border-surface/50 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="bg-cs-green text-white px-12 py-4 rounded-md font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center gap-3">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Finalizar Lançamento
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
              <button onClick={() => setIsDetailModalOpen(false)} className="text-text-secondary hover:text-white transition-colors bg-surface p-2 rounded-full"><XCircle size={24} /></button>
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
                    <button className="flex-1 flex items-center justify-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 py-3 rounded-md font-black text-[10px] uppercase hover:bg-blue-500/20 transition-all"><Mail size={16} /> E-mail</button>
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
    </div>
  );
}