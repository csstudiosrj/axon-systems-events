"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { FileText, Plus, Loader2, ArrowLeft, Trash2, Save, Printer, Edit } from "lucide-react";
import Link from "next/link";

export default function OrcamentosPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [quotes, setQuotes] = useState<any[]>([]);
  const[clients, setClients] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const[isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Formulário
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const[clientId, setClientId] = useState("");
  const [items, setItems] = useState<any[]>([]);

  // Referência para o final da lista (usado para o auto-scroll)
  const itemsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === "list") {
      fetchQuotes();
      setEditQuoteId(null);
      setTitle("");
      setClientId("");
      setItems([]);
    }
    if (view === "create") {
      fetchClients();
      fetchInventory();
    }
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

  const fetchInventory = async () => {
    const { data } = await supabase.from("equipment").select("*").order("name");
    if (data) setInventory(data);
  };

  const handleEditQuote = async (quote: any) => {
    setLoading(true);
    setEditQuoteId(quote.id);
    setTitle(quote.title);
    setClientId(quote.client_id);
    
    const { data } = await supabase.from("quote_items").select("*").eq("quote_id", quote.id);
    if (data) {
      const formattedItems = data.map(item => ({
        id: item.id,
        category: item.category,
        description: item.description,
        quantity: item.quantity,
        daily_rate: item.daily_rate,
        days: item.days
      }));
      setItems(formattedItems);
    }
    
    setView("create");
    setLoading(false);
  };

  const addItem = (category: "equipment" | "labor" | "logistics") => {
    setItems([...items, { id: Date.now().toString(), category, description: "", quantity: 1, daily_rate: 0, days: 1 }]);
    
    // Aguarda o React renderizar o novo item e faz o scroll suave
    setTimeout(() => {
      itemsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: string, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDescriptionChange = (id: string, value: string) => {
    const foundItem = inventory.find(eq => eq.name.toLowerCase() === value.toLowerCase());
    if (foundItem) {
      setItems(items.map(item => item.id === id ? { 
        ...item, 
        description: value, 
        daily_rate: foundItem.daily_rate 
      } : item));
    } else {
      updateItem(id, "description", value);
    }
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

    try {
      let currentQuoteId = editQuoteId;

      if (editQuoteId) {
        await supabase.from("quotes").update({
          title,
          client_id: clientId,
          total_equipment_cost: totals.equipment,
          total_labor_cost: totals.labor,
          total_logistics_cost: totals.logistics,
          final_amount: totals.final
        }).eq("id", editQuoteId);

        await supabase.from("quote_items").delete().eq("quote_id", editQuoteId);
      } else {
        const { data: quoteData, error: quoteError } = await supabase.from("quotes").insert([{
          title,
          client_id: clientId,
          total_equipment_cost: totals.equipment,
          total_labor_cost: totals.labor,
          total_logistics_cost: totals.logistics,
          final_amount: totals.final,
          status: "draft"
        }]).select().single();

        if (quoteError) throw quoteError;
        currentQuoteId = quoteData.id;
      }

      const itemsToInsert = items.map(item => ({
        quote_id: currentQuoteId,
        category: item.category,
        description: item.description,
        quantity: Number(item.quantity),
        daily_rate: Number(item.daily_rate),
        days: Number(item.days),
        total_price: Number(item.quantity) * Number(item.daily_rate) * Number(item.days)
      }));

      const { error: itemsError } = await supabase.from("quote_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      setView("list");
    } catch (error: any) {
      alert("Erro ao salvar orçamento: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <datalist id="inventory-equipment">
          {inventory.filter(eq => !['logistics', 'labor'].includes(eq.category)).map(eq => (
            <option key={eq.id} value={eq.name} />
          ))}
        </datalist>
        <datalist id="inventory-labor">
          {inventory.filter(eq => eq.category === 'labor').map(eq => (
            <option key={eq.id} value={eq.name} />
          ))}
        </datalist>
        <datalist id="inventory-logistics">
          {inventory.filter(eq => eq.category === 'logistics').map(eq => (
            <option key={eq.id} value={eq.name} />
          ))}
        </datalist>

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
            {editQuoteId ? "Atualizar Orçamento" : "Salvar Orçamento"}
          </button>
        </div>

        <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
          <h3 className="text-lg font-medium text-white border-b border-surface/50 pb-2">
            {editQuoteId ? "Editando Evento" : "Dados do Evento"}
          </h3>
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
                    list={`inventory-${item.category}`}
                    placeholder="Buscar no acervo ou digitar..."
                    value={item.description}
                    onChange={(e) => handleDescriptionChange(item.id, e.target.value)}
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
            {/* Âncora invisível para o auto-scroll */}
            <div ref={itemsEndRef} />
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

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSaveQuote}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-md bg-cs-green py-3 px-8 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {editQuoteId ? "Atualizar Orçamento" : "Salvar Orçamento"}
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
                      <div className="flex items-center justify-end gap-4">
                        <button 
                          onClick={() => handleEditQuote(quote)}
                          className="inline-flex items-center gap-1 text-text-secondary hover:text-white transition-colors text-xs font-medium"
                        >
                          <Edit size={14} /> Editar
                        </button>
                        <Link 
                          href={`/orcamentos/${quote.id}`}
                          className="inline-flex items-center gap-1 text-cs-gold hover:text-white transition-colors text-xs font-medium"
                        >
                          <Printer size={14} /> Gerar PDF
                        </Link>
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