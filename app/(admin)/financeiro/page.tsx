"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Wallet, Plus, Loader2, ArrowLeft, ArrowUpRight, ArrowDownRight, DollarSign, Clock, CheckCircle, XCircle, Save, Trash2 } from "lucide-react";

export default function FinanceiroPage() {
  const[view, setView] = useState<"list" | "create">("list");
  const[transactions, setTransactions] = useState<any[]>([]);
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const[isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Formulário
  const [editId, setEditId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const[type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("Serviço");
  const [amount, setAmount] = useState("");
  const[status, setStatus] = useState("pending");
  const [dueDate, setDueDate] = useState("");
  const[paymentDate, setPaymentDate] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");

  useEffect(() => {
    if (view === "list") fetchTransactions();
    if (view === "create") fetchServiceOrders();
  }, [view]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financial_transactions")
      .select(`
        *,
        service_orders (
          id,
          quotes ( title )
        )
      `)
      .order("due_date", { ascending: true });
      
    if (!error && data) setTransactions(data);
    setLoading(false);
  };

  const fetchServiceOrders = async () => {
    const { data } = await supabase
      .from("service_orders")
      .select(`id, quotes(title)`)
      .order("created_at", { ascending: false });
    if (data) setServiceOrders(data);
  };

  const resetForm = () => {
    setEditId(null);
    setDescription("");
    setType("income");
    setCategory("Serviço");
    setAmount("");
    setStatus("pending");
    setDueDate("");
    setPaymentDate("");
    setServiceOrderId("");
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !dueDate) return;

    setIsSubmitting(true);

    const payload = {
      description,
      type,
      category,
      amount: Number(amount),
      status,
      due_date: dueDate,
      payment_date: paymentDate || null,
      service_order_id: serviceOrderId || null
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
      resetForm();
      setView("list");
    } else {
      alert("Erro ao salvar transação: " + error.message);
    }
    setIsSubmitting(false);
  };

  const handleEdit = (t: any) => {
    setEditId(t.id);
    setDescription(t.description);
    setType(t.type);
    setCategory(t.category || "");
    setAmount(t.amount.toString());
    setStatus(t.status);
    setDueDate(t.due_date);
    setPaymentDate(t.payment_date || "");
    setServiceOrderId(t.service_order_id || "");
    setView("create");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este lançamento?")) return;
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (!error) fetchTransactions();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const payload: any = { status: newStatus };
    if (newStatus === 'paid') {
      payload.payment_date = new Date().toISOString().split('T')[0]; // Define a data de hoje se marcar como pago
    }
    
    const { error } = await supabase.from("financial_transactions").update(payload).eq("id", id);
    if (!error) fetchTransactions();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Cálculos do Dashboard Financeiro
  const totalIncome = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingIncome = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingExpense = transactions.filter(t => t.type === 'expense' && t.status === 'pending').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const balance = totalIncome - totalExpense;

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => { resetForm(); setView("list"); }} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para o Fluxo
          </button>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
            <Plus className="text-cs-green" size={20} />
            {editId ? "Editar Lançamento" : "Novo Lançamento Financeiro"}
          </h3>
          
          <form onSubmit={handleSaveTransaction} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="md:col-span-2 flex gap-4 p-1 bg-background rounded-md border border-surface/50 w-fit">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`px-6 py-2 rounded text-sm font-medium transition-colors ${type === 'income' ? 'bg-cs-green text-white' : 'text-text-secondary hover:text-white'}`}
                >
                  Receita (Entrada)
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`px-6 py-2 rounded text-sm font-medium transition-colors ${type === 'expense' ? 'bg-red-500 text-white' : 'text-text-secondary hover:text-white'}`}
                >
                  Despesa (Saída)
                </button>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-1">Descrição *</label>
                <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: Pagamento Sinal Evento XYZ ou Pagamento Freelancer" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Categoria</label>
                <input type="text" list="finance-categories" value={category} onChange={(e) => setCategory(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Ex: Locação, Frete, Imposto" />
                <datalist id="finance-categories">
                  <option value="Serviço" />
                  <option value="Locação de Equipamento" />
                  <option value="Equipe / Freelancer" />
                  <option value="Logística / Frete" />
                  <option value="Impostos / Taxas" />
                  <option value="Manutenção" />
                  <option value="Marketing" />
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Data de Vencimento *</label>
                <input type="date" max="2099-12-31" required value={dueDate} onChange={(e) => { if (e.target.value.length <= 10) setDueDate(e.target.value); }} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors">
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago / Recebido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              {status === 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Data do Pagamento</label>
                  <input type="date" max="2099-12-31" required={status === 'paid'} value={paymentDate} onChange={(e) => { if (e.target.value.length <= 10) setPaymentDate(e.target.value); }} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                </div>
              )}

              <div className="md:col-span-2 pt-4 border-t border-surface/50">
                <label className="block text-sm font-medium text-text-secondary mb-1">Vincular a um Evento / OS (Centro de Custos)</label>
                <select value={serviceOrderId} onChange={(e) => setServiceOrderId(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors">
                  <option value="">Lançamento Avulso (Não vinculado)</option>
                  {serviceOrders.map(os => (
                    <option key={os.id} value={os.id}>
                      OS: #{os.id.split('-')[0]} - {os.quotes?.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-secondary mt-1">Vincule despesas e receitas a uma OS para calcular o lucro real do evento.</p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-surface/50">
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
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
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Wallet className="text-cs-green" size={20} />
          Gestão Financeira
        </h3>
        <button
          onClick={() => { resetForm(); setView("create"); }}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
        >
          <Plus size={18} /> Novo Lançamento
        </button>
      </div>

      {/* Dashboard Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-surface/50 p-5 rounded-lg">
          <div className="flex items-center gap-3 mb-2 text-text-secondary">
            <ArrowUpRight size={18} className="text-cs-green" />
            <span className="text-sm font-medium">Receitas (Pagas)</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-text-secondary mt-1">+{formatCurrency(pendingIncome)} a receber</p>
        </div>

        <div className="bg-surface border border-surface/50 p-5 rounded-lg">
          <div className="flex items-center gap-3 mb-2 text-text-secondary">
            <ArrowDownRight size={18} className="text-red-500" />
            <span className="text-sm font-medium">Despesas (Pagas)</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalExpense)}</p>
          <p className="text-xs text-text-secondary mt-1">+{formatCurrency(pendingExpense)} a pagar</p>
        </div>

        <div className="bg-surface border border-surface/50 p-5 rounded-lg md:col-span-2 bg-gradient-to-br from-surface to-background relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5">
            <DollarSign size={100} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2 text-text-secondary">
              <Wallet size={18} className="text-cs-gold" />
              <span className="text-sm font-medium">Saldo Atual (Caixa)</span>
            </div>
            <p className={`text-3xl font-extrabold ${balance >= 0 ? 'text-cs-green' : 'text-red-500'}`}>
              {formatCurrency(balance)}
            </p>
            <p className="text-xs text-text-secondary mt-1">Lucratividade baseada nos lançamentos efetivados.</p>
          </div>
        </div>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Descrição / Evento</th>
                <th className="px-6 py-3 font-medium">Vencimento</th>
                <th className="px-6 py-3 font-medium">Valor</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando fluxo...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    Nenhum lançamento financeiro registrado.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {t.type === 'income' ? <ArrowUpRight size={16} className="text-cs-green shrink-0" /> : <ArrowDownRight size={16} className="text-red-500 shrink-0" />}
                        <div>
                          <p className="font-medium text-white">{t.description}</p>
                          <p className="text-xs mt-0.5">{t.category}</p>
                          {t.service_orders && (
                            <p className="text-[10px] text-cs-gold mt-1 uppercase">OS: {t.service_orders.quotes?.title}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className={new Date(t.due_date) < new Date() && t.status === 'pending' ? 'text-red-400' : 'text-text-secondary'} />
                        <span className={new Date(t.due_date) < new Date() && t.status === 'pending' ? 'text-red-400 font-medium' : ''}>
                          {new Date(t.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${t.type === 'income' ? 'text-cs-green' : 'text-red-400'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={t.status}
                        onChange={(e) => updateStatus(t.id, e.target.value)}
                        className={`text-xs rounded-full px-2.5 py-1 font-medium border focus:outline-none cursor-pointer ${
                          t.status === 'paid' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' :
                          t.status === 'cancelled' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                          'bg-cs-gold/10 text-cs-gold border-cs-gold/20'
                        }`}
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago/Recebido</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => handleEdit(t)} className="text-text-secondary hover:text-cs-gold transition-colors">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="text-text-secondary hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}