"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Building2, Plus, Search, Loader2, User, Mail, 
  Phone, MapPin, X, Check, AlertCircle, Edit2, Trash2, 
  Hash, Globe, Navigation
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface Client {
  id: string;
  company_name: string;
  document: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

interface IbgeState {
  id: number;
  nome: string;
  sigla: string;
}

interface IbgeCity {
  id: number;
  nome: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

export default function ClientesPage() {
  const { systemPreferences } = useSettings();
  
  // --- LABELS DINÂMICAS (ARXUM ENGINE) ---
  const labels = systemPreferences?.custom_labels || {};
  const clientSingular = labels.entity_client_singular || "Cliente";
  const clientPlural = labels.entity_client_plural || "Clientes";

  // Estados de Dados
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  
  // Estados do Formulário e Edição
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [document, setDocument] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  // Estados de Endereço Estruturado
  const [zipcode, setZipcode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  
  // Estados de APIs Geográficas
  const [states, setStates] = useState<IbgeState[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // --- BUSCA DE DADOS ---
  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (!error && data) setClients(data as Client[]);
    setLoading(false);
  }, []);

  const fetchStates = useCallback(async () => {
    try {
      const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados");
      const data = await res.json();
      setStates(data.sort((a: IbgeState, b: IbgeState) => a.nome.localeCompare(b.nome)));
    } catch (err) {
      console.error("Erro ao buscar estados IBGE");
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchStates();
  }, [fetchClients, fetchStates]);

  // Busca cidades quando o estado muda
  useEffect(() => {
    if (!state) {
      setCities([]);
      return;
    }
    const loadCities = async () => {
      setLoadingCities(true);
      try {
        const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`);
        const data = await res.json();
        setCities(data);
      } catch (err) {
        showToast("Erro ao carregar cidades.", "error");
      } finally {
        setLoadingCities(false);
      }
    };
    loadCities();
  }, [state, showToast]);

  // --- MÁSCARAS E VALIDAÇÕES ---
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 14) value = value.slice(0, 14);
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      value = value.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    setDocument(value);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d)(\d{4})$/, "$1-$2");
    setPhone(value);
  };

  const handleCepLookup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, "");
    setZipcode(cep.replace(/(\d{5})(\d)/, "$1-$2"));
    
    if (cep.length === 8) {
      setIsLookingUpCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro);
          setDistrict(data.bairro);
          setState(data.uf);
          setCity(data.localidade);
          showToast("Endereço localizado!", "info");
        }
      } catch (err) {
        showToast("Erro ao buscar CEP.", "error");
      } finally {
        setIsLookingUpCep(false);
      }
    }
  };

  // --- LÓGICA DE PERSISTÊNCIA ---
  const resetForm = () => {
    setEditingClientId(null);
    setCompanyName(""); setDocument(""); setContactName(""); setEmail(""); setPhone("");
    setZipcode(""); setStreet(""); setNumber(""); setComplement(""); setDistrict(""); setCity(""); setState("");
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || document.length < 14) {
      showToast("Preencha o nome e um documento válido.", "error");
      return;
    }
    
    setIsSubmitting(true);
    
    // Monta o endereço estruturado para salvar no campo único de texto (conforme schema)
    const fullAddress = `${street}, ${number}${complement ? ` - ${complement}` : ""} - ${district}, ${city}/${state} - CEP: ${zipcode}`;

    const payload = { 
      company_name: companyName, 
      document: document,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      address: zipcode ? fullAddress : null
    };

    const { error } = editingClientId 
      ? await supabase.from("clients").update(payload).eq("id", editingClientId)
      : await supabase.from("clients").insert([payload]);

    if (!error) {
      showToast(`${clientSingular} salvo com sucesso!`, "success");
      resetForm();
      fetchClients();
    } else {
      showToast(`Erro ao salvar: ${error.message}`, "error");
    }
    setIsSubmitting(false);
  };

  const handleEdit = (client: Client) => {
    setEditingClientId(client.id);
    setCompanyName(client.company_name);
    setDocument(client.document);
    setContactName(client.contact_name || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    
    // Tenta quebrar o endereço se estiver no formato ARXUM, senão joga no logradouro
    if (client.address?.includes(" - CEP: ")) {
      setStreet(client.address.split(",")[0] || "");
      setZipcode(client.address.split("CEP: ")[1] || "");
    } else {
      setStreet(client.address || "");
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- FILTRO DE BUSCA ---
  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      [c.company_name, c.document, c.contact_name, c.email]
        .some(val => val?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [clients, searchTerm]);

  return (
    <div className="space-y-8 relative pb-12">
      {/* Sistema de Toasts Premium */}
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

      {/* Formulário de Cadastro/Edição */}
      <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            {editingClientId ? <Edit2 className="text-cs-gold" size={20} /> : <Plus className="text-cs-green" size={20} />}
            {editingClientId ? `Editar ${clientSingular}` : `Cadastrar Novo ${clientSingular}`}
          </h3>
          {editingClientId && (
            <button onClick={resetForm} className="text-xs text-text-secondary hover:text-white transition-colors flex items-center gap-1">
              <X size={14} /> Cancelar Edição
            </button>
          )}
        </div>
        
        <form onSubmit={handleSaveClient} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Informações Básicas */}
            <div className="space-y-4 lg:col-span-1">
              <p className="text-[10px] font-bold text-cs-green uppercase tracking-widest">Identificação</p>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Razão Social / Nome Completo *</label>
                <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Ex: ARXUM Produções" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">CNPJ / CPF *</label>
                <input type="text" required value={document} onChange={handleDocumentChange} className="w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Pessoa de Contato</label>
                <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Ex: Diretor Comercial" />
              </div>
            </div>

            {/* Contato e Comunicação */}
            <div className="space-y-4 lg:col-span-1">
              <p className="text-[10px] font-bold text-cs-gold uppercase tracking-widest">Comunicação</p>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-9 rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="contato@empresa.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                  <input type="text" value={phone} onChange={handlePhoneChange} className="w-full pl-9 rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="(00) 00000-0000" />
                </div>
              </div>
            </div>

            {/* Endereço Inteligente */}
            <div className="space-y-4 lg:col-span-1">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Localização</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-text-secondary mb-1">CEP</label>
                  <div className="relative">
                    <input type="text" value={zipcode} onChange={handleCepLookup} className="w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="00000-000" />
                    {isLookingUpCep && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-cs-green" size={14} />}
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Estado</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer">
                    <option value="">UF</option>
                    {states.map(s => <option key={s.id} value={s.sigla}>{s.sigla}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Cidade</label>
                <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!state || loadingCities} className="w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm cursor-pointer disabled:opacity-50">
                  <option value="">{loadingCities ? "Carregando..." : "Selecione a cidade"}</option>
                  {cities.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Logradouro e Número</label>
                <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Rua, Av..." />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-surface/50">
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-2.5 px-8 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50">
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editingClientId ? "Atualizar Cadastro" : `Salvar ${clientSingular}`)}
            </button>
          </div>
        </form>
      </div>

      {/* Listagem e Filtro */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-lg">
        <div className="p-5 border-b border-surface/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface/50">
          <div>
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Building2 className="text-cs-gold" size={20} />
              Diretório de {clientPlural}
            </h3>
            <p className="text-xs text-text-secondary mt-1">Gerencie a base de dados oficial do sistema ARXUM.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Buscar ${clientSingular.toLowerCase()}...`}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-[10px] uppercase tracking-widest text-text-secondary">
              <tr>
                <th className="px-6 py-4 font-bold">Identificação</th>
                <th className="px-6 py-4 font-bold">Documento</th>
                <th className="px-6 py-4 font-bold">Contato e Localização</th>
                <th className="px-6 py-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto mb-4 text-cs-green" size={32} />
                    <span className="text-xs font-medium uppercase tracking-widest">Sincronizando com ARXUM Cloud...</span>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-text-secondary italic">
                    Nenhum registro encontrado para esta busca.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-background/40 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-white group-hover:text-cs-green transition-colors">{client.company_name}</p>
                      <p className="text-[11px] mt-1 flex items-center gap-1.5">
                        <User size={10} className="text-cs-gold" />
                        {client.contact_name || 'Sem contato definido'}
                      </p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {client.document}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="flex items-center gap-2 text-xs">
                          <Mail size={12} className="text-text-secondary" /> {client.email || '-'}
                        </p>
                        <p className="flex items-center gap-2 text-xs">
                          <MapPin size={12} className="text-text-secondary" /> 
                          <span className="truncate max-w-[200px]" title={client.address || ""}>
                            {client.address || 'Endereço não informado'}
                          </span>
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleEdit(client)}
                        className="inline-flex items-center gap-1.5 bg-cs-gold/10 text-cs-gold hover:bg-cs-gold hover:text-white px-3 py-1.5 rounded-md transition-all text-xs font-bold"
                      >
                        <Edit2 size={14} /> Editar
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