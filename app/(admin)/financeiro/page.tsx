"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Wallet, Plus, Loader2, ArrowLeft, ArrowUpRight, ArrowDownRight, 
  DollarSign, Clock, CheckCircle, XCircle, Save, Trash2, 
  Search, Filter, FileText, User, Building, CreditCard, Eye, 
  Edit, AlertTriangle, Upload, Download, ExternalLink, Receipt
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface Client {
  id: string;
  company_name: string;
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
  quote_id?: string;
  installment_number?: number;
  total_installments?: number;
  payment_method?: string;
  attachment_url?: string;
  source?: string;
  service_orders?: ServiceOrder;
  clients?: Client;
  quotes?: Quote;
}

interface Toast { message: string; type: "success" | "error" | "warning"; }

export default function FinanceiroPage() {
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels || {};
  const currencyCode = systemPreferences?.currency_code || "BRL";

  // Labels Dinâmicas
  const financialLabel = labels.menu_financial || "Hub Financeiro";
  const receivableLabel = labels.entity_receivable_plural || "Contas a Receber";
  const payableLabel = labels.entity_payable_plural || "Contas a Pagar";
  const transactionSingular = labels.entity_transaction_singular || "Lançamento";

  const [activeTab, setActiveTab] = useState<"dashboard" | "receber" | "pagar">("dashboard");
  const [view, setView] = useState<"list" | "create">("list");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // UI States
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"pending" | "paid" | "cancelled">("pending");
  const [dueDate, setDueDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [clientId, setClientId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financial_transactions")
      .select(`
        *,
        service_orders ( id, quotes ( id, title ) ),
        clients ( id, company_name ),
        quotes ( id, title )
      `)
      .order("due_date", { ascending: true });
      
    if (!error && data) setTransactions(data as unknown as Transaction[]);
    setLoading(false);
  }, []);

  const fetchDependencies = useCallback(async () => {
    const { data: osData } = await supabase.from("service_orders").select(`id, quotes(id, title)`).order("created_at", { ascending: false });
    const { data: clientData } = await supabase.from("clients").select("id, company_name").order("company_name");
    if (osData) setServiceOrders(osData as unknown as ServiceOrder[]);
    if (clientData) setClients(clientData as Client[]);
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchDependencies();
  }, [fetchTransactions, fetchDependencies]);

  // --- LÓGICA DE UPLOAD ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const filePath = `financial/attachments/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('axon-assets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('axon-assets').getPublicUrl(filePath);
      setAttachmentUrl(data.publicUrl);
      showToast("Comprovante anexado.", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setEditId(null); setDescription(""); setType("income"); setCategory(""); setAmount("");
    setStatus("pending"); setDueDate(""); setPaymentDate(""); setServiceOrderId("");
    setClientId(""); setPaymentMethod("pix"); setAttachmentUrl("");
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !dueDate) {
      showToast("Preencha os campos obrigatórios.", "warning");
      return;
    }

    setIsSubmitting(true);
    const payload = {
      description, type, category: category || (type === 'income' ? "Venda de Serviços" : "Geral"),
      amount: Number(amount), status, due_date: dueDate,
      payment_date: status === 'paid' ? (paymentDate || new Date().toISOString().split('T')[0]) : null,
      service_order_id: serviceOrderId || null,
      client_id: clientId || null,
      payment_method: paymentMethod,
      attachment_url: attachmentUrl || null,
      source: 'manual'
    };

    const { error } = editId 
      ? await supabase.from("financial_transactions").update(payload).eq("id", editId)
      : await supabase.from("financial_transactions").insert([payload]);

    if (!error) {
      showToast(editId ? "Lançamento atualizado." : "Lançamento registrado.", "success");
      resetForm();
      setView("list");
      fetchTransactions();
    } else {
      showToast(error.message, "error");
    }
    setIsSubmitting(false);
  };

  const openEditForm = (t: Transaction) => {
    setIsDetailModalOpen(false);
    setEditId(t.id);
    setDescription(t.description);
    setType(t.type);
    setCategory(t.category);
    setAmount(t.amount.toString());
    setStatus(t.status);
    setDueDate(t.due_date);
    setPaymentDate(t.payment_date || "");
    setServiceOrderId(t.service_order_id || "");
    setClientId(t.client_id || "");
    setPaymentMethod(t.payment_method || "pix");
    setAttachmentUrl(t.attachment_url || "");
    setView("create");
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const payload: any = { status: newStatus };
    payload.payment_date = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;
    
    const { error } = await supabase.from("financial_transactions").update(payload).eq("id", id);
    if (!error) {
      showToast("Status atualizado.", "success");
      fetchTransactions();
      if (selectedTransaction?.id === id) {
        setSelectedTransaction({ ...selectedTransaction, status: newStatus as any, payment_date: payload.payment_date });
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currencyCode }).format(value);
  };
  
  const isOverdue = (dateStr: string, status: string) => {
    return new Date(dateStr) < new Date(new Date().setHours(0,0,0,0)) && status === 'pending';
  };

  // --- CÁLCULOS DASHBOARD ---
  const incomes = transactions.filter(t => t.type === 'income');
  const expenses = transactions.filter(t => t.type === 'expense');
  const totalIncomePaid = incomes.filter(t => t.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpensePaid = expenses.filter(t => t.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const balance = totalIncomePaid - totalExpensePaid;
  const pendingIncome = incomes.filter(t => t.status === 'pending').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const overdueIncome = incomes.filter(t => isOverdue(t.due_date, t.status)).reduce((acc, curr) => acc + Number(curr.amount), 0);

  // --- FILTRO DE BUSCA ---
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
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border animate-in fade-in slide-in-from-bottom-4 bg-[#1a1413] ${
          toast.type === 'success' ? 'border-cs-green text-cs-green' : 'border-red-500 text-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold uppercase tracking-widest">{toast.message}</span>
        </div>
      )}

      {/* MODAL DETALHES (DOSSIÊ FINANCEIRO) */}
      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[80] backdrop-blur-md p-4">
          <div className="bg-[#1a1413] border border-surface/50 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface/50 flex justify-between items-start bg-background/50">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${selectedTransaction.type === 'income' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                    {selectedTransaction.type === 'income' ? 'Receita' : 'Despesa'}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-surface border border-surface/50 text-text-secondary">
                    {selectedTransaction.category}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedTransaction.description}</h2>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-text-secondary hover:text-white transition-colors bg-surface p-2 rounded-full border border-surface/50">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[10px] text-text-secondary font-black uppercase mb-1">Valor</p>
                  <p className={`text-xl font-black ${selectedTransaction.type === 'income' ? 'text-cs-green' : 'text-white'}`}>{formatCurrency(selectedTransaction.amount)}</p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[10px] text-text-secondary font-black uppercase mb-1">Vencimento</p>
                  <p className="text-sm font-bold text-white">{new Date(selectedTransaction.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[10px] text-text-secondary font-black uppercase mb-1">Status</p>
                  <p className="text-sm font-bold uppercase text-cs-gold">{selectedTransaction.status}</p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[10px] text-text-secondary font-black uppercase mb-1">Pagamento</p>
                  <p className="text-sm font-bold text-white uppercase">{selectedTransaction.payment_method || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] border-b border-surface/50 pb-2">Rastreabilidade</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Building size={16} className="text-cs-gold" />
                      <div>
                        <p className="text-[9px] text-text-secondary uppercase font-black">Cliente / Fornecedor</p>
                        <p className="text-sm font-bold text-white">{selectedTransaction.clients?.company_name || 'Lançamento Avulso'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-cs-green" />
                      <div>
                        <p className="text-[9px] text-text-secondary uppercase font-black">Origem Operacional</p>
                        <p className="text-sm font-bold text-white">{selectedTransaction.quotes?.title || selectedTransaction.service_orders?.quotes?.title || 'Administrativo'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] border-b border-surface/50 pb-2">Documentação</h4>
                  {selectedTransaction.attachment_url ? (
                    <a 
                      href={selectedTransaction.attachment_url} 
                      target="_blank" 
                      className="flex items-center justify-between p-4 bg-cs-green/10 border border-cs-green/20 rounded-lg group hover:bg-cs-green/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Receipt size={20} className="text-cs-green" />
                        <span className="text-xs font-bold text-white uppercase">Ver Comprovante</span>
                      </div>
                      <ExternalLink size={16} className="text-cs-green group-hover:scale-110 transition-transform" />
                    </a>
                  ) : (
                    <div className="p-4 bg-background border border-dashed border-surface/50 rounded-lg text-center">
                      <p className="text-[10px] text-text-secondary uppercase font-black italic">Nenhum anexo vinculado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-surface/50 bg-background/80 flex justify-between items-center">
              <button 
                onClick={() => { setConfirmDeleteId(selectedTransaction.id); }} 
                className="flex items-center gap-2 text-xs font-black uppercase text-red-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={16} /> Excluir
              </button>
              <div className="flex gap-4">
                <button 
                  onClick={() => openEditForm(selectedTransaction)} 
                  className="bg-surface border border-surface/50 text-white px-6 py-2.5 rounded-md text-xs font-black uppercase tracking-widest hover:bg-surface/80 transition-all"
                >
                  Editar Dados
                </button>
                {selectedTransaction.status === 'pending' && (
                  <button 
                    onClick={() => updateStatus(selectedTransaction.id, 'paid')} 
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

      {/* FORMULÁRIO DE LANÇAMENTO */}
      {view === "create" && (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          <button onClick={() => { resetForm(); setView("list"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest">
            <ArrowLeft size={16} /> Voltar ao Fluxo Financeiro
          </button>

          <div className="bg-surface border border-surface/50 p-8 rounded-xl shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-8 border-b border-surface/50 pb-4 uppercase tracking-tighter">
              {editId ? "Ajustar Lançamento" : `Novo ${transactionSingular}`}
            </h3>
            
            <form onSubmit={handleSaveTransaction} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                <div className="space-y-6">
                  <div className="flex gap-2 p-1 bg-background rounded-lg border border-surface/50 w-fit">
                    <button type="button" onClick={() => { setType("income"); setCategory("Venda de Serviços"); }} className={`px-8 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${type === 'income' ? 'bg-cs-green text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}>Receita</button>
                    <button type="button" onClick={() => { setType("expense"); setCategory("Geral"); }} className={`px-8 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}>Despesa</button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Descrição do Lançamento *</label>
                    <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" placeholder="Ex: Pagamento Fornecedor X" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Valor ({currencyCode}) *</label>
                      <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Vencimento *</label>
                      <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" style={{ colorScheme: 'dark' }} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Anexar Comprovante / NF</label>
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 bg-surface border border-surface/50 px-4 py-2 rounded text-[10px] font-black uppercase text-white hover:bg-background transition-all">
                        {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                        {attachmentUrl ? "Trocar Arquivo" : "Fazer Upload"}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="application/pdf,image/*" />
                      {attachmentUrl && <span className="text-[10px] text-cs-green font-bold uppercase">Arquivo Pronto</span>}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Vincular {labels.entity_client_singular || "Cliente"}</label>
                    <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                      <option value="">Nenhum (Lançamento Administrativo)</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Centro de Custos (OS)</label>
                    <select value={serviceOrderId} onChange={(e) => setServiceOrderId(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                      <option value="">Não vinculado a Ordem de Serviço</option>
                      {serviceOrders.map(os => <option key={os.id} value={os.id}>OS: #{os.id.split('-')[0]} - {os.quotes?.title}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Status Inicial</label>
                      <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago / Efetivado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Método</label>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
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
                <button type="submit" disabled={isSubmitting} className="bg-cs-green text-white px-12 py-4 rounded-md font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DASHBOARD E LISTAGEM */}
      {view === "list" && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 border border-surface/50 rounded-xl shadow-lg">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-3 uppercase tracking-tighter">
                <Wallet className="text-cs-green" size={26} /> {financialLabel}
              </h3>
              <p className="text-[10px] text-text-secondary mt-1.5 uppercase font-black tracking-[0.2em]">Gestão de Fluxo de Caixa ARXUM</p>
            </div>
            <button onClick={() => { resetForm(); setView("create"); }} className="bg-cs-green text-white px-8 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg flex items-center gap-2">
              <Plus size={18} /> Novo {transactionSingular}
            </button>
          </div>

          <div className="flex gap-2 border-b border-surface/50">
            {["dashboard", "receber", "pagar"].map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)} 
                className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-cs-green text-cs-green' : 'border-transparent text-text-secondary hover:text-white'}`}
              >
                {tab === 'dashboard' ? 'Visão Geral' : tab === 'receber' ? receivableLabel : payableLabel}
              </button>
            ))}
          </div>

          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-surface/50 p-6 rounded-xl relative overflow-hidden group">
                  <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Receitas Realizadas</p>
                  <p className="text-3xl font-black text-white">{formatCurrency(totalIncomePaid)}</p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase text-cs-gold">
                    <Clock size={12}/> {formatCurrency(pendingIncome)} em aberto
                  </div>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl relative overflow-hidden">
                  <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Despesas Realizadas</p>
                  <p className="text-3xl font-black text-white">{formatCurrency(totalExpensePaid)}</p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase text-red-400">
                    <AlertTriangle size={12}/> {formatCurrency(overdueIncome)} vencido
                  </div>
                </div>
                <div className="bg-surface border border-surface/50 p-6 rounded-xl md:col-span-2 bg-gradient-to-br from-surface to-background border-l-4 border-l-cs-green">
                  <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Saldo Consolidado - {companyProfile?.company_name || 'ARXUM'}</p>
                  <p className={`text-4xl font-black ${balance >= 0 ? 'text-cs-green' : 'text-red-500'}`}>{formatCurrency(balance)}</p>
                  <p className="text-[9px] text-text-secondary mt-3 uppercase font-bold tracking-tighter">Cálculo baseado em lançamentos efetivados (Status: Pago)</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "receber" && renderTable("income")}
          {activeTab === "pagar" && renderTable("expense")}
        </>
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
                fetchTransactions();
                showToast("Registro removido.", "success");
              }} className="flex-1 py-3 bg-red-600 text-white rounded-md text-xs font-black uppercase shadow-lg hover:bg-red-500 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}