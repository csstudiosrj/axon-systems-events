"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Truck, Plus, Loader2, ArrowLeft, Calendar, Clock, Play, CheckCircle, AlertCircle } from "lucide-react";

export default function OSPage() {
  const[view, setView] = useState<"list" | "create">("list");
  const [orders, setOrders] = useState<any[]>([]);
  const [availableQuotes, setAvailableQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const[isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Formulário
  const [quoteId, setQuoteId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (view === "list") fetchOrders();
    if (view === "create") fetchAvailableQuotes();
  }, [view]);

  const fetchOrders = async () => {
    setLoading(true);
    // Busca as OSs e traz junto os dados do Orçamento e do Cliente
    const { data, error } = await supabase
      .from("service_orders")
      .select(`
        *,
        quotes (
          title,
          clients (company_name)
        )
      `)
      .order("created_at", { ascending: false });
      
    if (!error && data) setOrders(data);
    setLoading(false);
  };

  const fetchAvailableQuotes = async () => {
    // Busca orçamentos para vincular à nova OS
    const { data } = await supabase
      .from("quotes")
      .select("id, title, clients(company_name)")
      .order("created_at", { ascending: false });
      
    if (data) setAvailableQuotes(data);
  };

  const handleCreateOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteId || !startDate || !endDate) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from("service_orders")
      .insert([{
        quote_id: quoteId,
        event_start_date: new Date(startDate).toISOString(),
        event_end_date: new Date(endDate).toISOString(),
        status: "pending"
      }]);

    if (!error) {
      setQuoteId("");
      setStartDate("");
      setEndDate("");
      setView("list");
    } else {
      alert("Erro ao criar OS. Verifique se este orçamento já possui uma OS vinculada. Erro: " + error.message);
    }
    setIsSubmitting(false);
  };

  const updateOrderStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("service_orders")
      .update({ status: newStatus })
      .eq("id", id);

    if (!error) {
      fetchOrders();
    } else {
      alert("Erro ao atualizar status.");
    }
  };

  // Função para renderizar o badge de status com cores dinâmicas
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

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
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
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Vincular ao Orçamento / Evento *
              </label>
              <select
                required
                value={quoteId}
                onChange={(e) => setQuoteId(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
              >
                <option value="">Selecione o orçamento aprovado...</option>
                {availableQuotes.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.title} - {q.clients?.company_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-secondary mt-2">
                * Cada orçamento pode ter apenas uma Ordem de Serviço vinculada.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                  <Calendar size={14} /> Início do Evento (Load-in) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                  <Calendar size={14} /> Fim do Evento (Load-out) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-surface/50">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Gerar OS"}
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
          <Truck className="text-cs-green" size={20} />
          Logística e Ordens de Serviço
        </h3>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
        >
          <Plus size={18} /> Gerar OS
        </button>
      </div>

      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-4 font-medium">Evento / Cliente</th>
                <th className="px-6 py-4 font-medium">Período de Execução</th>
                <th className="px-6 py-4 font-medium">Status Operacional</th>
                <th className="px-6 py-4 font-medium text-right">Atualizar Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando logística...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    Nenhuma Ordem de Serviço gerada.
                  </td>
                </tr>
              ) : (
                orders.map((os) => (
                  <tr key={os.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{os.quotes?.title}</p>
                      <p className="text-xs mt-1">{os.quotes?.clients?.company_name}</p>
                      <p className="text-[10px] text-text-secondary mt-1 uppercase">OS: #{os.id.split('-')[0]}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-xs">
                        <p><span className="text-gray-500">Início:</span> {new Date(os.event_start_date).toLocaleString('pt-BR')}</p>
                        <p><span className="text-gray-500">Fim:</span> {new Date(os.event_end_date).toLocaleString('pt-BR')}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(os.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={os.status}
                        onChange={(e) => updateOrderStatus(os.id, e.target.value)}
                        className="bg-background border border-surface/50 text-white text-xs rounded px-2 py-1.5 focus:border-cs-green focus:outline-none"
                      >
                        <option value="pending">Pendente</option>
                        <option value="load_in">Load-in (Montagem)</option>
                        <option value="execution">Em Execução</option>
                        <option value="load_out">Load-out (Desmontagem)</option>
                        <option value="completed">Concluído</option>
                      </select>
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