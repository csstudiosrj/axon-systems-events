"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Truck, Plus, Loader2, ArrowLeft, Calendar, Clock, 
  Play, CheckCircle, AlertCircle, User, FileText, 
  PackagePlus, Trash2, Save, Eye, Building2, AlertTriangle, Check, Printer
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface ExtraItem {
  id: string;
  item_name: string;
  quantity: number;
}

interface QuoteItem {
  description: string;
  quantity: number;
}

interface InternalProfile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

export default function OSPage() {
  const router = useRouter();
  const { systemPreferences } = useSettings();
  
  const labels = systemPreferences?.custom_labels || {};
  const osSingular = labels.entity_service_order_singular || "OS";
  const osPlural = labels.entity_service_order_plural || "Ordens de Serviço";
  const quoteSingular = labels.entity_quote_singular || "Orçamento";
  const quotePlural = labels.entity_quote_plural || "Orçamentos";

  const [view, setView] = useState<"list" | "create" | "details">("list");
  const [orders, setOrders] = useState<any[]>([]);
  const [availableQuotes, setAvailableQuotes] = useState<any[]>([]);
  const [internalTeam, setInternalTeam] = useState<InternalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

  const [activeOS, setActiveOS] = useState<any>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [producerId, setProducerId] = useState("");
  
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");

  const [quoteId, setQuoteId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchInternalTeam = useCallback(async () => {
    const staffRoles = ['super_admin', 'admin', 'commercial', 'financial', 'logistics', 'marketing', 'training', 'support'];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", staffRoles);
    
    if (!error && data) setInternalTeam(data as InternalProfile[]);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_orders")
      .select(`
        *,
        producer:profiles(full_name),
        quotes (
          title,
          clients (company_name, contact_name, phone)
        )
      `)
      .order("event_start_date", { ascending: true });
      
    if (!error && data) setOrders(data);
    setLoading(false);
  }, []);

  const fetchAvailableQuotes = useCallback(async () => {
    const { data } = await supabase
      .from("quotes")
      .select("id, title, event_start_date, event_end_date, clients(company_name)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (data) setAvailableQuotes(data);
  }, []);

  useEffect(() => {
    if (view === "list") fetchOrders();
    if (view === "create") fetchAvailableQuotes();
    fetchInternalTeam();
  }, [view, fetchOrders, fetchAvailableQuotes, fetchInternalTeam]);

  const openOSDetails = async (os: any) => {
    setLoading(true);
    setActiveOS(os);
    setLogisticsNotes(os.logistics_notes || "");
    setProducerId(os.producer_id || "");

    const { data: qItems } = await supabase
      .from("quote_items")
      .select("description, quantity")
      .eq("quote_id", os.quote_id)
      .eq("category", "equipment");
    if (qItems) setQuoteItems(qItems);

    const { data: eItems } = await supabase
      .from("os_extra_items")
      .select("*")
      .eq("service_order_id", os.id)
      .order("created_at", { ascending: true });
    if (eItems) setExtraItems(eItems);

    setView("details");
    setLoading(false);
  };

  const handleCreateOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteId || !startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("service_orders").insert([{
        quote_id: quoteId,
        event_start_date: new Date(startDate).toISOString(),
        event_end_date: new Date(endDate).toISOString(),
        status: "pending"
      }]);

      if (!error) {
        showToast(`${osSingular} gerada com sucesso no sistema ARXUM!`, "success");
        setView("list");
      } else {
        showToast(`Erro: ${error.message}`, "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOSInfo = async () => {
    if (!activeOS) return;
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from("service_orders")
      .update({ 
        logistics_notes: logisticsNotes, 
        producer_id: producerId || null 
      })
      .eq("id", activeOS.id);
      
    if (!error) {
      showToast("Dados de logística salvos.", "success");
      fetchOrders();
    } else {
      showToast(`Erro 403/RLS: Verifique as permissões no banco.`, "error");
    }
    setIsSubmitting(false);
  };

  const handleAddExtraItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !activeOS) return;

    const { data, error } = await supabase
      .from("os_extra_items")
      .insert([{ 
        service_order_id: activeOS.id, 
        item_name: newItemName, 
        quantity: Number(newItemQty) 
      }])
      .select()
      .single();
      
    if (!error && data) {
      setExtraItems([...extraItems, data]);
      setNewItemName("");
      setNewItemQty("1");
      showToast("Item extra adicionado.", "success");
    } else {
      showToast(`Erro 403: Acesso negado ao gravar item extra.`, "error");
    }
  };

  const requestDeleteExtraItem = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Remover Item?",
      message: "Deseja retirar este item da lista?",
      onConfirm: async () => {
        const { error } = await supabase.from("os_extra_items").delete().eq("id", id);
        if (!error) {
          setExtraItems(extraItems.filter(item => item.id !== id));
          showToast("Item removido.", "success");
        }
        setConfirmModal(null);
      }
    });
  };

  const updateOrderStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("service_orders").update({ status: newStatus }).eq("id", id);
    if (!error) {
      if (activeOS && activeOS.id === id) setActiveOS({ ...activeOS, status: newStatus });
      fetchOrders();
      showToast("Status operacional atualizado.", "success");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
      pending: { label: "Pendente", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock },
      load_in: { label: "Load-in", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Truck },
      execution: { label: "Em Execução", color: "bg-cs-gold/10 text-cs-gold border-cs-gold/20", icon: Play },
      load_out: { label: "Load-out", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: AlertCircle },
      completed: { label: "Concluído", color: "bg-cs-green/10 text-cs-green border-cs-green/20", icon: CheckCircle },
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}><Icon size={12} />{config.label}</span>;
  };

  return (
    <div className="space-y-6 relative pb-12">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-md shadow-lg flex items-center gap-2 border animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'bg-cs-green/10 border-cs-green/20 text-cs-green' : 
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
          'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-text-secondary mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 rounded-md border border-surface text-text-secondary hover:text-white transition-colors font-medium text-sm">
                Cancelar
              </button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-2 rounded-md bg-red-500 text-white font-medium text-sm hover:bg-opacity-90 transition-colors shadow-lg">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "details" && activeOS && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <button onClick={() => setView("list")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
              <ArrowLeft size={20} /> Voltar para {osPlural}
            </button>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.push(`/os/${activeOS.id}`)}
                className="flex items-center gap-2 bg-background border border-surface/50 text-text-secondary hover:text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <Printer size={18} /> Gerar PDF da {osSingular}
              </button>
              <select
                value={activeOS.status}
                onChange={(e) => updateOrderStatus(activeOS.id, e.target.value)}
                className="bg-surface border border-surface/50 text-white text-sm rounded-md px-4 py-2 focus:border-cs-green focus:outline-none font-bold cursor-pointer"
              >
                <option value="pending">Pendente</option>
                <option value="load_in">Load-in</option>
                <option value="execution">Em Execução</option>
                <option value="load_out">Load-out</option>
                <option value="completed">Concluído</option>
              </select>
            </div>
          </div>

          <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-lg">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border border-blue-500/30">
                    {osSingular} #{activeOS.id.split('-')[0]}
                  </span>
                  {getStatusBadge(activeOS.status)}
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{activeOS.quotes?.title}</h2>
                <p className="text-text-secondary flex items-center gap-2">
                  <Building2 size={16} /> {activeOS.quotes?.clients?.company_name} 
                </p>
              </div>
              
              <div className="bg-background border border-surface/50 p-4 rounded-md min-w-[250px]">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary flex items-center gap-2"><Calendar size={14}/> Início:</span>
                    <span className="font-medium text-white">{new Date(activeOS.event_start_date).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary flex items-center gap-2"><Calendar size={14}/> Fim:</span>
                    <span className="font-medium text-white">{new Date(activeOS.event_end_date).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-surface border border-surface/50 p-6 rounded-lg">
                <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                  <User className="text-cs-green" size={18} /> Responsabilidade
                </h3>
                <div className="space-y-4">
                  <select
                    value={producerId}
                    onChange={(e) => setProducerId(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                  >
                    <option value="">Não atribuído</option>
                    {internalTeam.map(user => (
                      <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-surface border border-surface/50 p-6 rounded-lg">
                <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="text-cs-gold" size={18} /> Briefing Logístico
                </h3>
                <div className="space-y-4">
                  <textarea
                    rows={6}
                    value={logisticsNotes}
                    onChange={(e) => setLogisticsNotes(e.target.value)}
                    className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none resize-none text-sm"
                  />
                  <button onClick={handleUpdateOSInfo} className="w-full flex justify-center items-center gap-2 rounded-md bg-cs-green py-2 text-sm font-bold text-white hover:bg-opacity-90 transition-all">
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-surface/50 bg-background/30">
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <PackagePlus className="text-blue-400" size={18} /> Equipamentos do {quoteSingular}
                  </h3>
                </div>
                <div className="p-4">
                  <ul className="space-y-2">
                    {quoteItems.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between bg-background border border-surface/50 p-3 rounded-md">
                        <span className="text-sm font-medium text-white">{item.description}</span>
                        <span className="text-xs font-bold bg-surface px-2 py-1 rounded text-text-secondary">Qtd: {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-surface/50 bg-background/30 flex justify-between items-center">
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <Truck className="text-cs-green" size={18} /> Itens Extras de Logística
                  </h3>
                </div>
                <div className="p-4 border-b border-surface/50 bg-background/50">
                  <form onSubmit={handleAddExtraItem} className="flex gap-3">
                    <input type="text" required value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item backup..." className="flex-1 rounded-md border border-surface bg-background px-3 py-2 text-white text-sm" />
                    <input type="number" min="1" required value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} className="w-20 rounded-md border border-surface bg-background px-3 py-2 text-white text-sm text-center" />
                    <button type="submit" className="bg-cs-green text-white px-4 py-2 rounded-md text-sm font-bold">Adicionar</button>
                  </form>
                </div>
                <div className="p-4">
                  <ul className="space-y-2">
                    {extraItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between bg-background border border-surface/50 p-3 rounded-md group">
                        <span className="text-sm font-medium text-white">{item.item_name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold bg-surface px-2 py-1 rounded text-text-secondary">Qtd: {item.quantity}</span>
                          <button onClick={() => requestDeleteExtraItem(item.id)} className="text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
            <div>
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Truck className="text-cs-green" size={20} /> Painel de Logística / {osPlural}
              </h3>
              <p className="text-xs text-text-secondary mt-1">Gestão operacional ARXUM.</p>
            </div>
            <button onClick={() => setView("create")} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-bold text-white shadow-sm hover:bg-opacity-90 transition-all">
              <Plus size={18} /> Gerar {osSingular}
            </button>
          </div>

          <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary">
                <thead className="bg-background/50 text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-6 py-4 font-medium">{osSingular} / Evento</th>
                    <th className="px-6 py-4 font-medium">Responsável</th>
                    <th className="px-6 py-4 font-medium">Status Operacional</th>
                    <th className="px-6 py-4 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface/50">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center"><Loader2 className="animate-spin mx-auto text-cs-green" size={24} /></td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center">Nenhuma {osSingular.toLowerCase()} ativa.</td></tr>
                  ) : (
                    orders.map((os) => (
                      <tr key={os.id} className="hover:bg-background/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-white">{os.quotes?.title}</p>
                          <p className="text-xs mt-1">{os.quotes?.clients?.company_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-white">{os.producer?.full_name || "Pendente"}</span>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(os.status)}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openOSDetails(os)} className="bg-cs-green/10 text-cs-green hover:bg-cs-green hover:text-white px-4 py-2 rounded-md font-bold text-xs">Abrir Painel</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}