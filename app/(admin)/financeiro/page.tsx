"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Wallet, Plus, Loader2, ArrowLeft, ArrowUpRight, ArrowDownRight, 
  DollarSign, Clock, CheckCircle, XCircle, Save, Trash2, 
  Search, Filter, FileText, User, Building, CreditCard, Eye, Edit, AlertTriangle
} from "lucide-react";

// --- BLINDAGEM TYPESCRIPT ---
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
  quotes?: Quote;
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

interface Toast {
  message: string;
  type: "success" | "error";
}

interface ConfirmDialog {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function FinanceiroPage() {
  const[activeTab, setActiveTab] = useState<"dashboard" | "receber" | "pagar">("dashboard");
  const [view, setView] = useState<"list" | "create">("list");
  const[transactions, setTransactions] = useState<Transaction[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI States
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({ isOpen: false, title: "", message: "", onConfirm: () => {} });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("Venda de Serviços");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"pending" | "paid" | "cancelled">("pending");
  const [dueDate, setDueDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const[serviceOrderId, setServiceOrderId] = useState("");
  const [clientId, setClientId] = useState("");
  const[paymentMethod, setPaymentMethod] = useState("pix");

  useEffect(() => {
    if (view === "list") fetchTransactions();
    if (view === "create") {
      fetchServiceOrders();
      fetchClients();
    }
  }, [view]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financial_transactions")
      .select(`
        *,
        service_orders ( id, quotes ( title ) ),
        clients ( id, company_name ),
        quotes ( id, title )
      `)
      .order("due_date", { ascending: true });
      
    if (!error && data) setTransactions(data as Transaction[]);
    setLoading(false);
  };

  const fetchServiceOrders = async () => {
    const { data } = await supabase.from("service_orders").select(`id, quotes(title)`).order("created_at", { ascending: false });
    if (data) setServiceOrders(data as ServiceOrder[]);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("id, company_name").order("company_name");
    if (data) setClients(data as Client[]);
  };

  const resetForm = () => {
    setEditId(null);
    setDescription("");
    setType("income");
    setCategory("Venda de Serviços");
    setAmount("");
    setStatus("pending");
    setDueDate("");
    setPaymentDate("");
    setServiceOrderId("");
    setClientId("");
    setPaymentMethod("pix");
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !dueDate) {
      showToast("Preencha os campos obrigatórios.", "error");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      description,
      type,
      category,
      amount: Number(amount),
      status,
      due_date: dueDate,
      payment_date: status === 'paid' ? (paymentDate || new Date().toISOString().split('T')[0]) : null,
      service_order_id: serviceOrderId || null,
      client_id: clientId || null,
      payment_method: paymentMethod,
      source: 'manual'
    };

    let error;

    if (editId) {
      const { error: updateError } = await supabase.from("financial_transactions").update(payload).eq("id", editId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("financial_transactions").insert([payload]);
      error = insertError;
    }

    if (!error) {
      showToast(editId ? "Lançamento atualizado." : "Lançamento criado.", "success");
      resetForm();
      setView("list");
    } else {
      showToast("Erro ao salvar: " + error.message, "error");
    }
    setIsSubmitting(false);
  };

  const openEditForm = (t: Transaction) => {
    setIsDetailModalOpen(false);
    setEditId(t.id);
    setDescription(t.description);
    setType(t.type);
    setCategory(t.category || "");
    setAmount(t.amount.toString());
    setStatus(t.status);
    setDueDate(t.due_date);
    setPaymentDate(t.payment_date || "");
    setServiceOrderId(t.service_order_id || "");
    setClientId(t.client_id || "");
    setPaymentMethod(t.payment_method || "pix");
    setView("create");
  };

  const confirmDelete = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Excluir Lançamento",
      message: "Esta ação é irreversível. Deseja realmente excluir este registro financeiro?",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
        if (!error) {
          showToast("Lançamento excluído.", "success");
          setIsDetailModalOpen(false);
          fetchTransactions();
        } else {
          showToast("Erro ao excluir.", "error");
        }
      }
    });
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const payload: any = { status: newStatus };
    if (newStatus === 'paid') {
      payload.payment_date = new Date().toISOString().split('T')[0];
    } else {
      payload.payment_date = null;
    }
    
    const { error } = await supabase.from("financial_transactions").update(payload).eq("id", id);
    if (!error) {
      showToast("Status atualizado.", "success");
      fetchTransactions();
      if (selectedTransaction && selectedTransaction.id === id) {
        setSelectedTransaction({ ...selectedTransaction, status: newStatus as any, payment_date: payload.payment_date });
      }
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  
  const isOverdue = (dateStr: string, status: string) => {
    return new Date(dateStr) < new Date(new Date().setHours(0,0,0,0)) && status === 'pending';
  };

  // Cálculos do Dashboard
  const incomes = transactions.filter(t => t.type === 'income');
  const expenses = transactions.filter(t => t.type === 'expense');

  const totalIncomePaid = incomes.filter(t => t.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpensePaid = expenses.filter(t => t.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const balance = totalIncomePaid - totalExpensePaid;

  const pendingIncome = incomes.filter(t => t.status === 'pending').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingExpense = expenses.filter(t => t.status === 'pending').reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const overdueIncome = incomes.filter(t => isOverdue(t.due_date, t.status)).reduce((acc, curr) => acc + Number(curr.amount), 0);
  const overdueExpense = expenses.filter(t => isOverdue(t.due_date, t.status)).reduce((acc, curr) => acc + Number(curr.amount), 0);

  // Renderização da Tabela (Reutilizável para Receber e Pagar)
  const renderTable = (typeFilter: "income" | "expense") => {
    const filtered = transactions.filter(t => t.type === typeFilter);
    
    return (
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Descrição</th>
                <th className="px-6 py-3 font-medium">Vencimento</th>
                <th className="px-6 py-3 font-medium">Valor</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center"><Loader2 className="animate-spin mx-auto mb-2 text-cs-green" size={24} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-text-secondary">Nenhum lançamento encontrado.</td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${t.type === 'income' ? 'bg-cs-green/10 text-cs-green' : 'bg-red-500/10 text-red-500'}`}>
                          {t.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        </div>
                        <div>
                          <p className="font-bold text-white">{t.description}</p>
                          <p className="text-xs mt-0.5">{t.clients?.company_name || t.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className={isOverdue(t.due_date, t.status) ? 'text-red-500' : 'text-text-secondary'} />
                        <span className={isOverdue(t.due_date, t.status) ? 'text-red-500 font-bold' : 'text-white'}>
                          {new Date(t.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${t.type === 'income' ? 'text-cs-green' : 'text-white'}`}>
                        {formatCurrency(t.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={t.status}
                        onChange={(e) => updateStatus(t.id, e.target.value)}
                        className={`text-xs rounded-full px-2.5 py-1 font-bold uppercase tracking-wider border focus:outline-none cursor-pointer ${
                          t.status === 'paid' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' :
                          t.status === 'cancelled' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
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
                        className="inline-flex items-center gap-1 text-text-secondary hover:text-white transition-colors bg-surface border border-surface/50 px-3 py-1.5 rounded-md text-xs font-medium"
                      >
                        <Eye size={14} /> Detalhes
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

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex items-center justify-between">
          <button onClick={() => { resetForm(); setView("list"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para o Fluxo
          </button>
        </div>

        <div className="bg-surface border border-surface/50 p-8 rounded-xl shadow-2xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-surface/50 pb-4">
            <Plus className="text-cs-green" size={24} />
            {editId ? "Editar Lançamento" : "Novo Lançamento Financeiro"}
          </h3>
          
          <form onSubmit={handleSaveTransaction} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="md:col-span-2 flex gap-2 p-1 bg-background rounded-lg border border-surface/50 w-fit">
                <button
                  type="button"
                  onClick={() => { setType("income"); setCategory("Venda de Serviços"); }}
                  className={`px-8 py-2.5 rounded-md text-sm font-bold transition-all ${type === 'income' ? 'bg-cs-green text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
                >
                  Receita (Entrada)
                </button>
                <button
                  type="button"
                  onClick={() => { setType("expense"); setCategory("OPEX (Água, Luz, Aluguel)"); }}
                  className={`px-8 py-2.5 rounded-md text-sm font-bold transition-all ${type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
                >
                  Despesa (Saída)
                </button>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1">Descrição do Lançamento *</label>
                <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Ex: Pagamento Sinal Evento XYZ, Salário João, Conta de Luz" />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Valor (R$) *</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} className="block w-full rounded-md border border-surface bg-background pl-10 pr-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Plano de Contas (Categoria) *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer">
                  {type === 'income' ? (
                    <>
                      <option value="Venda de Serviços">Venda de Serviços (Eventos)</option>
                      <option value="Locação de Equipamentos">Locação de Equipamentos</option>
                      <option value="Treinamentos (Academy)">Treinamentos (Academy)</option>
                      <option value="Consultoria">Consultoria</option>
                      <option value="Outras Receitas">Outras Receitas</option>
                    </>
                  ) : (
                    <>
                      <option value="OPEX (Água, Luz, Aluguel)">OPEX (Água, Luz, Aluguel, Internet)</option>
                      <option value="Folha de Pagamento">Folha de Pagamento (Salários)</option>
                      <option value="Comissões">Comissões (Vendedores)</option>
                      <option value="Equipe / Freelancers">Equipe / Freelancers</option>
                      <option value="Logística / Frete">Logística / Frete</option>
                      <option value="Impostos / Taxas">Impostos / Taxas</option>
                      <option value="Manutenção de Inventário">Manutenção de Inventário</option>
                      <option value="Marketing / Software">Marketing / Assinaturas de Software</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Data de Vencimento *</label>
                <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" style={{ colorScheme: 'dark' }} />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer">
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago / Efetivado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              {status === 'paid' && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Data do Pagamento</label>
                  <input type="date" required={status === 'paid'} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" style={{ colorScheme: 'dark' }} />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Método de Pagamento</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer">
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="transfer">Transferência (TED/DOC)</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="cash">Dinheiro em Espécie</option>
                </select>
              </div>

              <div className="md:col-span-2 pt-6 border-t border-surface/50 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-2"><Building size={14}/> Cliente / Fornecedor Vinculado</label>
                  <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer">
                    <option value="">Nenhum (Avulso)</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-2"><FileText size={14}/> Centro de Custos (OS / Evento)</label>
                  <select value={serviceOrderId} onChange={(e) => setServiceOrderId(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-4 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer">
                    <option value="">Lançamento Administrativo (Não vinculado a OS)</option>
                    {serviceOrders.map(os => (
                      <option key={os.id} value={os.id}>
                        OS: #{os.id.split('-')[0]} - {os.quotes?.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-surface/50">
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2.5 px-8 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editId ? "Atualizar Lançamento" : "Salvar Lançamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Sistema de Toasts Customizados (Sólidos) */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-[#1a1413] border-cs-green text-cs-green' : 'bg-[#1a1413] border-red-500 text-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Modal de Confirmação Customizado */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-surface border border-surface/50 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-6">
            <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
              <p className="text-sm text-text-secondary">{confirmDialog.message}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="px-6 py-2.5 text-sm font-bold text-white bg-background border border-surface/50 rounded-md hover:bg-surface transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDialog.onConfirm} className="px-6 py-2.5 text-sm font-bold text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors shadow-lg">
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal (Read-only Detail View) */}
      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface/50 flex justify-between items-start bg-background">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${selectedTransaction.type === 'income' ? 'bg-cs-green/10 text-cs-green' : 'bg-red-500/10 text-red-500'}`}>
                    {selectedTransaction.type === 'income' ? 'Receita' : 'Despesa'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-surface border border-surface/50 text-text-secondary">
                    {selectedTransaction.category}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-2">{selectedTransaction.description}</h2>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-text-secondary hover:text-white transition-colors bg-surface p-2 rounded-full">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Valor</p>
                  <p className={`text-lg font-extrabold ${selectedTransaction.type === 'income' ? 'text-cs-green' : 'text-white'}`}>
                    {formatCurrency(selectedTransaction.amount)}
                  </p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Vencimento</p>
                  <p className={`text-sm font-bold ${isOverdue(selectedTransaction.due_date, selectedTransaction.status) ? 'text-red-500' : 'text-white'}`}>
                    {new Date(selectedTransaction.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Status</p>
                  <p className={`text-sm font-bold ${selectedTransaction.status === 'paid' ? 'text-cs-green' : selectedTransaction.status === 'cancelled' ? 'text-text-secondary' : 'text-cs-gold'}`}>
                    {selectedTransaction.status === 'paid' ? 'Pago' : selectedTransaction.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                  </p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-surface/50">
                  <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Método</p>
                  <p className="text-sm font-bold text-white uppercase">{selectedTransaction.payment_method || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white border-b border-surface/50 pb-2 flex items-center gap-2">
                  <Search size={16} className="text-cs-gold" /> Rastreabilidade
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-3 bg-background p-3 rounded-md border border-surface/50">
                    <Building size={16} className="text-text-secondary mt-0.5" />
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase">Cliente / Fornecedor</p>
                      <p className="font-medium text-white">{selectedTransaction.clients?.company_name || 'Não vinculado'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-background p-3 rounded-md border border-surface/50">
                    <FileText size={16} className="text-text-secondary mt-0.5" />
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase">Origem (Orçamento / OS)</p>
                      <p className="font-medium text-white">
                        {selectedTransaction.quotes?.title || selectedTransaction.service_orders?.quotes?.title || 'Lançamento Manual'}
                      </p>
                    </div>
                  </div>
                  {selectedTransaction.total_installments && selectedTransaction.total_installments > 1 && (
                    <div className="flex items-start gap-3 bg-background p-3 rounded-md border border-surface/50 md:col-span-2">
                      <CreditCard size={16} className="text-text-secondary mt-0.5" />
                      <div>
                        <p className="text-[10px] text-text-secondary uppercase">Parcelamento</p>
                        <p className="font-medium text-white">Parcela {selectedTransaction.installment_number} de {selectedTransaction.total_installments}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-surface/50 bg-background flex justify-between items-center">
              <button 
                onClick={() => confirmDelete(selectedTransaction.id)} 
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
              >
                <Trash2 size={16} /> Excluir
              </button>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => openEditForm(selectedTransaction)} 
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-surface border border-surface/50 hover:bg-surface/80 rounded-md transition-colors"
                >
                  <Edit size={16} /> Editar
                </button>
                {selectedTransaction.status === 'pending' && (
                  <button 
                    onClick={() => updateStatus(selectedTransaction.id, 'paid')} 
                    className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-cs-green hover:bg-opacity-90 rounded-md transition-colors shadow-lg"
                  >
                    <CheckCircle size={16} /> Dar Baixa (Pagar)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header e Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-4 border border-surface/50 rounded-xl">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="text-cs-green" size={24} />
            Hub Financeiro
          </h3>
          <p className="text-xs text-text-secondary mt-1">Gestão centralizada de fluxo de caixa, DRE e inadimplência.</p>
        </div>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all"
        >
          <Plus size={18} /> Novo Lançamento
        </button>
      </div>

      <div className="flex gap-2 border-b border-surface/50 pb-px">
        <button 
          onClick={() => setActiveTab("dashboard")} 
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-cs-green text-cs-green' : 'border-transparent text-text-secondary hover:text-white'}`}
        >
          Visão Geral
        </button>
        <button 
          onClick={() => setActiveTab("receber")} 
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'receber' ? 'border-cs-green text-cs-green' : 'border-transparent text-text-secondary hover:text-white'}`}
        >
          Contas a Receber
        </button>
        <button 
          onClick={() => setActiveTab("pagar")} 
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pagar' ? 'border-red-500 text-red-500' : 'border-transparent text-text-secondary hover:text-white'}`}
        >
          Contas a Pagar
        </button>
      </div>

      {/* Conteúdo das Tabs */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-surface/50 p-6 rounded-xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity">
                <ArrowUpRight size={120} />
              </div>
              <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Receitas (Pagas)</p>
              <p className="text-3xl font-extrabold text-white">{formatCurrency(totalIncomePaid)}</p>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-cs-gold">
                <Clock size={14}/> +{formatCurrency(pendingIncome)} previstos
              </div>
            </div>

            <div className="bg-surface border border-surface/50 p-6 rounded-xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity">
                <ArrowDownRight size={120} />
              </div>
              <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Despesas (Pagas)</p>
              <p className="text-3xl font-extrabold text-white">{formatCurrency(totalExpensePaid)}</p>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-text-secondary">
                <Clock size={14}/> +{formatCurrency(pendingExpense)} previstos
              </div>
            </div>

            <div className="bg-surface border border-surface/50 p-6 rounded-xl md:col-span-2 bg-gradient-to-br from-surface to-background relative overflow-hidden border-l-4 border-l-cs-green shadow-2xl">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
                <Wallet size={80} />
              </div>
              <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Saldo em Caixa (Realizado)</p>
              <p className={`text-4xl font-extrabold ${balance >= 0 ? 'text-cs-green' : 'text-red-500'}`}>
                {formatCurrency(balance)}
              </p>
              <p className="text-xs text-text-secondary mt-2 max-w-[70%]">O saldo reflete apenas os lançamentos com status "Pago". Inadimplências e contas futuras não afetam este valor.</p>
            </div>
          </div>

          {/* Alertas de Inadimplência */}
          {(overdueIncome > 0 || overdueExpense > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overdueIncome > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-full"><AlertTriangle size={20} className="text-red-500"/></div>
                    <div>
                      <p className="text-sm font-bold text-red-500">Inadimplência de Clientes</p>
                      <p className="text-xs text-red-400">Existem faturas vencidas aguardando cobrança.</p>
                    </div>
                  </div>
                  <p className="text-xl font-extrabold text-red-500">{formatCurrency(overdueIncome)}</p>
                </div>
              )}
              {overdueExpense > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/20 rounded-full"><AlertTriangle size={20} className="text-orange-500"/></div>
                    <div>
                      <p className="text-sm font-bold text-orange-500">Contas a Pagar Atrasadas</p>
                      <p className="text-xs text-orange-400">Risco de juros e multas com fornecedores.</p>
                    </div>
                  </div>
                  <p className="text-xl font-extrabold text-orange-500">{formatCurrency(overdueExpense)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "receber" && renderTable("income")}
      {activeTab === "pagar" && renderTable("expense")}
    </div>
  );
}