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
  Receipt, Send, Mail, MessageCircle, ChevronRight
} from "lucide-react";

// --- TIPAGENS ---
interface Client { id: string; company_name: string; email?: string; phone?: string; }
interface Quote { id: string; title: string; }
interface ServiceOrder { id: string; quotes?: Quote | any; }

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
  const labels = systemPreferences?.custom_labels || {};
  const currency = systemPreferences?.currency_code || "BRL";
  const categories = systemPreferences?.financial_categories || { income: [], expense: [] };

  const [activeTab, setActiveTab] = useState<"dashboard" | "receber" | "pagar" | "clientes">("dashboard");
  const [view, setView] = useState<"list" | "create">("list");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // UI States
  const [toast, setToast] = useState<Toast | null>(null);
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

    if (tRes.data) setTransactions(tRes.data as Transaction[]);
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
      showToast("Documento anexado.", "success");
    } catch (err: any) { showToast(err.message, "error"); }
    finally { setUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.dueDate) return;
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
      showToast("Lançamento processado.", "success");
      setView("list");
      fetchData();
    } else { showToast(error.message, "error"); }
    setIsSubmitting(false);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);
  const isOverdue = (date: string, status: string) => new Date(date) < new Date(new Date().setHours(0,0,0,0)) && status === 'pending';

  // --- LÓGICA DE NOTIFICAÇÃO ---
  const sendWhatsApp = (t: Transaction) => {
    const phone = t.clients?.phone?.replace(/\D/g, "");
    if (!phone) { showToast("Cliente sem telefone cadastrado.", "warning"); return; }
    const msg = `Olá, ${t.clients?.company_name}. Consta em nosso sistema um lançamento pendente: ${t.description} no valor de ${formatCurrency(t.amount)}, com vencimento em ${new Date(t.due_date).toLocaleDateString('pt-BR')}. Poderia nos enviar o comprovante?`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // --- CÁLCULOS AGING & DASHBOARD ---
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

  return (
    <div className="space-y-6 relative pb-12">
      {/* TOASTS ARXUM */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border bg-[#1a1413] border-white/10 animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'text-cs-green' : 'text-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-black uppercase tracking-widest text-white">{toast.message}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center bg-surface p-6 border border-surface/50 rounded-xl shadow-lg">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Wallet className="text-cs-green" size={28} /> {financialLabel}
          </h3>
          <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-[0.2em] font-black">Fluxo de Caixa Consolidado ARXUM</p>
        </div>
        <button onClick={() => { setEditId(null); setView("create"); }} className="bg-cs-green text-white px-8 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg flex items-center gap-2">
          <Plus size={18} /> Novo {transactionSingular}
        </button>
      </div>

      {view === "list" && (
        <>
          {/* TABS */}
          <div className="flex gap-2 border-b border-surface/50">
            {["dashboard", "receber", "pagar", "clientes"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-cs-green text-cs-green' : 'border-transparent text-text-secondary hover:text-white'}`}>
                {tab === 'dashboard' ? 'Visão Geral' : tab === 'receber' ? receivableLabel : tab === 'pagar' ? payableLabel : 'Visão por ' + labels.entity_client_singular}
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

              {/* AGING BUCKETS (Visual) */}
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
                    <th className="px-8 py-5">Identificação do {labels.entity_client_singular}</th>
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

          {(activeTab === "receber" || activeTab === "pagar") && (
            <div className="animate-in fade-in duration-300">
              {renderTable(activeTab === "receber" ? "income" : "expense")}
            </div>
          )}
        </>
      )}

      {/* FORMULÁRIO DE LANÇAMENTO */}
      {view === "create" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <button onClick={() => setView("list")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-all uppercase text-[10px] font-black tracking-widest">
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
                  <InputField label="Descrição *" value={formData.description} onChange={v => setForm({...formData, description: v})} />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label={`Valor (${currency}) *`} type="number" value={formData.amount} onChange={v => setForm({...formData, amount: v})} />
                    <InputField label="Vencimento *" type="date" value={formData.dueDate} onChange={v => setForm({...formData, dueDate: v})} />
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
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Vincular {labels.entity_client_singular}</label>
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
                <button type="submit" disabled={isSubmitting} className="bg-cs-green text-white px-12 py-4 rounded-md font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center gap-3">
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
          </div>
        </div>
      )}
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---
function InputField({ label, value, onChange, type = "text" }: { label: string, value: string, onChange: (v: string) => void, type?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all" style={{ colorScheme: 'dark' }} />
    </div>
  );
}