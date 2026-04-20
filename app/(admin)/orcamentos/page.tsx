"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { FileText, Plus, Loader2, ArrowLeft, Trash2, Save, Printer, Edit, Calendar, User } from "lucide-react";
import Link from "next/link";

export default function OrcamentosPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const[inventory, setInventory] = useState<any[]>([]);
  const [salesTeam, setSalesTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const[isSubmitting, setIsSubmitting] = useState(false);

  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  
  const [setupStart, setSetupStart] = useState("");
  const [setupEnd, setSetupEnd] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const[teardownStart, setTeardownStart] = useState("");
  const [teardownEnd, setTeardownEnd] = useState("");

  const [items, setItems] = useState<any[]>([]);
  const itemsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === "list") {
      fetchQuotes();
      resetForm();
    }
    if (view === "create") {
      fetchClients();
      fetchInventory();
      fetchSalesTeam();
    }
  }, [view]);

  const resetForm = () => {
    setEditQuoteId(null);
    setTitle("");
    setClientId("");
    setSalespersonId("");
    setSetupStart(""); setSetupEnd("");
    setEventStart(""); setEventEnd("");
    setTeardownStart(""); setTeardownEnd("");
    setItems([]);
  };

  const fetchQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select("*, clients(company_name), salesperson:profiles!quotes_salesperson_id_fkey(full_name)")
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

  const fetchSalesTeam = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["super_admin", "admin", "commercial"]);
    if (data) setSalesTeam(data);
  };

  const handleEditQuote = async (quote: any) => {
    setLoading(true);
    setEditQuoteId(quote.id);
    setTitle(quote.title);
    setClientId(quote.client_id || "");
    setSalespersonId(quote.salesperson_id || "");
    
    const formatDate = (isoString: string) => {
      if (!isoString) return "";
      const d = new Date(isoString);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    setSetupStart(formatDate(quote.setup_start_date));
    setSetupEnd(formatDate(quote.setup_end_date));
    setEventStart(formatDate(quote.event_start_date));
    setEventEnd(formatDate(quote.event_end_date));
    setTeardownStart(formatDate(quote.teardown_start_date));
    setTeardownEnd(formatDate(quote.teardown_end_date));
    
    const { data } = await supabase.from("quote_items").select("*").eq("quote_id", quote.id);
    if (data) {
      setItems(data.map(item => ({
        id: item.id, category: item.category, description: item.description,
        quantity: item.quantity, daily_rate: item.daily_rate, days: item.days
      })));
    }
    
    setView("create");
    setLoading(false);
  };

  const updateQuoteStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("quotes").update({ status: newStatus }).eq("id", id);
    if (!error) fetchQuotes();
  };

  const addItem = (category: "equipment" | "labor" | "logistics") => {
    setItems([...items, { id: Date.now().toString(), category, description: "", quantity: 1, daily_rate: 0, days: 1 }]);
    setTimeout(() => itemsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const removeItem = (id: string) => setItems(items.filter(item => item.id !== id));

  const updateItem = (id: string, field: string, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDescriptionChange = (id: string, value: string) => {
    const foundItem = inventory.find(eq => eq.name.toLowerCase() === value.toLowerCase());
    if (foundItem) {
      setItems(items.map(item => item.id === id ? { ...item, description: value, daily_rate: foundItem.daily_rate } : item));
    } else {
      updateItem(id, "description", value);
    }
  };

  const calculateTotals = () => {
    let equipment = 0, labor = 0, logistics = 0;
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
    if (!title || !clientId || !salespersonId || items.length === 0) {
      alert("Preencha o título, cliente, vendedor responsável e adicione pelo menos um item.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Validação de datas movida para DENTRO do try/catch para evitar travamento
      const validateDate = (dateStr: string) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) throw new Error(`Data inválida inserida no cronograma.`);
        return d.toISOString();
      };

      const payload = {
        title,
        client_id: clientId,
        salesperson_id: salespersonId,
        setup_start_date: validateDate(setupStart),
        setup_end_date: validateDate(setupEnd),
        event_start_date: validateDate(eventStart),
        event_end_date: validateDate(eventEnd),
        teardown_start_date: validateDate(teardownStart),
        teardown_end_date: validateDate(teardownEnd),
        total_equipment_cost: totals.equipment,
        total_labor_cost: totals.labor,
        total_logistics_cost: totals.logistics,
        final_amount: totals.final
      };

      let currentQuoteId = editQuoteId;

      if (editQuoteId) {
        await supabase.from("quotes").update(payload).eq("id", editQuoteId);
        await supabase.from("quote_items").delete().eq("quote_id", editQuoteId);
      } else {
        const { data: quoteData, error: quoteError } = await supabase.from("quotes").insert([{ ...payload, status: "draft" }]).select().single();
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

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (view === "create") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <datalist id="inventory-equipment">
          {inventory.filter(eq => !['logistics', 'labor'].includes(eq.category)).map(eq => <option key={eq.id} value={eq.name} />)}
        </datalist>
        <datalist id="inventory-labor">
          {inventory.filter(eq => eq.category === 'labor').map(eq => <option key={eq.id} value={eq.name} />)}
        </datalist>
        <datalist id="inventory-logistics">
          {inventory.filter(eq => eq.category === 'logistics').map(eq => <option key={eq.id} value={eq.name} />)}
        </datalist>

        <div className="flex items-center justify-between">
          <button onClick={() => setView("list")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} /> Voltar para lista
          </button>
          <button onClick={handleSaveQuote} disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {editQuoteId ? "Atualizar Orçamento" : "Salvar Orçamento"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
              <h3 className="text-md font-bold text-white border-b border-surface/50 pb-2 flex items-center gap-2">
                <FileText size={18} className="text-cs-green" /> Dados Gerais
              </h3>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Nome do Evento / Proposta *</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Cliente *</label>
                <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm">
                  <option value="">Selecione...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-2"><User size={14}/> Vendedor Responsável *</label>
                <select required value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm">
                  <option value="">Selecione...</option>
                  {salesTeam.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-surface border border-surface/50 p-6 rounded-lg space-y-4">
              <h3 className="text-md font-bold text-white border-b border-surface/50 pb-2 flex items-center gap-2">
                <Calendar size={18} className="text-cs-gold" /> Cronograma
              </h3>
              
              <div className="space-y-3 border-b border-surface/50 pb-4">
                <p className="text-xs font-bold text-cs-gold uppercase tracking-wider">1. Montagem (Load-in)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-text-secondary mb-1">Início</label>
                    <input type="datetime-local" max="2099-12-31T23:59" value={setupStart} onChange={(e) => { if (e.target.value.length <= 16) setSetupStart(e.target.value); }} className="block w-full rounded border border-surface bg-background px-2 py-1.5 text-white focus:border-cs-green focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-secondary mb-1">Término</label>
                    <input type="datetime-local" max="2099-12-31T23:59" value={setupEnd} onChange={(e) => { if (e.target.value.length <= 16) setSetupEnd(e.target.value); }} className="block w-full rounded border border-surface bg-background px-2 py-1.5 text-white focus:border-cs-green focus:outline-none text-xs" />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-b border-surface/50 pb-4">
                <p className="text-xs font-bold text-cs-green uppercase tracking-wider">2. Evento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-text-secondary mb-1">Início</label>
                    <input type="datetime-local" max="2099-12-31T23:59" value={eventStart} onChange={(e) => { if (e.target.value.length <= 16) setEventStart(e.target.value); }} className="block w-full rounded border border-surface bg-background px-2 py-1.5 text-white focus:border-cs-green focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-secondary mb-1">Término</label>
                    <input type="datetime-local" max="2099-12-31T23:59" value={eventEnd} onChange={(e) => { if (e.target.value.length <= 16) setEventEnd(e.target.value); }} className="block w-full rounded border border-surface bg-background px-2 py-1.5 text-white focus:border-cs-green focus:outline-none text-xs" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">3. Desmontagem (Load-out)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-text-secondary mb-1">Início</label>
                    <input type="datetime-local" max="2099-12-31T23:59" value={teardownStart} onChange={(e) => { if (e.target.value.length <= 16) setTeardownStart(e.target.value); }} className="block w-full rounded border border-surface bg-background px-2 py-1.5 text-white focus:border-cs-green focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-secondary mb-1">Término</label>
                    <input type="datetime-local" max="2099-12-31T23:59" value={teardownEnd} onChange={(e) => { if (e.target.value.length <= 16) setTeardownEnd(e.target.value); }} className="block w-full rounded border border-surface bg-background px-2 py-1.5 text-white focus:border-cs-green focus:outline-none text-xs" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
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
                  <p className="text-center text-text-secondary py-8 text-sm">Nenhum item adicionado. Use os botões acima para começar.</p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 bg-background p-3 rounded-md border border-surface/50">
                      <div className="w-20 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                          item.category === 'equipment' ? 'bg-cs-green/10 text-cs-green' : 
                          item.category === 'labor' ? 'bg-cs-gold/10 text-cs-gold' : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          {item.category === 'equipment' ? 'Equip' : item.category === 'labor' ? 'Equipe' : 'Log'}
                        </span>
                      </div>
                      
                      <input
                        type="text"
                        list={`inventory-${item.category}`}
                        placeholder="Buscar ou digitar..."
                        value={item.description}
                        onChange={(e) => handleDescriptionChange(item.id, e.target.value)}
                        className="flex-1 bg-transparent border-b border-surface text-white focus:border-cs-green focus:outline-none px-2 py-1 text-sm"
                      />
                      
                      <div className="w-16 shrink-0">
                        <label className="text-[10px] text-text-secondary block">Qtd</label>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green text-sm text-center" />
                      </div>
                      <div className="w-24 shrink-0">
                        <label className="text-[10px] text-text-secondary block">Diária (R$)</label>
                        <input type="number" min="0" value={item.daily_rate} onChange={(e) => updateItem(item.id, "daily_rate", e.target.value)} className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green text-sm text-right" />
                      </div>
                      <div className="w-16 shrink-0">
                        <label className="text-[10px] text-text-secondary block">Dias</label>
                        <input type="number" min="1" value={item.days} onChange={(e) => updateItem(item.id, "days", e.target.value)} className="w-full bg-surface border border-surface/50 rounded px-2 py-1 text-white focus:outline-none focus:border-cs-green text-sm text-center" />
                      </div>
                      <div className="w-28 text-right shrink-0">
                        <label className="text-[10px] text-text-secondary block">Total</label>
                        <span className="font-bold text-white text-sm">
                          {formatCurrency((Number(item.quantity) || 0) * (Number(item.daily_rate) || 0) * (Number(item.days) || 0))}
                        </span>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-text-secondary hover:text-red-500 transition-colors mt-4 shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
                <div ref={itemsEndRef} />
              </div>
            </div>

            <div className="bg-surface border border-surface/50 p-6 rounded-lg flex justify-end">
              <div className="w-72 space-y-3">
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Equipamentos:</span>
                  <span>{formatCurrency(totals.equipment)}</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Equipe:</span>
                  <span>{formatCurrency(totals.labor)}</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary border-b border-surface/50 pb-3">
                  <span>Logística:</span>
                  <span>{formatCurrency(totals.logistics)}</span>
                </div>
                <div className="flex justify-between text-xl font-extrabold text-white pt-2">
                  <span>Total:</span>
                  <span className="text-cs-green">{formatCurrency(totals.final)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <FileText className="text-cs-green" size={20} />
            Gestão de Orçamentos
          </h3>
          <p className="text-xs text-text-secondary mt-1">Crie propostas, gerencie status e comissões.</p>
        </div>
        <button onClick={() => setView("create")} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all">
          <Plus size={18} /> Novo Orçamento
        </button>
      </div>

      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Proposta / Evento</th>
                <th className="px-6 py-3 font-medium">Vendedor Responsável</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Valor Total</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center"><Loader2 className="animate-spin mx-auto mb-2 text-cs-green" size={24} /></td></tr>
              ) : quotes.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-text-secondary">Nenhum orçamento gerado.</td></tr>
              ) : (
                quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-white">{quote.title}</p>
                      <p className="text-xs mt-1">{quote.clients?.company_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      {quote.salesperson ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-white"><User size={14} className="text-cs-gold"/> {quote.salesperson.full_name}</span>
                      ) : (
                        <span className="text-xs text-text-secondary">Não atribuído</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={quote.status}
                        onChange={(e) => updateQuoteStatus(quote.id, e.target.value)}
                        className={`text-xs rounded-full px-2.5 py-1 font-bold uppercase tracking-wider border focus:outline-none cursor-pointer ${
                          quote.status === 'approved' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' :
                          quote.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          quote.status === 'postponed' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                          quote.status === 'pending_approval' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-cs-gold/10 text-cs-gold border-cs-gold/20'
                        }`}
                      >
                        <option value="draft">Rascunho</option>
                        <option value="pending_approval">Aguardando</option>
                        <option value="approved">Aprovado</option>
                        <option value="postponed">Adiado</option>
                        <option value="rejected">Recusado</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 font-bold text-cs-green">{formatCurrency(quote.final_amount)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <button onClick={() => handleEditQuote(quote)} className="inline-flex items-center gap-1 text-text-secondary hover:text-white transition-colors text-xs font-medium">
                          <Edit size={14} /> Editar
                        </button>
                        <Link href={`/orcamentos/${quote.id}`} className="inline-flex items-center gap-1 text-cs-gold hover:text-white transition-colors text-xs font-medium">
                          <Printer size={14} /> PDF
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