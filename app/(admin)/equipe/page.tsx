"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, Loader2, Search, UserCheck, Mail, Building2, 
  Briefcase, X, Send, UserPlus, AlertTriangle, Edit, CheckCircle,
  ChevronDown, ChevronUp, User, ShieldAlert, MoreHorizontal
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface Client {
  id: string;
  company_name: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  client_id: string | null;
  created_at: string;
  clients?: {
    company_name: string;
  };
}

interface Toast {
  type: "success" | "error" | "warning";
  text: string;
}

export default function EquipePage() {
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels || {};

  // --- LABELS DINÂMICAS ARXUM ---
  const teamLabel = labels.menu_team || "Equipe e Acessos";
  const profileSingular = labels.entity_profile_singular || "Usuário";
  const clientSingular = labels.entity_client_singular || "Cliente";
  const clientPlural = labels.entity_client_plural || "Clientes";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  
  // Estado para controlar quais empresas estão expandidas no acordeão
  const [expandedCompanies, setExpandedCompanies] = useState<string[]>([]);

  // Estados do Modal de Adicionar/Convidar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"add" | "invite">("add");
  const [userEmail, setUserEmail] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("client");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Estados do Modal de Edição
  const [editModal, setEditModal] = useState<{ isOpen: boolean, user: Profile | null, newRole: string, newClientId: string }>({
    isOpen: false, user: null, newRole: "", newClientId: ""
  });

  const showToast = useCallback((text: string, type: Toast["type"]) => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*, clients(company_name)")
      .order("created_at", { ascending: false });
    if (!error && data) setProfiles(data as Profile[]);
    setLoading(false);
  }, []);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from("clients").select("id, company_name").order("company_name");
    if (data) setClients(data as Client[]);
  }, []);

  const checkCurrentUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
      const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (data) setCurrentUserRole(data.role);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
    fetchClients();
    checkCurrentUser();
  }, [fetchProfiles, fetchClients, checkCurrentUser]);

  const toggleCompany = (companyName: string) => {
    setExpandedCompanies(prev => 
      prev.includes(companyName) ? prev.filter(c => c !== companyName) : [...prev, companyName]
    );
  };

  const openEditModal = (user: Profile) => {
    if (user.role === 'super_admin' && currentUserRole !== 'super_admin') {
      showToast("Acesso Negado: Apenas o proprietário pode editar um Super Admin.", "error");
      return;
    }
    setEditModal({
      isOpen: true,
      user: user,
      newRole: user.role,
      newClientId: user.client_id || ""
    });
  };

  const saveUserEdits = async () => {
    if (!editModal.user) return;
    setIsProcessing(true);

    const { error } = await supabase
      .from("profiles")
      .update({ role: editModal.newRole, client_id: editModal.newClientId || null })
      .eq("id", editModal.user.id);
    
    if (!error) {
      showToast("Permissões atualizadas com sucesso.", "success");
      setEditModal({ isOpen: false, user: null, newRole: "", newClientId: "" });
      fetchProfiles();
    } else {
      showToast(`Erro: ${error.message}`, "error");
    }
    setIsProcessing(false);
  };

  const handleProcessUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !userFullName) {
      showToast("Preencha todos os campos obrigatórios.", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modalTab,
          email: userEmail,
          fullName: userFullName,
          password: userPassword,
          role: userRole,
          inviterRole: currentUserRole
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro na operação.");

      showToast(modalTab === 'add' ? "Usuário ARXUM criado com sucesso." : "Convite enviado!", "success");
      setIsModalOpen(false);
      resetAddForm();
      fetchProfiles();
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAddForm = () => {
    setUserEmail(""); setUserFullName(""); setUserPassword(""); setUserRole("client");
  };

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string, color: string }> = {
      super_admin: { label: "Super Admin", color: "bg-red-500/10 text-red-400 border-red-500/20" },
      admin: { label: "Administrador", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
      commercial: { label: "Comercial", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
      financial: { label: "Financeiro", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      logistics: { label: "Logística", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
      marketing: { label: "Marketing", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
      training: { label: "Instrutor", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
      support: { label: "Suporte", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
      client: { label: "Cliente", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
      student: { label: "Aluno", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
      subscriber: { label: "Assinante", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
    };
    const config = roles[role] || roles.client;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border tracking-widest ${config.color}`}>{config.label}</span>;
  };

  const filteredProfiles = profiles.filter(p => 
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.full_name && p.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const internalTeam = filteredProfiles.filter(p => !['client', 'student', 'subscriber'].includes(p.role));
  const externalUsers = filteredProfiles.filter(p => ['client', 'student', 'subscriber'].includes(p.role));

  const groupedExternal = externalUsers.reduce((acc, curr) => {
    const company = curr.clients?.company_name || "Usuários sem Vínculo";
    if (!acc[company]) acc[company] = [];
    acc[company].push(curr);
    return acc;
  }, {} as Record<string, Profile[]>);

  const UserTable = ({ users }: { users: Profile[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-text-secondary">
        <thead className="bg-background/50 text-[10px] uppercase tracking-widest text-text-secondary font-black">
          <tr>
            <th className="px-6 py-4">Usuário</th>
            <th className="px-6 py-4">Nível de Acesso</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface/50">
          {users.map((profile) => (
            <tr key={profile.id} className="hover:bg-background/50 transition-colors group">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-cs-green/10 border border-cs-green/20 flex items-center justify-center text-cs-green font-black text-xs uppercase">
                    {profile.full_name ? profile.full_name.substring(0, 2) : profile.email.substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-white group-hover:text-cs-green transition-colors">{profile.full_name || 'Convite Pendente'}</p>
                    <p className="text-[11px] font-medium text-text-secondary">{profile.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">{getRoleBadge(profile.role)}</td>
              <td className="px-6 py-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-cs-green">
                  <CheckCircle size={12} /> Ativo
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button 
                  onClick={() => openEditModal(profile)}
                  className="p-2 hover:bg-surface rounded-md text-text-secondary hover:text-white transition-all"
                >
                  <Edit size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8 pb-12 relative">
      
      {/* TOASTS PREMIUM ARXUM */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'bg-cs-green/10 border-cs-green/20 text-cs-green' : 'bg-red-500/10 border-red-500/20 text-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <ShieldAlert size={20} />}
          <span className="text-sm font-bold">{toast.text}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg shadow-lg">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="text-cs-green" size={24} /> {teamLabel}
          </h3>
          <p className="text-xs text-text-secondary mt-1 uppercase tracking-widest font-black">Controle de Segurança ARXUM Cloud</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input 
              type="text" 
              placeholder={`Pesquisar ${profileSingular.toLowerCase()}...`} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2.5 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none transition-all" 
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-cs-green text-white px-6 py-2.5 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg"
          >
            <UserPlus size={18} /> Novo {profileSingular}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin text-cs-green" size={48} />
          <span className="text-xs font-black uppercase tracking-[0.3em] text-cs-green animate-pulse">Sincronizando ARXUM Cloud...</span>
        </div>
      ) : (
        <>
          {/* EQUIPE INTERNA */}
          <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-surface/50 bg-background/30 flex justify-between items-center">
              <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-[0.2em]">
                <Briefcase className="text-cs-green" size={16} /> Equipe Operacional: {companyProfile?.company_name || "ARXUM"}
              </h3>
              <span className="text-[10px] font-black text-text-secondary bg-background px-2 py-1 rounded-full border border-surface/50">{internalTeam.length} Membros</span>
            </div>
            {internalTeam.length > 0 ? <UserTable users={internalTeam} /> : <p className="p-12 text-center text-sm text-text-secondary italic uppercase tracking-widest">Nenhum membro operacional localizado.</p>}
          </div>

          {/* EXTERNOS (AGRUPAMENTO ACORDEÃO) */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 px-2 uppercase tracking-[0.2em]">
              <Building2 className="text-cs-gold" size={18} /> {clientPlural} e Acessos Externos
            </h3>
            
            {Object.entries(groupedExternal).map(([company, users]) => {
              const isExpanded = expandedCompanies.includes(company);
              return (
                <div key={company} className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-xl">
                  <button 
                    onClick={() => toggleCompany(company)}
                    className="w-full p-4 flex justify-between items-center bg-background/20 hover:bg-background/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-cs-gold/10 flex items-center justify-center border border-cs-gold/20">
                        <Building2 className="text-cs-gold" size={16} />
                      </div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-tight">{company}</h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{users.length} {profileSingular}(s)</span>
                      {isExpanded ? <ChevronUp size={20} className="text-text-secondary" /> : <ChevronDown size={20} className="text-text-secondary" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t border-surface/50 animate-in slide-in-from-top-2 duration-300">
                      <UserTable users={users} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL DE EDIÇÃO DE ACESSOS */}
      {editModal.isOpen && editModal.user && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6 border-b border-surface/50 flex justify-between items-center bg-background/50">
              <h2 className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <ShieldCheck className="text-cs-green" size={24} /> Gestão de Acesso
              </h2>
              <button onClick={() => setEditModal({ isOpen: false, user: null, newRole: "", newClientId: "" })}><X size={24} className="text-text-secondary" /></button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-background border border-surface/50 rounded-lg p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-cs-green/10 border border-cs-green/20 flex items-center justify-center text-cs-green font-black text-lg uppercase">
                  {editModal.user.email.substring(0, 2)}
                </div>
                <div>
                  <p className="font-black text-white uppercase tracking-tight">{editModal.user.full_name || 'Pendente'}</p>
                  <p className="text-xs text-text-secondary font-medium">{editModal.user.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Nível de Permissão</label>
                <select 
                  value={editModal.newRole} 
                  onChange={(e) => setEditModal({ ...editModal, newRole: e.target.value })}
                  className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none"
                >
                  <optgroup label="Gestão Estratégica">
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Administrador Geral</option>
                  </optgroup>
                  <optgroup label="Operação">
                    <option value="commercial">Comercial</option>
                    <option value="financial">Financeiro</option>
                    <option value="logistics">Logística</option>
                    <option value="marketing">Marketing</option>
                    <option value="training">Instrutor</option>
                  </optgroup>
                  <optgroup label="Externo">
                    <option value="client">Portal do Cliente</option>
                    <option value="student">Aluno Academy</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase mb-2 tracking-widest">Vínculo Institucional</label>
                <select 
                  value={editModal.newClientId} 
                  onChange={(e) => setEditModal({ ...editModal, newClientId: e.target.value })}
                  className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none"
                >
                  <option value="">Uso Interno / Sem Empresa</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
            </div>

            <div className="p-6 bg-background/50 border-t border-surface/50 flex justify-end gap-4">
              <button 
                onClick={saveUserEdits}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-cs-green text-white px-8 py-3 rounded-md font-black text-xs uppercase tracking-widest shadow-lg hover:bg-opacity-90 disabled:opacity-50 transition-all"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                Confirmar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ADICIONAR / CONVIDAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6 border-b border-surface/50 flex justify-between items-center bg-background/50">
              <h2 className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <UserPlus className="text-cs-green" size={24} /> Novo Acesso
              </h2>
              <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-text-secondary" /></button>
            </div>

            <div className="p-8">
              <div className="flex gap-2 p-1 bg-background rounded-md border border-surface/50 mb-8">
                <button onClick={() => setModalTab("add")} className={`flex-1 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${modalTab === 'add' ? 'bg-cs-green text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}>Criação Direta</button>
                <button onClick={() => setModalTab("invite")} className={`flex-1 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${modalTab === 'invite' ? 'bg-cs-green text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}>Convite E-mail</button>
              </div>

              <form onSubmit={handleProcessUser} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Nome Completo</label>
                  <input type="text" required value={userFullName} onChange={(e) => setUserFullName(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" placeholder="Ex: João Silva" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">E-mail Corporativo</label>
                  <input type="email" required value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" placeholder="email@dominio.com" />
                </div>

                {modalTab === "add" && (
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Senha Provisória</label>
                    <input type="password" required value={userPassword} onChange={(e) => setUserPassword(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none" placeholder="Mínimo 6 caracteres" />
                  </div>
                )}
                
                <div>
                  <label className="block text-[10px] font-black text-text-secondary uppercase mb-1.5 tracking-widest">Nível de Acesso</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="w-full bg-background border border-surface rounded-md px-4 py-3 text-white text-sm focus:border-cs-green outline-none">
                    <optgroup label="Operação">
                      <option value="admin">Administrador</option>
                      <option value="commercial">Comercial</option>
                      <option value="logistics">Logística</option>
                    </optgroup>
                    <optgroup label="Externo">
                      <option value="client">Cliente</option>
                      <option value="student">Aluno</option>
                    </optgroup>
                  </select>
                </div>

                <div className="pt-6 border-t border-surface/50 flex justify-end">
                  <button type="submit" disabled={isProcessing} className="flex items-center gap-3 bg-cs-green text-white px-10 py-3.5 rounded-md font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-opacity-90 disabled:opacity-50 transition-all">
                    {isProcessing ? <Loader2 className="animate-spin" size={18} /> : modalTab === 'add' ? <UserCheck size={18} /> : <Send size={18} />}
                    {modalTab === 'add' ? "Finalizar Cadastro" : "Disparar Convite"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}