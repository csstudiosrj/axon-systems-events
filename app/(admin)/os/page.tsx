"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Truck, Plus, Loader2, ArrowLeft, Calendar, Clock, Play, CheckCircle, AlertCircle, User, FileText, PackagePlus, Trash2, Save, Eye, Building2, AlertTriangle } from "lucide-react";

export default function OSPage() {
  const[view, setView] = useState<"list" | "create" | "details">("list");
  const[orders, setOrders] = useState<any[]>([]);
  const [availableQuotes, setAvailableQuotes] = useState<any[]>([]);
  const [internalTeam, setInternalTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState({ type: "", text: "" });
  const[confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

  const [activeOS, setActiveOS] = useState<any>(null);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const[extraItems, setExtraItems] = useState<any[]>([]);
  
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [producerId, setProducerId] = useState("");
  
  const[newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");

  const [quoteId, setQuoteId] = useState("");
  const [startDate, setStartDate] = useState("");
  const[endDate, setEndDate] = useState("");

  useEffect(() => {
    if (view === "list") fetchOrders();
    if (view === "create") fetchAvailableQuotes();
    fetchInternalTeam();
  }, [view]);

  const showToast = (type: "success" | "error", text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg({ type: "", text: "" }), 4000);
  };

  const fetchInternalTeam = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, email, role").not("role", "in", "('client', 'student', 'subscriber')");
    if (data) setInternalTeam(data);
  };

  const fetchOrders = async () => {
    setLoading(true);
    // CORREÇÃO APLICADA AQUI: producer:profiles(full_name)
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
  };

  const fetchAvailableQuotes = async () => {
    const { data } = await supabase
      .from("quotes")
      .select("id, title, event_start_date, event_end_date, clients(company_name)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (data) setAvailableQuotes(data);
  };

  const handleQuoteSelection = (selectedId: string) => {
    setQuoteId(selectedId);
    const selectedQuote = availableQuotes.find(q => q.id === selectedId);
    
    if (selectedQuote) {
      if (selectedQuote.event_start_date) {
        const d = new Date(selectedQuote.event_start_date);
        setStartDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      }
      if (selectedQuote.event_end_date) {
        const d = new Date(selectedQuote.event_end_date);
        setEndDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      }
    }
  };

  const openOSDetails = async (os: any) => {
    setLoading(true);
    setActiveOS(os);
    setLogisticsNotes(os.logistics_notes || "");
    setProducerId(os.producer_id || "");

    const { data: qItems } = await supabase.from("quote_items").select("*").eq("quote_id", os.quote_id).eq("category", "equipment");
    if (qItems) setQuoteItems(qItems);

    const { data: eItems } = await supabase.from("os_extra_items").select("*").eq("service_order_id", os.id).order("created_at", { ascending: true });
    if (eItems) setExtraItems(eItems);

    setView("details");
    setLoading(false);
  };

  const handleCreateOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteId || !startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        showToast("error", "Por favor, insira datas válidas.");
        return;
      }

      const { error } = await supabase.from("service_orders").insert([{
        quote_id: quoteId,
        event_start_date: start.toISOString(),
        event_end_date: end.toISOString(),
        status: "pending"
      }]);

      if (!error) {
        setQuoteId(""); setStartDate(""); setEndDate("");
        showToast("success", "Ordem de Serviço gerada com sucesso!");
        setView("list");
      } else {
        showToast("error", "Erro ao criar OS: " + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOSInfo = async () => {
    setIsSubmitting(true);
    const { error } = await supabase.from("service_orders").update({ logistics_notes: logisticsNotes, producer_id: producerId || null }).eq("id", activeOS.id);
    if (!error) {
      showToast("success", "Briefing e responsabilidade atualizados!");
      fetchOrders();
    } else {
      showToast("error", "Erro ao atualizar informações.");
    }
    setIsSubmitting(false);
  };

  const handleAddExtraItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !activeOS) return;

    const { data, error } = await supabase.from("os_extra_items").insert([{ service_order_id: activeOS.id, item_name: newItemName, quantity: Number(newItemQty) }]).select().single();
    if (!error && data) {
      setExtraItems([...extraItems, data]);
      setNewItemName("");
      setNewItemQty("1");
      showToast("success", "Item adicionado à lista de separação.");
    }
  };

  const requestDeleteExtraItem = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Remover Item Extra?",
      message: "Este item será removido da lista de separação do galpão.",
      onConfirm: async () => {
        const { error } = await supabase.from("os_extra_items").delete().eq("id", id);
        if (!error) {
          setExtraItems(extraItems.filter(item => item.id !== id));
          showToast("success", "Item removido com sucesso.");
        } else {
          showToast("error", "Erro ao remover item.");
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
      showToast("success", "Status operacional atualizado.");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
      pending: { label: "Pendente", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock },
      load_in: { label: "Load-in (Montagem)", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Truck },
      execution: { label: "Em Execução", color: "bg-cs-gold/10 text-cs-gold border-cs-gold/20", icon: Play },
      load_out: { label: "Load-out (Desmontagem)", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: AlertCircle },
      completed: { label: "Concluído", color: "bg-cs-green/10 text-cs-green border-cs-green/20", icon: CheckCircle },
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}><Icon size={12} />{config.label}</span>;
  };

  return (
    <div className="space-y-6 relative pb-12">
      
      {feedbackMsg.text && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-md shadow-2xl text-sm font-bold border animate-in slide-in-from-right-8 ${feedbackMsg.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 'bg-cs-green/90 text-white border-cs-green'}`}>
          {feedbackMsg.text}
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
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 rounded-md border border-surface text-text-secondary hover:text-white hover:bg-background transition-colors font-medium text-sm">
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
              <ArrowLeft size={20} /> Voltar para Logística
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-secondary">Status da Operação:</span>
              <select
                value={activeOS.status}
                onChange={(e) => updateOrderStatus(activeOS.id, e.target.value)}
                className="bg-surface border border-surface/50 text-white text-sm rounded-md px-4 py-2 focus:border-cs-green focus:outline-none font-bold cursor-pointer"
              >
                <option value="pending">Pendente (Aguardando)</option>
                <option value="load_in">Load-in (Montagem)</option>
                <option value="execution">Em Execução (Rodando)</option>
                <option value="load_out">Load-out (Desmontagem)</option>
                <option value="completed">Concluído (Retornou)</option>
              </select>
            </div>
          </div>

          <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-lg">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border border-blue-500/30">
                    OS #{activeOS.id.split('-')[0]}
                  </span>
                  {getStatusBadge(activeOS.status)}
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{activeOS.quotes?.title}</h2>
                <p className="text-text-secondary flex items-center gap-2">
                  <Building2 size={16} /> {activeOS.quotes?.clients?.company_name} 
                  {activeOS.quotes?.clients?.contact_name && ` • A/C: ${activeOS.quotes.clients.contact_name}`}
                </p>
              </div>
              
              <div className="bg-background border border-surface/50 p-4 rounded-md min-w-[250px]">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary flex items-center gap-2"><Calendar size={14}/> Início:</span>
                    <span className="font-medium text-white">{new Date(activeOS.event_start_date).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary flex items-center gap-2"><Calendar size={14}/> Fim:</span>
                    <span className="font-medium text-white">{new Date(activeOS.event_end_date).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</span>
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
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Produtor / Técnico Líder</label>
                    <select
                      value={producerId}
                      onChange={(e) => setProducerId(e.target.value)}
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer"
                    >
                      <option value="">Não atribuído</option>
                      {internalTeam.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name || user.email} ({user.role})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-surface/50 p-6 rounded-lg">
                <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="text-cs-gold" size={18} /> Briefing Logístico
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Observações para o Galpão</label>
                    <textarea
                      rows={6}
                      value={logisticsNotes}
                      onChange={(e) => setLogisticsNotes(e.target.value)}
                      placeholder="Ex: Palco a 50m da house mix. Levar multicabo extra..."
                      className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none resize-none text-sm custom-scrollbar"
                    />
                  </div>
                  <button 
                    onClick={handleUpdateOSInfo}
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center gap-2 rounded-md bg-surface border border-surface/50 py-2 text-sm font-medium text-white hover:bg-background transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Salvar Briefing
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-surface/50 bg-background/30">
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <PackagePlus className="text-blue-400" size={18} />
                    Equipamentos Vendidos (Base do Orçamento)
                  </h3>
                </div>
                <div className="p-4">
                  {quoteItems.length === 0 ? (
                    <p className="text-sm text-text-secondary text-center py-4">Nenhum equipamento listado no orçamento.</p>
                  ) : (
                    <ul className="space-y-2">
                      {quoteItems.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-background border border-surface/50 p-3 rounded-md">
                          <span className="text-sm font-medium text-white">{item.description}</span>
                          <span className="text-xs font-bold bg-surface px-2 py-1 rounded text-text-secondary">Qtd: {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-surface/50 bg-background/30 flex justify-between items-center">
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <Truck className="text-cs-green" size={18} />
                    Itens Extras de Logística (Cabos, Fitas, Backups)
                  </h3>
                </div>
                
                <div className="p-4 border-b border-surface/50 bg-background/50">
                  <form onSubmit={handleAddExtraItem} className="flex gap-3">
                    <input
                      type="text"
                      required
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Ex: Rolo de Fita Gaffer Preta"
                      className="flex-1 rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm"
                    />
                    <input
                      type="number"
                      min="1"
                      required
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-20 rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm text-center"
                    />
                    <button type="submit" className="bg-cs-green text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-opacity-90 transition-colors">
                      Adicionar
                    </button>
                  </form>
                </div>

                <div className="p-4">
                  {extraItems.length === 0 ? (
                    <p className="text-sm text-text-secondary text-center py-4">Nenhum item extra adicionado para este evento.</p>
                  ) : (
                    <ul className="space-y-2">
                      {extraItems.map((item) => (
                        <li key={item.id} className="flex items-center justify-between bg-background border border-surface/50 p-3 rounded-md group">
                          <div className="flex items-center gap-3">
                            <span className="text-cs-green font-bold text-xs">EXTRA</span>
                            <span className="text-sm font-medium text-white">{item.item_name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold bg-surface px-2 py-1 rounded text-text-secondary">Qtd: {item.quantity}</span>
                            <button onClick={() => requestDeleteExtraItem(item.id)} className="text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "create" && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <button onClick={() => setView("list")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
              <ArrowLeft size={20} /> Voltar para lista
            </button>
          </div>

          <div className="bg-surface border border-surface/50 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
              <Plus className="text-cs-green" size={20} />
              Gerar Nova Ordem de Serviço
            </h3>
            
            <form onSubmit={handleCreateOS} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Vincular ao Orçamento Aprovado *</label>
                <select required value={quoteId} onChange={(e) => handleQuoteSelection(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors cursor-pointer">
                  <option value="">Selecione o orçamento...</option>
                  {availableQuotes.map(q => (
                    <option key={q.id} value={q.id}>{q.title} - {q.clients?.company_name}</option>
                  ))}
                </select>
                <p className="text-xs text-cs-gold mt-2">Apenas orçamentos com status "Aprovado" aparecem nesta lista.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2"><Calendar size={14} /> Início do Evento (Load-in) *</label>
                  <input type="datetime-local" required max="2099-12-31T23:59" value={startDate} onChange={(e) => { if (e.target.value.length <= 16) setStartDate(e.target.value); }} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2"><Calendar size={14} /> Fim do Evento (Load-out) *</label>
                  <input type="datetime-local" required max="2099-12-31T23:59" value={endDate} onChange={(e) => { if (e.target.value.length <= 16) setEndDate(e.target.value); }} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-surface/50">
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Gerar OS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
            <div>
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Truck className="text-cs-green" size={20} />
                Painel de Logística e OS
              </h3>
              <p className="text-xs text-text-secondary mt-1">Controle de separação, montagem e desmontagem.</p>
            </div>
            <button onClick={() => setView("create")} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all">
              <Plus size={18} /> Gerar OS
            </button>
          </div>

          <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary">
                <thead className="bg-background/50 text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-6 py-4 font-medium">OS / Evento</th>
                    <th className="px-6 py-4 font-medium">Responsável</th>
                    <th className="px-6 py-4 font-medium">Período</th>
                    <th className="px-6 py-4 font-medium">Status Operacional</th>
                    <th className="px-6 py-4 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface/50">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center"><Loader2 className="animate-spin mx-auto mb-2 text-cs-green" size={24} /></td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-text-secondary">Nenhuma Ordem de Serviço gerada.</td></tr>
                  ) : (
                    orders.map((os) => (
                      <tr key={os.id} className="hover:bg-background/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-white">{os.quotes?.title}</p>
                          <p className="text-xs mt-1">{os.quotes?.clients?.company_name}</p>
                          <p className="text-[10px] text-blue-400 mt-1 font-mono uppercase">#{os.id.split('-')[0]}</p>
                        </td>
                        <td className="px-6 py-4">
                          {os.producer ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-white"><User size={14} className="text-cs-gold"/> {os.producer.full_name}</span>
                          ) : (
                            <span className="text-xs text-red-400">Não atribuído</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1 text-xs">
                            <p><span className="text-gray-500">Início:</span> {new Date(os.event_start_date).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</p>
                            <p><span className="text-gray-500">Fim:</span> {new Date(os.event_end_date).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(os.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => openOSDetails(os)}
                            className="inline-flex items-center gap-2 bg-cs-green/10 text-cs-green hover:bg-cs-green hover:text-white px-4 py-2 rounded-md transition-colors font-bold text-xs"
                          >
                            <Eye size={14} /> Abrir Painel
                          </button>
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