"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { ShieldCheck, Loader2, Search, UserCheck, Mail, Building2, Briefcase, X, Send, UserPlus, AlertTriangle } from "lucide-react";

export default function EquipePage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [currentUserRole, setCurrentUserRole] = useState("");
  const[currentUserId, setCurrentUserId] = useState("");

  // Estados do Modal de Adicionar/Convidar
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"add" | "invite">("add");
  const [userEmail, setUserEmail] = useState("");
  const[userFullName, setUserFullName] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const[userRole, setUserRole] = useState("client");
  const [isProcessing, setIsProcessing] = useState(false);
  const[feedbackMsg, setFeedbackMsg] = useState({ type: "", text: "" });

  // Estados do Modal Customizado de Confirmação (Substitui o window.confirm)
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, userId: string, newRole: string, currentRole: string } | null>(null);

  useEffect(() => {
    fetchProfiles();
    checkCurrentUser();
  },[]);

  const checkCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
      const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (data) setCurrentUserRole(data.role);
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*, clients(company_name)").order("created_at", { ascending: false });
    if (!error && data) setProfiles(data);
    setLoading(false);
  };

  // Abre o modal customizado em vez do alert nativo
  const requestRoleChange = (userId: string, newRole: string, currentRole: string) => {
    if (currentRole === 'super_admin' && currentUserRole !== 'super_admin') {
      setFeedbackMsg({ type: "error", text: "Acesso Negado: Apenas um Super Admin pode alterar outro Super Admin." });
      setTimeout(() => setFeedbackMsg({ type: "", text: "" }), 4000);
      fetchProfiles(); // Reseta o select
      return;
    }
    setConfirmModal({ isOpen: true, userId, newRole, currentRole });
  };

  // Executa a mudança após confirmação no modal
  const confirmRoleChange = async () => {
    if (!confirmModal) return;
    
    const { error } = await supabase.from("profiles").update({ role: confirmModal.newRole }).eq("id", confirmModal.userId);
    
    if (!error) {
      fetchProfiles();
    } else {
      setFeedbackMsg({ type: "error", text: "Erro ao atualizar permissão: " + error.message });
      setTimeout(() => setFeedbackMsg({ type: "", text: "" }), 4000);
    }
    setConfirmModal(null);
  };

  const handleProcessUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setFeedbackMsg({ type: "", text: "" });

    if (modalTab === "add" && userPassword.length < 6) {
      setFeedbackMsg({ type: "error", text: "A senha deve ter no mínimo 6 caracteres." });
      setIsProcessing(false);
      return;
    }

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
          inviterId: currentUserId,
          inviterRole: currentUserRole
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro na operação.");

      setFeedbackMsg({ type: "success", text: modalTab === 'add' ? "Usuário criado e liberado com sucesso!" : "Convite enviado com sucesso!" });
      setUserEmail(""); setUserFullName(""); setUserPassword("");
      fetchProfiles();

    } catch (error: any) {
      setFeedbackMsg({ type: "error", text: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string, color: string }> = {
      super_admin: { label: "Super Admin", color: "bg-red-500/20 text-red-400 border-red-500/30" },
      admin: { label: "Administrador", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      commercial: { label: "Comercial / Vendas", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      financial: { label: "Financeiro", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
      logistics: { label: "Logística", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      marketing: { label: "Marketing", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
      training: { label: "Treinamentos", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
      support: { label: "Suporte Técnico", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
      client: { label: "Cliente (Portal)", color: "bg-surface border-surface/50 text-text-secondary" },
      student: { label: "Aluno (Academy)", color: "bg-surface border-surface/50 text-text-secondary" },
      subscriber: { label: "Assinante Avulso", color: "bg-surface border-surface/50 text-text-secondary" },
    };
    const config = roles[role] || roles.client;
    return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider ${config.color}`}>{config.label}</span>;
  };

  const filteredProfiles = profiles.filter(profile => 
    profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (profile.full_name && profile.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (profile.clients?.company_name && profile.clients.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const internalTeam = filteredProfiles.filter(p => !['client', 'student', 'subscriber'].includes(p.role));
  const externalUsers = filteredProfiles.filter(p =>['client', 'student', 'subscriber'].includes(p.role));

  const groupedExternal = externalUsers.reduce((acc, curr) => {
    const company = curr.clients?.company_name || "Usuários Avulsos / Sem Empresa Vinculada";
    if (!acc[company]) acc[company] = [];
    acc[company].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  const UserTable = ({ users }: { users: any[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-text-secondary">
        <thead className="bg-background/50 text-xs uppercase text-text-secondary">
          <tr>
            <th className="px-6 py-3 font-medium">Usuário / E-mail</th>
            <th className="px-6 py-3 font-medium">Nível de Acesso Atual</th>
            <th className="px-6 py-3 font-medium">Data de Cadastro</th>
            <th className="px-6 py-3 font-medium text-right">Alterar Permissão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface/50">
          {users.map((profile) => (
            <tr key={profile.id} className="hover:bg-background/50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cs-green/20 border border-cs-green/30 flex items-center justify-center text-cs-green font-bold text-xs uppercase shrink-0">
                    {profile.email.substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{profile.full_name || 'Convite Pendente / Sem Nome'}</p>
                    <p className="text-xs mt-0.5">{profile.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">{getRoleBadge(profile.role)}</td>
              <td className="px-6 py-4 text-xs">{new Date(profile.created_at).toLocaleDateString('pt-BR')}</td>
              <td className="px-6 py-4 text-right">
                <select
                  value={profile.role}
                  onChange={(e) => requestRoleChange(profile.id, e.target.value, profile.role)}
                  disabled={(profile.role === 'super_admin' && currentUserRole !== 'super_admin') || (currentUserRole === 'commercial')}
                  className="bg-background border border-surface/50 text-white text-xs rounded px-3 py-2 focus:border-cs-green focus:outline-none disabled:opacity-50 cursor-pointer"
                >
                  <optgroup label="Gestão">
                    <option value="super_admin">Super Admin (Dono)</option>
                    <option value="admin">Administrador Geral</option>
                  </optgroup>
                  <optgroup label="Operação Interna">
                    <option value="commercial">Comercial / Vendas</option>
                    <option value="financial">Financeiro</option>
                    <option value="logistics">Logística / Almoxarifado</option>
                    <option value="marketing">Marketing</option>
                    <option value="training">Treinamentos (Instrutor)</option>
                    <option value="support">Suporte Técnico</option>
                  </optgroup>
                  <optgroup label="Acesso Externo">
                    <option value="client">Cliente (Portal)</option>
                    <option value="student">Aluno (Academy)</option>
                    <option value="subscriber">Assinante Avulso</option>
                  </optgroup>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8 pb-12 relative">
      
      {/* Toast de Feedback Global */}
      {feedbackMsg.text && !isModalOpen && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-md shadow-2xl text-sm font-bold border animate-in slide-in-from-right-8 ${feedbackMsg.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 'bg-cs-green/90 text-white border-cs-green'}`}>
          {feedbackMsg.text}
        </div>
      )}

      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <ShieldCheck className="text-cs-green" size={20} /> Gestão de Equipe e Acessos
          </h3>
          <p className="text-xs text-text-secondary mt-1">Controle de permissões e organização de usuários.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input type="text" placeholder="Buscar usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-md border border-surface bg-background text-sm text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green" />
          </div>
          <button 
            onClick={() => { setIsModalOpen(true); setFeedbackMsg({ type: "", text: "" }); }}
            className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
          >
            <UserPlus size={18} /> Novo Usuário
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cs-green" size={40} /></div>
      ) : (
        <>
          <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-surface/50 bg-background/30">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <Briefcase className="text-cs-green" size={18} /> Equipe Interna (AXON / CS com)
              </h3>
            </div>
            {internalTeam.length > 0 ? <UserTable users={internalTeam} /> : <p className="p-6 text-center text-sm text-text-secondary">Nenhum membro encontrado.</p>}
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 px-2">
              <Building2 className="text-cs-gold" size={20} /> Clientes, Alunos e Externos
            </h3>
            {Object.keys(groupedExternal).length > 0 ? (
              Object.entries(groupedExternal).map(([company, users]) => (
                <div key={company} className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-surface/50 bg-background/30 flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white">{company}</h4>
                    <span className="text-xs font-medium text-text-secondary bg-background px-2 py-1 rounded-full border border-surface/50">{(users as any[]).length} usuário(s)</span>
                  </div>
                  <UserTable users={users as any[]} />
                </div>
              ))
            ) : (
              <div className="bg-surface border border-surface/50 rounded-lg p-6 text-center text-sm text-text-secondary">Nenhum cliente ou usuário externo encontrado.</div>
            )}
          </div>
        </>
      )}

      {/* MODAL CUSTOMIZADO DE CONFIRMAÇÃO (Substitui o window.confirm) */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Alterar Permissão?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Isso modificará imediatamente o que este usuário pode ver e editar no sistema. Tem certeza?
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setConfirmModal(null); fetchProfiles(); }} className="flex-1 py-2 rounded-md border border-surface text-text-secondary hover:text-white hover:bg-background transition-colors font-medium text-sm">
                Cancelar
              </button>
              <button onClick={confirmRoleChange} className="flex-1 py-2 rounded-md bg-cs-green text-white font-medium text-sm hover:bg-opacity-90 transition-colors shadow-lg">
                Sim, Alterar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ADICIONAR / CONVIDAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-surface/50 bg-background/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="text-cs-green" size={20} /> Adicionar Usuário
              </h2>
              <button onClick={() => { setIsModalOpen(false); setFeedbackMsg({ type: "", text: "" }); }} className="text-text-secondary hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {/* Abas do Modal */}
              <div className="flex gap-2 p-1 bg-background rounded-md border border-surface/50 mb-6">
                <button onClick={() => setModalTab("add")} className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${modalTab === 'add' ? 'bg-cs-green text-white' : 'text-text-secondary hover:text-white'}`}>
                  Adicionar Manualmente
                </button>
                <button onClick={() => setModalTab("invite")} className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${modalTab === 'invite' ? 'bg-cs-green text-white' : 'text-text-secondary hover:text-white'}`}>
                  Enviar Convite (E-mail)
                </button>
              </div>

              {feedbackMsg.text && (
                <div className={`p-4 rounded-md mb-6 text-sm font-medium border ${feedbackMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-cs-green/10 text-cs-green border-cs-green/20'}`}>
                  {feedbackMsg.text}
                </div>
              )}

              <form onSubmit={handleProcessUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Nome Completo</label>
                  <input type="text" value={userFullName} onChange={(e) => setUserFullName(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="João Silva" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">E-mail *</label>
                  <input type="email" required value={userEmail} onChange={(e) => setUserEmail(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="email@empresa.com.br" />
                </div>

                {modalTab === "add" && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Definir Senha *</label>
                    <input type="text" required value={userPassword} onChange={(e) => setUserPassword(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors" placeholder="Mínimo 6 caracteres" />
                    <p className="text-[10px] text-text-secondary mt-1">O usuário já nascerá com o e-mail confirmado e pronto para logar.</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Nível de Acesso Inicial *</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2 text-white focus:border-cs-green focus:outline-none focus:ring-1 focus:ring-cs-green transition-colors">
                    {['super_admin', 'admin'].includes(currentUserRole) && (
                      <optgroup label="Operação Interna">
                        <option value="admin">Administrador</option>
                        <option value="commercial">Comercial / Vendas</option>
                        <option value="financial">Financeiro</option>
                        <option value="logistics">Logística / Almoxarifado</option>
                        <option value="marketing">Marketing</option>
                        <option value="training">Treinamentos (Instrutor)</option>
                        <option value="support">Suporte Técnico</option>
                      </optgroup>
                    )}
                    <optgroup label="Acesso Externo">
                      <option value="client">Cliente (Portal)</option>
                      <option value="student">Aluno (Academy)</option>
                      <option value="subscriber">Assinante Avulso</option>
                    </optgroup>
                  </select>
                </div>

                <div className="pt-4 mt-2 border-t border-surface/50 flex justify-end">
                  <button type="submit" disabled={isProcessing} className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all disabled:opacity-50">
                    {isProcessing ? <Loader2 className="animate-spin" size={18} /> : modalTab === 'add' ? <UserCheck size={18} /> : <Send size={18} />}
                    {modalTab === 'add' ? "Criar Usuário" : "Disparar Convite"}
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