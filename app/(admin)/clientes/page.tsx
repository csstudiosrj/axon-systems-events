"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Building2, Plus, Search, Loader2 } from "lucide-react";

export default function ClientesPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados do Formulário
  const [companyName, setCompanyName] = useState("");
  const [document, setDocument] = useState("");

  // Busca os clientes no banco de dados ao carregar a página
  useEffect(() => {
    fetchClients();
  },[]);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (!error && data) {
      setClients(data);
    }
    setLoading(false);
  };

  // Função para salvar um novo cliente
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !document) return;
    
    setIsSubmitting(true);
    const { error } = await supabase
      .from("clients")
      .insert([{ company_name: companyName, document: document }]);

    if (!error) {
      setCompanyName("");
      setDocument("");
      fetchClients(); // Recarrega a tabela automaticamente
    } else {
      alert("Erro ao cadastrar cliente: " + error.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8">
      {/* Formulário de Cadastro */}
      <div className="bg-surface border border-surface/50 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Plus className="text-cs-green" size={20} />
          Novo Cliente
        </h3>
        <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Nome da Empresa / Evento
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white placeholder-text-secondary focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green sm:text-sm transition-colors"
              placeholder="Ex: CS com Eventos"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              CNPJ / CPF
            </label>
            <input
              type="text"
              required
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white placeholder-text-secondary focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green sm:text-sm transition-colors"
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full justify-center items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-cs-green transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Cadastrar Cliente"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Clientes */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-surface/50 flex justify-between items-center bg-surface">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Building2 className="text-cs-gold" size={20} />
            Clientes Cadastrados
          </h3>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="pl-9 pr-4 py-1.5 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Empresa</th>
                <th className="px-6 py-3 font-medium">Documento</th>
                <th className="px-6 py-3 font-medium">Data de Cadastro</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    Carregando banco de dados...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    Nenhum cliente cadastrado. Adicione o primeiro acima.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-b border-surface/50 hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{client.company_name}</td>
                    <td className="px-6 py-4">{client.document}</td>
                    <td className="px-6 py-4">
                      {new Date(client.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-cs-gold hover:text-white transition-colors text-xs font-medium">
                        Editar
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
  );
}