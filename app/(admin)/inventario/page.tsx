"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Package, Plus, Search, Loader2, Edit, Trash2, X, 
  ChevronDown, ChevronUp, Check, AlertCircle, 
  Hash, DollarSign, Layers, Save, AlertTriangle, 
  ArrowRight, BarChart3
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS ---
interface Equipment {
  id: string;
  name: string;
  sku: string;
  category: string;
  daily_rate: number;
  stock_total: number;
  maintenance_notes: string | null;
  created_at: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "warning" | "info";
}

export default function InventarioPage() {
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels || {};

  // Labels Dinâmicas ARXUM
  const eqSingular = labels.entity_equipment_singular || "Item";
  const eqPlural = labels.entity_equipment_plural || "Acervo";
  const inventoryLabel = labels.menu_inventory || "Inventário";

  // Estados de Dados
  const [inventory, setInventory] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Estados do Formulário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setForm] = useState({
    name: "", sku: "", category: "", daily_rate: "", stock_total: "1", maintenance_notes: ""
  });

  // UI
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("equipment")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
      
    if (!error && data) setInventory(data as Equipment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // --- LÓGICA DE SKU ---
  const generateSKU = () => {
    const prefix = companyProfile?.company_name?.substring(0, 3).toUpperCase() || "ARX";
    const random = Math.floor(1000 + Math.random() * 9000);
    const date = new Date().getTime().toString().slice(-4);
    return `${prefix}-${random}${date}`;
  };

  // --- PERSISTÊNCIA ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.daily_rate) {
      showToast("Preencha os campos obrigatórios.", "warning");
      return;
    }

    setIsSubmitting(true);

    // Garantir SKU
    const finalSku = formData.sku.trim() || generateSKU();

    try {
      // Validar SKU Único
      const { data: existing } = await supabase
        .from("equipment")
        .select("id")
        .eq("sku", finalSku)
        .maybeSingle();

      if (existing && existing.id !== editId) {
        showToast(`O SKU ${finalSku} já está em uso.`, "error");
        setIsSubmitting(false);
        return;
      }

      const payload = {
        name: formData.name,
        sku: finalSku,
        category: formData.category || "Geral",
        daily_rate: Number(formData.daily_rate),
        stock_total: Number(formData.stock_total),
        maintenance_notes: formData.maintenance_notes
      };

      const { error } = editId 
        ? await supabase.from("equipment").update(payload).eq("id", editId)
        : await supabase.from("equipment").insert([payload]);

      if (error) throw error;

      showToast(`${eqSingular} salvo com sucesso!`, "success");
      setIsModalOpen(false);
      resetForm();
      fetchInventory();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("equipment").delete().eq("id", id);
    if (!error) {
      showToast(`${eqSingular} removido do acervo.`, "success");
      setConfirmDelete(null);
      fetchInventory();
    } else {
      showToast("Erro ao excluir: item pode estar vinculado a um orçamento.", "error");
    }
  };

  const resetForm = () => {
    setEditId(null);
    setForm({ name: "", sku: "", category: "", daily_rate: "", stock_total: "1", maintenance_notes: "" });
  };

  const openEdit = (item: Equipment) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      sku: item.sku,
      category: item.category,
      daily_rate: item.daily_rate.toString(),
      stock_total: item.stock_total.toString(),
      maintenance_notes: item.maintenance_notes || ""
    });
    setIsModalOpen(true);
  };

  // --- AGRUPAMENTO ---
  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedInventory = useMemo(() => {
    return filteredInventory.reduce((acc, item) => {
      const cat = item.category || "Geral";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, Equipment[]>);
  }, [filteredInventory]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6 relative pb-12">
      
      {/* TOASTS ARXUM (Fundo Sólido) */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border animate-in fade-in slide-in-from-bottom-4 bg-surface border-white/10 ${
          toast.type === 'success' ? 'text-cs-green' : 
          toast.type === 'error' ? 'text-red-500' : 'text-cs-gold'
        }`}>
          {toast.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-black uppercase tracking-widest">{toast.message}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg shadow-lg">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <Package className="text-cs-green" size={24} />
            {inventoryLabel}
          </h3>
          <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-[0.2em] font-black">Controle de Ativos ARXUM Cloud</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input 
              type="text" 
              placeholder={`Buscar por nome, SKU ou categoria...`} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2.5 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none transition-all" 
            />
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-cs-green text-white px-6 py-2.5 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg"
          >
            <Plus size={18} /> Novo {eqSingular}
          </button>
        </div>
      </div>

      {/* LISTAGEM AGRUPADA */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin text-cs-green" size={48} />
          <span className="text-xs font-black uppercase tracking-[0.3em] text-cs-green animate-pulse">Sincronizando Acervo...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedInventory).map(([category, items]) => {
            const isExpanded = expandedCategories.includes(category);
            const totalValue = items.reduce((sum, i) => sum + (i.daily_rate * i.stock_total), 0);
            
            return (
              <div key={category} className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-xl">
                <button 
                  onClick={() => toggleCategory(category)}
                  className="w-full p-4 flex justify-between items-center bg-background/20 hover:bg-background/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-cs-green/10 flex items-center justify-center border border-cs-green/20">
                      <Layers className="text-cs-green" size={20} />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">{category}</h4>
                      <p className="text-[10px] text-text-secondary uppercase font-bold">{items.length} {eqPlural} cadastrados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden md:block text-right">
                      <p className="text-[9px] text-text-secondary uppercase font-black">Potencial de Diária</p>
                      <p className="text-xs font-bold text-cs-gold">{formatCurrency(totalValue)}</p>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-text-secondary" /> : <ChevronDown size={20} className="text-text-secondary" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-surface/50 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-background/50 text-[10px] uppercase tracking-widest text-text-secondary font-black">
                        <tr>
                          <th className="px-6 py-4">Identificação / SKU</th>
                          <th className="px-6 py-4 text-center">Estoque</th>
                          <th className="px-6 py-4 text-right">Valor Diária</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface/50">
                        {items.map((item) => (
                          <tr key={item.id} className="hover:bg-background/30 transition-colors group">
                            <td className="px-6 py-4">
                              <p className="font-bold text-white group-hover:text-cs-green transition-colors">{item.name}</p>
                              <p className="text-[10px] font-mono text-text-secondary uppercase">{item.sku}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-background border border-surface/50 px-3 py-1 rounded-full text-xs font-black text-white">
                                {item.stock_total}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-cs-green">
                              {formatCurrency(item.daily_rate)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => openEdit(item)} className="p-2 hover:bg-cs-gold/10 text-text-secondary hover:text-cs-gold rounded-md transition-all">
                                  <Edit size={16} />
                                </button>
                                <button onClick={() => setConfirmDelete(item.id)} className="p-2 hover:bg-red-500/10 text-text-secondary hover:text-red-500 rounded-md transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FORMULÁRIO (Fundo Sólido) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-surface/50 flex justify-between items-center bg-background/50">
              <div className="flex items-center gap-3">
                <Package className="text-cs-green" size={24} />
                <h2 className="text-lg font-black text-white uppercase tracking-tighter">
                  {editId ? `Editar ${eqSingular}` : `Novo ${eqSingular} no Acervo`}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Nome do Item / Descrição *</label>
                  <input 
                    type="text" required value={formData.name} 
                    onChange={e => setForm({...formData, name: e.target.value})}
                    className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none"
                    placeholder="Ex: Projetor Laser 10k Lumens"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Código SKU (Auto-gerável)</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                    <input 
                      type="text" value={formData.sku} 
                      onChange={e => setForm({...formData, sku: e.target.value.toUpperCase()})}
                      className="w-full bg-background border border-surface rounded-md pl-10 pr-4 py-3 text-white text-sm focus:border-cs-green outline-none font-mono"
                      placeholder="DEIXE EM BRANCO PARA AUTO"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Categoria / Grupo</label>
                  <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                    <input 
                      type="text" value={formData.category} 
                      onChange={e => setForm({...formData, category: e.target.value})}
                      className="w-full bg-background border border-surface rounded-md pl-10 pr-4 py-3 text-white text-sm focus:border-cs-green outline-none"
                      placeholder="Ex: Vídeo, Áudio, Insumos..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Valor da Diária (R$) *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-green" size={14} />
                    <input 
                      type="number" step="0.01" required value={formData.daily_rate} 
                      onChange={e => setForm({...formData, daily_rate: e.target.value})}
                      className="w-full bg-background border border-surface rounded-md pl-10 pr-4 py-3 text-white text-sm focus:border-cs-green outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Quantidade em Estoque *</label>
                  <input 
                    type="number" required value={formData.stock_total} 
                    onChange={e => setForm({...formData, stock_total: e.target.value})}
                    className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Notas de Manutenção / Observações</label>
                  <textarea 
                    rows={3} value={formData.maintenance_notes} 
                    onChange={e => setForm({...formData, maintenance_notes: e.target.value})}
                    className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none resize-none"
                    placeholder="Detalhes sobre estado de conservação..."
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-surface/50 flex justify-end">
                <button 
                  type="submit" disabled={isSubmitting}
                  className="flex items-center gap-3 bg-cs-green text-white px-10 py-3.5 rounded-md font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editId ? "Confirmar Alterações" : "Gravar no Acervo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (Fundo Sólido) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 p-8 rounded-xl shadow-2xl max-w-sm w-full text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Excluir {eqSingular}?</h3>
            <p className="text-sm text-text-secondary mb-8">Esta ação é irreversível e removerá o item de todos os relatórios futuros.</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 border border-surface rounded-md text-xs font-black uppercase text-text-secondary hover:text-white transition-all">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-3 bg-red-600 text-white rounded-md text-xs font-black uppercase shadow-lg hover:bg-red-500 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}