"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Package, Plus, Search, Loader2, Speaker, Lightbulb, MonitorPlay, Box, Zap, Users, Truck, Edit, Trash2, X } from "lucide-react";

export default function InventarioPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Estados do Formulário
  const[editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("audio");
  const [dailyRate, setDailyRate] = useState("");
  const[stockTotal, setStockTotal] = useState("1");

  useEffect(() => {
    fetchEquipment();
  },[]);

  const fetchEquipment = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("equipment")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
      
    if (!error && data) setEquipment(data);
    setLoading(false);
  };

  const handleAddOrUpdateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dailyRate || !stockTotal) return;
    
    setIsSubmitting(true);

    const payload = {
      name, 
      sku: sku || null,
      category,
      daily_rate: Number(dailyRate),
      stock_total: Number(stockTotal)
    };

    let error;

    if (editId) {
      // Atualizar item existente
      const { error: updateError } = await supabase
        .from("equipment")
        .update(payload)
        .eq("id", editId);
      error = updateError;
    } else {
      // Criar novo item
      const { error: insertError } = await supabase
        .from("equipment")
        .insert([payload]);
      error = insertError;
    }

    if (!error) {
      resetForm();
      fetchEquipment();
    } else {
      alert("Erro ao salvar item. Verifique se o SKU já existe. Erro: " + error.message);
    }
    setIsSubmitting(false);
  };

  const handleEdit = (item: any) => {
    setEditId(item.id);
    setName(item.name);
    setSku(item.sku || "");
    setCategory(item.category);
    setDailyRate(item.daily_rate.toString());
    setStockTotal(item.stock_total.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola a tela para o formulário
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este item do acervo?")) return;
    
    const { error } = await supabase.from("equipment").delete().eq("id", id);
    if (!error) {
      fetchEquipment();
    } else {
      alert("Erro ao excluir item: " + error.message);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setName("");
    setSku("");
    setCategory("audio");
    setDailyRate("");
    setStockTotal("1");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'audio': return <Speaker size={16} className="text-blue-400" />;
      case 'lighting': return <Lightbulb size={16} className="text-yellow-400" />;
      case 'led': return <MonitorPlay size={16} className="text-purple-400" />;
      case 'structure': return <Box size={16} className="text-gray-400" />;
      case 'energy': return <Zap size={16} className="text-orange-400" />;
      case 'labor': return <Users size={16} className="text-cs-gold" />;
      case 'logistics': return <Truck size={16} className="text-blue-500" />;
      default: return <Package size={16} className="text-cs-green" />;
    }
  };

  const getCategoryName = (cat: string) => {
    const names: Record<string, string> = {
      audio: "Áudio", lighting: "Iluminação", led: "Painel de LED", 
      structure: "Estrutura / Box Truss", energy: "Energia / Cabos", 
      labor: "Equipe Técnica / Staff", logistics: "Logística / Frete", general: "Geral"
    };
    return names[cat] || cat;
  };

  const filteredEquipment = equipment.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Formulário de Cadastro / Edição */}
      <div className="bg-surface border border-surface/50 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            {editId ? <Edit className="text-cs-gold" size={20} /> : <Plus className="text-cs-green" size={20} />}
            {editId ? "Editar Item do Acervo" : "Cadastrar Item no Acervo (LOC FIX)"}
          </h3>
          {editId && (
            <button onClick={resetForm} className="text-sm text-text-secondary hover:text-white flex items-center gap-1 transition-colors">
              <X size={16} /> Cancelar Edição
            </button>
          )}
        </div>
        
        <form onSubmit={handleAddOrUpdateEquipment} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-text-secondary mb-1">Nome do Item / Cargo *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                placeholder="Ex: Caixa Ativa QSC ou Técnico de P.A."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Código SKU (Opcional)</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors uppercase"
                placeholder="Ex: AUD-QSC-01"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Categoria *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
              >
                <option value="audio">Áudio</option>
                <option value="lighting">Iluminação</option>
                <option value="led">Painel de LED / Vídeo</option>
                <option value="structure">Estrutura / Box Truss</option>
                <option value="energy">Energia / Cabos</option>
                <option value="labor">Equipe Técnica / Staff</option>
                <option value="logistics">Logística / Frete</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Valor da Diária (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                placeholder="150.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Quantidade Disponível *</label>
              <input
                type="number"
                min="1"
                required
                value={stockTotal}
                onChange={(e) => setStockTotal(e.target.value)}
                className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-surface/50">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 rounded-md py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50 ${
                editId ? 'bg-cs-gold focus:ring-cs-gold' : 'bg-cs-green focus:ring-cs-green'
              }`}
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editId ? "Atualizar Item" : "Adicionar ao Acervo")}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Equipamentos */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-surface/50 flex justify-between items-center bg-surface">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Package className="text-cs-gold" size={20} />
            Acervo LOC FIX
          </h3>
          <div className="relative hidden sm:block w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input
              type="text"
              placeholder="Buscar item ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Item / Cargo</th>
                <th className="px-6 py-3 font-medium">Categoria</th>
                <th className="px-6 py-3 font-medium text-center">Estoque Total</th>
                <th className="px-6 py-3 font-medium text-right">Diária Base</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando acervo...
                  </td>
                </tr>
              ) : filteredEquipment.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                    Nenhum item encontrado.
                  </td>
                </tr>
              ) : (
                filteredEquipment.map((item) => (
                  <tr key={item.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{item.name}</p>
                      {item.sku && <p className="text-[10px] text-text-secondary mt-1 font-mono">{item.sku}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(item.category)}
                        <span>{getCategoryName(item.category)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-surface border border-surface/50 px-2.5 py-1 rounded-full text-white font-medium min-w-[2.5rem]">
                        {item.stock_total}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-cs-green">
                      {formatCurrency(item.daily_rate)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => handleEdit(item)}
                          className="text-text-secondary hover:text-cs-gold transition-colors"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="text-text-secondary hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
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