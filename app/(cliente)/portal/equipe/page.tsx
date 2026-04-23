"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { Users, UserPlus, Trash2, Loader2, AlertTriangle, CheckCircle, X, ShieldAlert, Mail } from "lucide-react";

// --- BLINDAGEM TYPESCRIPT ---
interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

interface Toast {
  type: "success" | "error";
  text: string;
}

interface ConfirmDialog {
  isOpen: boolean;
  userId: string;
  userName: string;
}

export default function EquipeClientePage() {
  const [loading, setLoading] = useState(true);
  const[teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [allowedLicenses, setAllowedLicenses] = useState<number>(1); 
  
  const [currentUser, setCurrentUser] = useState<{ id: string, role: string } | null>(null);

  // Estados do Modal de Convite (Sem Senha)
  const[isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const[inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const[isProcessing, setIsProcessing] = useState(false);

  // Estados de UI
  const[toast, setToast] = useState<Toast>({ type: "success", text: "" });
  const[confirmModal, setConfirmModal] = useState<ConfirmDialog>({ isOpen: false, userId: "", userName: "" });

  useEffect(() => {
    fetchData();
  },[]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, client_id")
        .eq("id", session.user.id)
        .single();

      if (profile?.client_id) {
        setCurrentUser({ id: profile.id, role: profile.role });
        setClientId(profile.client_id);

        const { data: clientData } = await supabase
          .from("clients")
          .select("allowed_training_licenses")
          .eq("id", profile.client_id)
          .single();
          
        if (clientData && clientData.allowed_training_licenses !== null) {
          setAllowedLicenses(clientData.allowed_training_licenses);
        } else {
          setAllowedLicenses(1);
        }

        const { data: membersData } = await supabase
          .from("profiles")
          .select("id, email, full_name, created_at")
          .eq("client_id", profile.client_id)
          .eq("role", "student")
          .order("created_at", { ascending: false });

        if (membersData) setTeamMembers(membersData as TeamMember[]);
      }
    } catch (error) {
      console.error("Erro ao buscar dados da equipe:", error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text: string, type: "success" | "error") => {
    setToast({ text, type });
    setTimeout(() => setToast({ type: "success", text: "" }), 4000);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) {
      showToast("Preencha o e-mail do operador.", "error");
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite", // Fluxo Zero Trust
          email: inviteEmail,
          fullName: inviteName,
          role: "student",
          clientId: clientId, 
          inviterId: currentUser?.id,
          inviterRole: currentUser?.role
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erro ao convidar operador.");
      }

      showToast("Convite enviado com sucesso! O operador receberá um e-mail para definir a senha.", "success");
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteName("");
      fetchData();

    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmRevokeAccess = async () => {
    if (!confirmModal.userId) return;
    setIsProcessing(true);

    const { error } = await supabase
      .from("profiles")
      .update({ client_id: null, role: "subscriber" })
      .eq("id", confirmModal.userId);

    if (!error) {
      showToast("Acesso revogado com sucesso. A licença foi liberada.", "success");
      setConfirmModal({ isOpen: false, userId: "", userName: "" });
      fetchData();
    } else {
      showToast("Erro ao revogar acesso: " + error.message, "error");
    }
    setIsProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-cs-green" size={48} />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-surface border border-surface/50 p-8 rounded-xl text-center max-w-md">
          <ShieldAlert size={48} className="text-cs-gold mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-text-secondary text-sm">Sua conta não está vinculada a uma empresa para gerenciar licenças. Contate o suporte.</p>
        </div>
      </div>
    );
  }

  const licensesUsed = teamMembers.length;
  const licensesAvailable = allowedLicenses - licensesUsed;
  const isLimitReached = licensesAvailable <= 0;

  return (
    <div className="flex-1 bg-background p-8 relative">
      
      {/* Toast */}
      {toast.text && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-[#1a1413] border-cs-green text-cs-green' : 'bg-[#1a1413] border-red-500 text-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold">{toast.text}</span>
        </div>
      )}

      {/* Modal de Confirmação (Revogar) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Revogar Acesso?</h3>
            <p className="text-sm text-text-secondary mb-6">
              O usuário <strong>{confirmModal.userName}</strong> perderá imediatamente o acesso aos treinamentos da Academy e a licença será liberada.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ isOpen: false, userId: "", userName: "" })} className="flex-1 py-2 rounded-md border border-surface text-text-secondary hover:text-white hover:bg-background transition-colors font-medium text-sm">
                Cancelar
              </button>
              <button onClick={confirmRevokeAccess} disabled={isProcessing} className="flex-1 py-2 rounded-md bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors shadow-lg flex justify-center items-center gap-2 disabled:opacity-50">
                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : "Sim, Revogar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Convidar Operador */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-surface/50 bg-background/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Mail className="text-cs-green" size={20} /> Convidar Operador
              </h2>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-text-secondary hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-text-secondary mb-6">
                Enviaremos um e-mail oficial com um link seguro. Seu operador poderá definir a própria senha e acessar a LOC FIX Academy.
              </p>

              <form onSubmit={handleInviteUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Nome Completo</label>
                  <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="Ex: Carlos Operador" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">E-mail de Acesso *</label>
                  <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="block w-full rounded-md border border-surface bg-background px-3 py-2.5 text-white focus:border-cs-green focus:outline-none text-sm" placeholder="carlos@suaempresa.com.br" />
                </div>

                <div className="pt-4 mt-2 border-t border-surface/50 flex justify-end">
                  <button type="submit" disabled={isProcessing} className="flex items-center gap-2 rounded-md bg-cs-green py-2.5 px-6 text-sm font-bold text-white shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50">
                    {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                    Enviar Convite
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Users className="text-cs-green" size={32} />
              Minha Equipe (Academy)
            </h1>
            <p className="text-text-secondary mt-2">Gerencie as licenças de treinamento da sua empresa.</p>
          </div>
          <button 
            onClick={() => setIsInviteModalOpen(true)}
            disabled={isLimitReached}
            className={`flex items-center gap-2 rounded-md py-2.5 px-6 text-sm font-bold text-white shadow-lg transition-all ${isLimitReached ? 'bg-surface border border-surface/50 text-text-secondary cursor-not-allowed' : 'bg-cs-green hover:bg-opacity-90'}`}
          >
            <UserPlus size={18} /> {isLimitReached ? 'Limite Atingido' : 'Convidar Operador'}
          </button>
        </div>

        {/* KPIs de Licenças */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-surface/50 p-6 rounded-xl">
            <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Licenças Contratadas</p>
            <p className="text-3xl font-extrabold text-white">{allowedLicenses}</p>
          </div>
          <div className="bg-surface border border-surface/50 p-6 rounded-xl">
            <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Licenças em Uso</p>
            <p className="text-3xl font-extrabold text-white">{licensesUsed}</p>
          </div>
          <div className={`bg-surface border p-6 rounded-xl ${isLimitReached ? 'border-red-500/50 bg-red-500/5' : 'border-cs-green/50 bg-cs-green/5'}`}>
            <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${isLimitReached ? 'text-red-500' : 'text-cs-green'}`}>Licenças Disponíveis</p>
            <p className={`text-3xl font-extrabold ${isLimitReached ? 'text-red-500' : 'text-cs-green'}`}>{licensesAvailable}</p>
            {isLimitReached && <p className="text-xs text-red-400 mt-2">Para adicionar mais operadores, contate seu gerente de contas.</p>}
          </div>
        </div>

        {/* Tabela de Operadores */}
        <div className="bg-surface border border-surface/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-surface/50 bg-background/50">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Operadores Ativos</h3>
          </div>
          
          {teamMembers.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={48} className="text-text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium text-white">Nenhum operador cadastrado.</p>
              <p className="text-text-secondary text-sm mt-1">Utilize o botão acima para convidar sua equipe.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary">
                <thead className="bg-background/50 text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-6 py-4 font-medium">Nome / E-mail</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Data de Cadastro</th>
                    <th className="px-6 py-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface/50">
                  {teamMembers.map(member => (
                    <tr key={member.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cs-green/20 border border-cs-green/30 flex items-center justify-center text-cs-green font-bold text-xs uppercase shrink-0">
                            {member.email.substring(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-white">{member.full_name || 'Convite Pendente / Sem nome'}</p>
                            <p className="text-xs mt-0.5">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider bg-cs-green/10 text-cs-green border-cs-green/20">
                          Ativo
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">
                        {new Date(member.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setConfirmModal({ isOpen: true, userId: member.id, userName: member.full_name || member.email })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background border border-surface/50 rounded text-xs font-bold text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                        >
                          <Trash2 size={14} /> Revogar Acesso
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}