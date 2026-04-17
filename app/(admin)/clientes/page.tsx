"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Building2, Plus, Search, Loader2, User, Mail, Phone, MapPin } from "lucide-react";

export default function ClientesPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados do Formulário
  const [companyName, setCompanyName] = useState("");
  const[document, setDocument] = useState("");
  const [contactName, setContactName] = useState("");
  const[email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const[address, setAddress] = useState("");

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

  // Funções de Máscara (Formatação Automática)
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    if (value.length > 14) value = value.slice(0, 14); // Limita a 14 dígitos

    if (value.length <= 11) {
      // Máscara de CPF
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // Máscara de CNPJ
      value = value.replace(/^(\d{2})(\d)/, "$1.$2");
      value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
      value = value.replace(/(\d{4})(\d)/, "$1-$2");
    }
    setDocument(value);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);

    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    setPhone(value);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !document) return;
    
    setIsSubmitting(true);
    const { error } = await supabase
      .from("clients")
      .insert([{ 
        company_name: companyName, 
        document: document,
        contact_name: contactName,
        email: email,
        phone: phone,
        address: address
      }]);

    if (!error) {
      // Limpa o formulário após o sucesso
      setCompanyName("");
      setDocument("");
      setContactName("");
      setEmail("");
      setPhone("");
      setAddress("");
      fetchClients();
    } else {
      alert("Erro ao cadastrar cliente: " + error.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8">
      {/* Formulário de Cadastro Completo */}
      <div className="bg-surface border border-surface/50 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
          <Plus className="text-cs-green" size={20} />
          Cadastrar Novo Cliente
        </h3>
        
        <form onSubmit={handleAddClient} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna 1 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                  <Building2 size={14} /> Nome da Empresa / Evento *
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                  placeholder="Ex: CS com Eventos"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                  <User size={14} /> Nome do Contato
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                  <MapPin size={14} /> Endereço Completo
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                />
              </div>
            </div>

            {/* Coluna 2 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  CNPJ / CPF *
                </label>
                <input
                  type="text"
                  required
                  value={document}
                  onChange={handleDocumentChange}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                  <Mail size={14} /> E-mail Corporativo
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                  placeholder="contato@empresa.com.br"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                  <Phone size={14} /> Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-surface/50">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-cs-green transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Salvar Cliente"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Clientes Atualizada */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-surface/50 flex justify-between items-center bg-surface">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Building2 className="text-cs-gold" size={20} />
            Diretório de Clientes
          </h3>
          <div className="relative hidden sm:block w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="w-full pl-9 pr-4 py-1.5 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-6 py-3 font-medium">Empresa / Contato</th>
                <th className="px-6 py-3 font-medium">Documento</th>
                <th className="px-6 py-3 font-medium">Contato</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    Carregando diretório...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-b border-surface/50 hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{client.company_name}</p>
                      <p className="text-xs mt-1">{client.contact_name || 'Sem contato definido'}</p>
                    </td>
                    <td className="px-6 py-4">{client.document}</td>
                    <td className="px-6 py-4">
                      <p>{client.email || '-'}</p>
                      <p className="text-xs mt-1">{client.phone || '-'}</p>
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