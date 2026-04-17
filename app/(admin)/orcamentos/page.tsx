"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { FileText, Plus, Search, Loader2, ArrowLeft, Trash2, Save, Printer } from "lucide-react";
import Link from "next/link";

export default function OrcamentosPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [quotes, setQuotes] = useState<any[]>([]);
  const[clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const[clientId, setClientId] = useState("");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (view === "list") fetchQuotes();
    if (view === "create") fetchClients();
  }, [view]);

  const fetchQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select("*, clients(company_name)")
      .order("created_at", { ascending: false });
    if (!error && data) setQuotes(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("id, company_name").order("company_name");
    if (data) setClients(data);
  };

  const addItem = (category: "equipment" | "labor" | "logistics") => {
    setItems([...items, { id: Date.now(), category, description: "", quantity: 1, daily_rate: 0, days: 1 }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: string, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const calculateTotals = () => {
    let equipment = 0;
    let labor = 0;
    let logistics = 0;

    items.forEach(item => {
      const total = (Number(item.quantity) || 0) * (Number(item.daily_rate) || 0) * (Number(item.days) || 0);
      if (item.category === "equipment") equipment += total;
      if (item.category === "labor") labor += total;
      if (item.category === "logistics") logistics += total;
    });

    return { equipment, labor, logistics, final: equipment + labor + logistics };
  };

  const totals = calculateTotals();

  const handleSaveQuote = async () => {
    if (!title || !clientId || items.length === 0) {
      alert("Preencha o título, selecione o cliente e adicione pelo menos um item.");
      return;
    }

    setIsSubmitting(true);

    const { data: quoteData, error: quoteError } = await supabase
      .from("quotes")
      .insert([{
        title,
        client_id: clientId,
        total_equipment_cost: totals.equipment,
        total_labor_cost: totals.labor,
        total_logistics_cost: totals.logistics,
        final_amount: totals.final,
        status: "draft"
      }])
      .select()
      .single();

    if (quoteError) {
      alert("Erro ao salvar orçamento: " + quoteError.message);
      setIsSubmitting(false);
      return;
    }

    const itemsToInsert = items.map(item => ({
      quote_id: quoteData.id,
      category: item.category,
      description: item.description,
      quantity: Number(item.quantity),
      daily_rate: Number(item.daily_rate),
      days: Number(item.days),
      total_price: Number(item.quantity) * Number(item.daily_rate) * Number(item.days)
    }));

    const { error: itemsError } = await supabase.from("quote_items").insert(itemsToInsert);

    if (!itemsError) {
      setTitle("");
      setClientId("");
      setItems([]);
      setView("list");
    } else {
      alert("Erro ao salvar itens: " + itemsError.message);
    }
    
    setIsSubmitting(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Voltar para lista
          </button>
          <button
            onClick={handleSaveQuote}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar Orçamento
          </button>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
          <h3 className="text-lg font-medium text-white border-b border-surface/50 pb-2">Dados do Evento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Nome do Evento / Proposta</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                placeholder="Ex: Lançamento Produto X"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Cliente</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
              >
                <option value="">Selecione um cliente...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-6">
          <div className="flex items-center justify-between border-b border-surface/50 pb-2">
            <h3 className="text-lg font-medium text-white">Planilha de Custos</h3>
            <div className="flex gap-2">
              <button onClick={() => addItem("equipment")} className="text-xs bg-cs-green/10 text-cs-green px-3 py-1.5 rounded hover:bg-cs-green/20 transition-colors">+ Equipamento</button>
              <button onClick={() => addItem("labor")} className="text-xs bg-cs-gold/10 text-cs-gold px-3 py-1.5 rounded hover:bg-cs-gold/20 transition-colors">+ Equipe</button>
              <button onClick={() => addItem("logistics")} className="text-xs bg-blue-500/10 text-blue-500 px-3 py-1.5 rounded hover:bg-blue-500/20 transition-colors">+ Logística</button>
            </div>
          </div>

          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-center text-text-secondary py-8">Nenhum item adicionado. Use os botões acima para começar.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 bg-background p-3 rounded-md border border-surface/50">
                  <div className="w-24">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      item.category === 'equipment' ? 'bg-cs-green/10 text-cs-green' : 
                      item.category === 'labor' ? 'bg-cs-gold/10 text-cs-gold' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {item.category === 'equipment' ? 'Equip.' : item.category === 'labor' ? 'Equipe' : 'Logística'}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Descrição do item..."
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    className="flex-1 bg-transparent border-b border-surface text-white focus:border-cs-green focus:outline-none px-2 py-1"
                  />
                  <div className="w-20">
                    <label className="text-[10px] text-text-secondary block">Qtd</label>
                    <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green" />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] text-text-secondary block">Diária (R$)</label>
                    <input type="number" min="0" value={item.daily_rate} onChange={(e) => updateItem(item.id, "daily_rate", e.target.value)} className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green" />
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] text-text-secondary block">Dias</label>
                    <input type="number" min="1" value={item.days} onChange={(e) => updateItem(item.id, "days", e.target.value)} className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green" />
                  </div>
                  <div className="w-32 text-right">
                    <label className="text-[10px] text-text-secondary block">Total</label>
                    <span className="font-medium text-white">
                      {formatCurrency((Number(item.quantity) || 0) * (Number(item.daily_rate) || 0) * (Number(item.days) || 0))}
                    </span>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-text-secondary hover:text-red-500 transition-colors mt-4">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg flex justify-end">
          <div className="w-72 space-y-3">
            <div className="flex justify-between text-sm text-text-secondary">
              <span>Subtotal Equipamentos:</span>
              <span>{formatCurrency(totals.equipment)}</span>
            </div>
            <div className="flex justify-between text-sm text-text-secondary">
              <span>Subtotal Equipe:</span>
              <span>{formatCurrency(totals.labor)}</span>
            </div>
            <div className="flex justify-between text-sm text-text-secondary border-b border-surface/50 pb-3">
              <span>Subtotal Logística:</span>
              <span>{formatCurrency(totals.logistics)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white pt-2">
              <span>Valor Total:</span>
              <span className="text-cs-green">{formatCurrency(totals.final)}</span>
            </div>
          </div>
        </div>

        {/* Botão Salvar no Rodapé */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSaveQuote}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-md bg-cs-green py-3 px-8 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar Orçamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <FileText className="text-cs-green" size={20} />
          Gestão de Orçamentos
        </h3>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
        >
          <Plus size={18} /> Novo Orçamento
        </button>
      </div>

      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Proposta / Evento</th>
                <th className="px-6 py-3 font-medium">Cliente</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Valor Total</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando...
                  </td>
                </tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    Nenhum orçamento gerado. Clique em "Novo Orçamento" para começar.
                  </td>
                </tr>
              ) : (
                quotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-surface/50 hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{quote.title}</td>
                    <td className="px-6 py-4">{quote.clients?.company_name}</td>
                    <td className="px-6 py-4">
                      <span className="bg-surface border border-surface/50 px-2 py-1 rounded text-xs">
                        {quote.status === 'draft' ? 'Rascunho' : quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-cs-green">{formatCurrency(quote.final_amount)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/orcamentos/${quote.id}`}
                        className="inline-flex items-center gap-1 text-cs-gold hover:text-white transition-colors text-xs font-medium"
                      >
                        <Printer size={14} /> Gerar PDF
                      </Link>
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