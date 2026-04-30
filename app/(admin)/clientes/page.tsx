"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Building2, Plus, Search, Loader2, User, Mail, 
  Phone, MapPin, X, Check, AlertCircle, Edit2, 
  Globe, Hash, Briefcase, Smartphone, Navigation, 
  Trash2, AlertTriangle, FileText, DollarSign, 
  TrendingUp, Clock, ChevronRight, ExternalLink
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface Client {
  id: string;
  company_name: string;
  document: string;
  contact_name: string | null;
  contact_role: string | null;
  email: string | null;
  phone: string | null;
  phone_secondary: string | null;
  website: string | null;
  zipcode: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

interface Quote {
  id: string;
  title: string;
  status: string;
  final_amount: number;
  created_at: string;
}

interface FinancialSummary {
  total_contracted: number;
  total_paid: number;
  total_pending: number;
}

interface IbgeState { id: number; nome: string; sigla: string; }
interface IbgeCity { id: number; nome: string; }
interface Toast { message: string; type: "success" | "error" | "warning" | "info"; }

export default function ClientesPage() {
  const { systemPreferences } = useSettings();
  const labels = systemPreferences?.custom_labels || {};
  const clientSingular = labels.entity_client_singular || "Cliente";
  const clientPlural = labels.entity_client_plural || "Clientes";

  // Estados de Interface
  const [view, setView] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  
  // Estados de Dados
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientQuotes, setClientQuotes] = useState<Quote[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    total_contracted: 0, total_paid: 0, total_pending: 0
  });

  // Estados do Formulário
  const [formData, setForm] = useState({
    company_name: "", document: "", website: "",
    contact_name: "", contact_role: "", email: "", phone: "", phone_secondary: "",
    zipcode: "", street: "", street_number: "", complement: "", district: "", city: "", state: ""
  });

  // APIs Geográficas
  const [states, setStates] = useState<IbgeState[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);

  // Modais de Confirmação
  const [confirmSave, setConfirmSave] = useState(false);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("company_name", { ascending: true });
    if (!error && data) setClients(data as Client[]);
    setLoading(false);
  }, []);

  const fetchStates = useCallback(async () => {
    try {
      const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados");
      const data = await res.json();
      setStates(data.sort((a: IbgeState, b: IbgeState) => a.nome.localeCompare(b.nome)));
    } catch (err) { console.error("IBGE Error"); }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchStates();
  }, [fetchClients, fetchStates]);

  useEffect(() => {
    if (!formData.state) { setCities([]); return; }
    const loadCities = async () => {
      setLoadingCities(true);
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.state}/municipios`);
      const data = await res.json();
      setCities(data);
      setLoadingCities(false);
    };
    loadCities();
  }, [formData.state]);

  // --- MÁSCARAS ---
  const handleDocumentChange = (val: string) => {
    let v = val.replace(/\D/g, "").slice(0, 14);
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      v = v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    setForm(prev => ({ ...prev, document: v }));
  };

  const maskPhone = (val: string) => {
    let v = val.replace(/\D/g, "").slice(0, 11);
    if (v.length <= 10) return v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return v.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  };

  const handleCepLookup = async (cepRaw: string) => {
    const cep = cepRaw.replace(/\D/g, "").slice(0, 8);
    setForm(prev => ({ ...prev, zipcode: cep.replace(/(\d{5})(\d)/, "$1-$2") }));
    if (cep.length === 8) {
      setIsLookingUpCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setForm(prev => ({ ...prev, street: data.logradouro, district: data.bairro, state: data.uf, city: data.localidade }));
        }
      } finally { setIsLookingUpCep(false); }
    }
  };

  // --- LÓGICA DE NEGÓCIO ---
  const handleOpenDossier = async (client: Client) => {
    setLoading(true);
    setSelectedClient(client);
    
    // 1. Buscar Orçamentos
    const { data: quotes } = await supabase.from("quotes").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
    setClientQuotes(quotes || []);

    // 2. Buscar Resumo Financeiro
    const { data: trans } = await supabase.from("financial_transactions").select("amount, status, type").eq("client_id", client.id);
    
    const summary = (trans || []).reduce((acc, t) => {
      if (t.type === 'income') {
        acc.total_contracted += Number(t.amount);
        if (t.status === 'paid') acc.total_paid += Number(t.amount);
        else acc.total_pending += Number(t.amount);
      }
      return acc;
    }, { total_contracted: 0, total_paid: 0, total_pending: 0 });

    setFinancialSummary(summary);
    setLoading(false);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Checar duplicidade se for novo
      if (!selectedClient && !confirmSave) {
        const { data: existing } = await supabase.from("clients").select("id").eq("document", formData.document).maybeSingle();
        if (existing) {
          showToast("Este CPF/CNPJ já está cadastrado no ARXUM.", "error");
          setIsSubmitting(false);
          return;
        }
      }

      const { error } = await supabase.from("clients").upsert({
        id: selectedClient?.id || undefined,
        ...formData
      });

      if (error) throw error;

      showToast(`${clientSingular} salvo com sucesso!`, "success");
      setConfirmSave(false);
      setSelectedClient(null);
      setView("list");
      fetchClients();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      [c.company_name, c.document, c.contact_name, c.email, c.city]
        .some(val => val?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [clients, searchTerm]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6 relative pb-12">
      {/* TOASTS ARXUM */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-md shadow-2xl flex items-center gap-2 border animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'bg-cs-green/10 border-cs-green/20 text-cs-green' : 'bg-red-500/10 border-red-500/20 text-red-500'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* HEADER DA PÁGINA */}
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg shadow-lg">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <Building2 className="text-cs-green" size={24} />
            Gestão de {clientPlural}
          </h3>
          <p className="text-xs text-text-secondary mt-1 uppercase tracking-widest font-black">Base de Dados ARXUM Cloud</p>
        </div>
        <button 
          onClick={() => {
            setSelectedClient(null);
            setForm({
              company_name: "", document: "", website: "",
              contact_name: "", contact_role: "", email: "", phone: "", phone_secondary: "",
              zipcode: "", street: "", street_number: "", complement: "", district: "", city: "", state: ""
            });
            setView("create");
          }}
          className="flex items-center gap-2 bg-cs-green text-white px-6 py-2.5 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg"
        >
          <Plus size={18} /> Novo {clientSingular}
        </button>
      </div>

      {/* LISTAGEM PRINCIPAL */}
      {view === "list" && (
        <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-surface/50 bg-surface/80 flex justify-between items-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Pesquisar ${clientSingular.toLowerCase()}...`}
                className="w-full pl-12 pr-4 py-2.5 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none transition-all"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead className="bg-background/50 text-[10px] uppercase tracking-[0.2em] text-text-secondary font-black">
                <tr>
                  <th className="px-8 py-5">Identidade Jurídica</th>
                  <th className="px-8 py-5">CPF / CNPJ</th>
                  <th className="px-8 py-5">Localização</th>
                  <th className="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface/50">
                {loading ? (
                  <tr><td colSpan={4} className="px-8 py-20 text-center"><Loader2 className="animate-spin mx-auto text-cs-green" size={40} /></td></tr>
                ) : filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-background/60 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="font-black text-white text-base group-hover:text-cs-green transition-colors">{client.company_name}</p>
                      <p className="text-[11px] mt-1 text-text-secondary font-bold uppercase">{client.contact_name || 'N/A'}</p>
                    </td>
                    <td className="px-8 py-6 font-mono text-xs font-bold text-white/70">{client.document}</td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-bold uppercase">{client.city || 'N/A'} / {client.state || '--'}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleOpenDossier(client)}
                        className="bg-surface border border-surface/50 text-text-secondary hover:text-white hover:border-cs-gold px-4 py-2 rounded-md transition-all text-[10px] font-black uppercase tracking-widest"
                      >
                        Dossiê / Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE CADASTRO/EDIÇÃO (MODO CREATE/EDIT) */}
      {view === "create" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <button onClick={() => setView("list")} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest">
            <ArrowLeft size={16} /> Voltar para Listagem
          </button>

          <div className="bg-surface border border-surface/50 p-8 rounded-lg shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-8 border-b border-surface/50 pb-4 uppercase tracking-tighter">
              {selectedClient ? "Atualizar Registro" : `Novo Registro de ${clientSingular}`}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* BLOCO EMPRESA */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-6 bg-cs-green rounded-full"></div>
                  <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">Dados da Empresa</h4>
                </div>
                <div className="space-y-4">
                  <InputField label="Razão Social / Nome Oficial *" value={formData.company_name} onChange={v => setForm({...formData, company_name: v})} />
                  <InputField label="CNPJ / CPF *" value={formData.document} onChange={handleDocumentChange} />
                  <InputField label="Website / URL" value={formData.website} onChange={v => setForm({...formData, website: v})} placeholder="https://..." />
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1.5">CEP</label>
                      <input type="text" value={formData.zipcode} onChange={e => handleCepLookup(e.target.value)} className="w-full bg-background border border-surface rounded-md px-3 py-2 text-white text-sm focus:border-cs-green outline-none" />
                    </div>
                    <div className="col-span-2">
                      <InputField label="Logradouro / Rua" value={formData.street} onChange={v => setForm({...formData, street: v})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <InputField label="Número" value={formData.street_number} onChange={v => setForm({...formData, street_number: v})} />
                    <div className="col-span-2">
                      <InputField label="Complemento" value={formData.complement} onChange={v => setForm({...formData, complement: v})} />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO CONTATO */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-6 bg-cs-gold rounded-full"></div>
                  <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">Pessoa de Contato</h4>
                </div>
                <div className="space-y-4">
                  <InputField label="Nome do Responsável" value={formData.contact_name} onChange={v => setForm({...formData, contact_name: v})} />
                  <InputField label="Cargo / Função" value={formData.contact_role} onChange={v => setForm({...formData, contact_role: v})} placeholder="Ex: Gerente de Compras" />
                  <InputField label="E-mail Direto" value={formData.email} onChange={v => setForm({...formData, email: v})} />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="WhatsApp / Celular" value={formData.phone} onChange={v => setForm({...formData, phone: maskPhone(v)})} />
                    <InputField label="Telefone Fixo" value={formData.phone_secondary} onChange={v => setForm({...formData, phone_secondary: maskPhone(v)})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-surface/50 flex justify-end">
              <button 
                onClick={() => setConfirmSave(true)}
                disabled={isSubmitting}
                className="bg-cs-green text-white px-12 py-4 rounded-md font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-opacity-90 transition-all"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Finalizar e Gravar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DOSSIÊ (DETALHES) */}
      {selectedClient && view === "list" && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-surface border border-surface/50 w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Dossiê */}
            <div className="p-6 bg-background/50 border-b border-surface/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-cs-green/10 rounded-full flex items-center justify-center border border-cs-green/20">
                  <Building2 className="text-cs-green" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedClient.company_name}</h2>
                  <p className="text-xs text-text-secondary font-bold uppercase tracking-widest">Dossiê de Relacionamento ARXUM</p>
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="text-text-secondary hover:text-white transition-colors"><X size={32} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Coluna Esquerda: Dados e Edição */}
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black text-cs-green uppercase tracking-widest border-b border-cs-green/20 pb-2">Identidade Jurídica</h5>
                    <DataRow label="Razão Social" value={selectedClient.company_name} />
                    <DataRow label="Documento" value={selectedClient.document} />
                    <DataRow label="Website" value={selectedClient.website} isLink />
                  </div>
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black text-cs-gold uppercase tracking-widest border-b border-cs-gold/20 pb-2">Responsável Direto</h5>
                    <DataRow label="Nome" value={selectedClient.contact_name} />
                    <DataRow label="Cargo" value={selectedClient.contact_role} />
                    <DataRow label="WhatsApp" value={selectedClient.phone} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-blue-400/20 pb-2">Localização Operacional</h5>
                  <p className="text-sm text-white/80 leading-relaxed">
                    {selectedClient.street}, {selectedClient.street_number} {selectedClient.complement && `(${selectedClient.complement})`}<br/>
                    {selectedClient.district} - {selectedClient.city}/{selectedClient.state}<br/>
                    CEP: {selectedClient.zipcode}
                  </p>
                </div>

                {/* Histórico de Orçamentos */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-white uppercase tracking-widest border-b border-surface/50 pb-2">Histórico de {quotePlural}</h5>
                  <div className="space-y-2">
                    {clientQuotes.length === 0 ? (
                      <p className="text-xs text-text-secondary italic">Nenhum registro comercial localizado.</p>
                    ) : clientQuotes.map(q => (
                      <div key={q.id} className="bg-background/40 border border-surface/50 p-4 rounded-md flex justify-between items-center hover:border-cs-green/50 transition-all">
                        <div>
                          <p className="text-sm font-bold text-white uppercase">{q.title}</p>
                          <p className="text-[10px] text-text-secondary uppercase font-black">{new Date(q.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-cs-green">{formatCurrency(q.final_amount)}</p>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-surface rounded-full text-text-secondary">{q.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Resumo Financeiro */}
              <div className="space-y-6">
                <div className="bg-background/60 border border-surface/50 p-6 rounded-xl space-y-6">
                  <h5 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={16} className="text-cs-green" /> Saúde Financeira
                  </h5>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-surface rounded-lg border-l-4 border-cs-green">
                      <p className="text-[10px] font-black text-text-secondary uppercase">Total Contratado</p>
                      <p className="text-xl font-black text-white">{formatCurrency(financialSummary.total_contracted)}</p>
                    </div>
                    <div className="p-4 bg-surface rounded-lg border-l-4 border-blue-500">
                      <p className="text-[10px] font-black text-text-secondary uppercase">Total Recebido</p>
                      <p className="text-xl font-black text-white">{formatCurrency(financialSummary.total_paid)}</p>
                    </div>
                    <div className="p-4 bg-surface rounded-lg border-l-4 border-red-500">
                      <p className="text-[10px] font-black text-text-secondary uppercase">Saldo Devedor</p>
                      <p className="text-xl font-black text-red-400">{formatCurrency(financialSummary.total_pending)}</p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={() => {
                        setForm({
                          company_name: selectedClient.company_name,
                          document: selectedClient.document,
                          website: selectedClient.website || "",
                          contact_name: selectedClient.contact_name || "",
                          contact_role: selectedClient.contact_role || "",
                          email: selectedClient.email || "",
                          phone: selectedClient.phone || "",
                          phone_secondary: selectedClient.phone_secondary || "",
                          zipcode: selectedClient.zipcode || "",
                          street: selectedClient.street || "",
                          street_number: selectedClient.street_number || "",
                          complement: selectedClient.complement || "",
                          district: selectedClient.district || "",
                          city: selectedClient.city || "",
                          state: selectedClient.state || ""
                        });
                        setView("create");
                      }}
                      className="w-full py-3 bg-cs-gold text-white font-black text-[10px] uppercase tracking-widest rounded-md hover:bg-opacity-90 transition-all"
                    >
                      Editar Cadastro Completo
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE SALVAMENTO */}
      {confirmSave && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 p-8 rounded-xl shadow-2xl max-w-sm w-full text-center">
            <div className="w-20 h-20 bg-cs-green/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-cs-green/20">
              <Save size={40} className="text-cs-green" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Confirmar Gravação?</h3>
            <p className="text-sm text-text-secondary mb-8">Os dados serão sincronizados com a base de dados oficial da ARXUM.</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmSave(false)} className="flex-1 py-3 border border-surface rounded-md text-xs font-black uppercase text-text-secondary hover:text-white transition-all">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-cs-green text-white rounded-md text-xs font-black uppercase shadow-lg hover:bg-opacity-90 transition-all">Sincronizar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUBCOMPONENTES AUXILIARES ---
function InputField({ label, value, onChange, placeholder = "", type = "text" }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, type?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-surface rounded-md px-3 py-2.5 text-white text-sm focus:border-cs-green outline-none transition-all placeholder:text-white/10"
      />
    </div>
  );
}

function DataRow({ label, value, isLink = false }: { label: string, value: string | null, isLink?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-black text-text-secondary uppercase tracking-tighter">{label}</p>
      {isLink && value ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" className="text-sm font-bold text-cs-green flex items-center gap-1 hover:underline">
          {value} <ExternalLink size={12} />
        </a>
      ) : (
        <p className="text-sm font-bold text-white/90">{value || '---'}</p>
      )}
    </div>
  );
}

function Save({ size, className }: { size: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}