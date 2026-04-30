"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Building2, Plus, Search, Loader2, User, Mail, 
  Phone, MapPin, X, Check, AlertCircle, Edit2, 
  Globe, Hash, Info, Briefcase, Smartphone
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
  type: "success" | "error" | "info" | "warning";
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
  
  // Estados do Formulário
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [document, setDocument] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");
  const [website, setWebsite] = useState("");
  
  // Estados de Endereço
  const [zipcode, setZipcode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  
  // APIs Geográficas
  const [states, setStates] = useState<IbgeState[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

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
      console.error("Erro IBGE States");
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchStates();
  }, [fetchClients, fetchStates]);

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
      } finally {
        setLoadingCities(false);
      }
    };
    loadCities();
  }, [state]);

  // --- MÁSCARAS ---
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 14);
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      v = v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    setDocument(v);
  };

  const maskPhone = (val: string) => {
    let v = val.replace(/\D/g, "").slice(0, 11);
    return v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d)(\d{4})$/, "$1-$2");
  };

  const handleCepLookup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, "").slice(0, 8);
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
        }
      } finally {
        setIsLookingUpCep(false);
      }
    }
  };

  // --- PERSISTÊNCIA ---
  const resetForm = () => {
    setEditingClientId(null);
    setCompanyName(""); setDocument(""); setContactName(""); setContactRole("");
    setEmail(""); setPhone(""); setPhoneSecondary(""); setWebsite("");
    setZipcode(""); setStreet(""); setNumber(""); setComplement(""); setDistrict(""); setCity(""); setState("");
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || document.length < 14) {
      showToast("Nome e Documento válido são obrigatórios.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Validação de Duplicidade (Apenas para novos cadastros)
      if (!editingClientId) {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("document", document)
          .maybeSingle();
        
        if (existing) {
          showToast(`Este CPF/CNPJ já está cadastrado no sistema ARXUM.`, "warning");
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Formatação de Endereço e Notas (para campos não existentes no schema)
      const fullAddress = `${street}, ${number} ${complement ? `(${complement})` : ""} - ${district}, ${city}/${state} - CEP: ${zipcode}`;
      const contactInfo = contactRole ? `${contactName} (${contactRole})` : contactName;

      const payload = { 
        company_name: companyName, 
        document: document,
        contact_name: contactInfo || null,
        email: email || null,
        phone: phone ? `${phone}${phoneSecondary ? ` / ${phoneSecondary}` : ""}` : null,
        address: zipcode ? fullAddress : (street || null)
      };

      const { error } = editingClientId 
        ? await supabase.from("clients").update(payload).eq("id", editingClientId)
        : await supabase.from("clients").insert([payload]);

      if (error) throw error;

      showToast(`${clientSingular} registrado com sucesso na ARXUM Cloud.`, "success");
      resetForm();
      fetchClients();
    } catch (err: any) {
      showToast(`Falha na gravação: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClientId(client.id);
    setCompanyName(client.company_name);
    setDocument(client.document);
    setContactName(client.contact_name?.split(" (")[0] || "");
    setEmail(client.email || "");
    setPhone(client.phone?.split(" / ")[0] || "");
    setPhoneSecondary(client.phone?.split(" / ")[1] || "");
    setStreet(client.address || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      [c.company_name, c.document, c.contact_name, c.email]
        .some(val => val?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [clients, searchTerm]);

  return (
    <div className="space-y-8 relative pb-12">
      {/* Toasts ARXUM */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-md shadow-2xl flex items-center gap-2 border animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'bg-cs-green/10 border-cs-green/20 text-cs-green' : 
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
          toast.type === 'warning' ? 'bg-cs-gold/10 border-cs-gold/20 text-cs-gold' :
          'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Formulário Denso */}
      <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-8 border-b border-surface/50 pb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            {editingClientId ? <Edit2 className="text-cs-gold" size={24} /> : <Plus className="text-cs-green" size={24} />}
            {editingClientId ? `Atualizar Cadastro: ${companyName}` : `Novo Cadastro de ${clientSingular}`}
          </h3>
          {editingClientId && (
            <button onClick={resetForm} className="text-xs font-bold text-red-400 hover:text-red-300 uppercase tracking-widest flex items-center gap-1">
              <X size={14} /> Cancelar
            </button>
          )}
        </div>
        
        <form onSubmit={handleSaveClient} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Coluna 1: Jurídico/Identidade */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-cs-green rounded-full"></div>
                <p className="text-xs font-black text-white uppercase tracking-widest">Identidade</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Razão Social / Nome Completo *</label>
                <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Nome oficial" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">CNPJ / CPF *</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                  <input type="text" required value={document} onChange={handleDocumentChange} className="w-full pl-9 rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="00.000.000/0000-00" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Website / Portfólio</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                  <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full pl-9 rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="www.site.com.br" />
                </div>
              </div>
            </div>

            {/* Coluna 2: Contatos */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-cs-gold rounded-full"></div>
                <p className="text-xs font-black text-white uppercase tracking-widest">Comunicação</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Pessoa de Contato</label>
                  <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Nome" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Cargo</label>
                  <input type="text" value={contactRole} onChange={(e) => setContactRole(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Ex: CEO" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">E-mail Principal</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-9 rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="contato@arxum.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">WhatsApp</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                    <input type="text" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} className="w-full pl-9 rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Fixo / Alternativo</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                    <input type="text" value={phoneSecondary} onChange={(e) => setPhoneSecondary(maskPhone(e.target.value))} className="w-full pl-9 rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="(00) 0000-0000" />
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 3: Localização */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                <p className="text-xs font-black text-white uppercase tracking-widest">Localização</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">CEP</label>
                  <div className="relative">
                    <input type="text" value={zipcode} onChange={handleCepLookup} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="00000-000" />
                    {isLookingUpCep && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-cs-green" size={14} />}
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">UF</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm">
                    <option value="">--</option>
                    {states.map(s => <option key={s.id} value={s.sigla}>{s.sigla}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Cidade</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!state || loadingCities} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm disabled:opacity-50">
                    <option value="">{loadingCities ? "..." : "Cidade"}</option>
                    {cities.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Logradouro / Bairro</label>
                <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Rua, Avenida, Bairro..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Número</label>
                  <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="S/N" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Complemento</label>
                  <input type="text" value={complement} onChange={(e) => setComplement(e.target.value)} className="w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Sala, Bloco..." />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-surface/50 gap-4">
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-md bg-cs-green py-3 px-10 text-sm font-black text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50 uppercase tracking-widest">
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editingClientId ? "Confirmar Alterações" : `Finalizar Cadastro`)}
            </button>
          </div>
        </form>
      </div>

      {/* Listagem */}
      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-surface/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface/80">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="text-cs-gold" size={24} />
              Base de Dados: {clientPlural}
            </h3>
            <p className="text-xs text-text-secondary mt-1 uppercase tracking-widest font-medium">Controle de registros ARXUM</p>
          </div>
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Filtrar por nome, documento ou e-mail...`}
              className="w-full pl-10 pr-4 py-2.5 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-background/50 text-[10px] uppercase tracking-widest text-text-secondary font-black">
              <tr>
                <th className="px-6 py-5">Registro / Responsável</th>
                <th className="px-6 py-5">Documentação</th>
                <th className="px-6 py-5">Canais de Contato</th>
                <th className="px-6 py-5 text-right">Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto mb-4 text-cs-green" size={40} />
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-cs-green">Acessando ARXUM Cloud...</span>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-text-secondary italic font-medium uppercase tracking-widest">
                    Nenhum registro localizado na base atual.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-background/60 transition-colors group border-transparent border-l-2 hover:border-cs-green">
                    <td className="px-6 py-5">
                      <p className="font-black text-white text-base group-hover:text-cs-green transition-colors">{client.company_name}</p>
                      <p className="text-[11px] mt-1 flex items-center gap-1.5 font-bold uppercase text-text-secondary">
                        <User size={12} className="text-cs-gold" />
                        {client.contact_name || 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-5 font-mono text-xs font-bold text-white/80">
                      {client.document}
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-2 text-xs font-medium">
                          <Mail size={14} className="text-cs-green" /> {client.email || '-'}
                        </p>
                        <p className="flex items-center gap-2 text-xs font-medium">
                          <Smartphone size={14} className="text-cs-gold" /> {client.phone || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => handleEdit(client)}
                        className="inline-flex items-center gap-2 bg-surface border border-surface/50 text-text-secondary hover:text-white hover:border-cs-gold px-4 py-2 rounded-md transition-all text-xs font-black uppercase tracking-widest shadow-sm"
                      >
                        <Edit2 size={14} /> Detalhes
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