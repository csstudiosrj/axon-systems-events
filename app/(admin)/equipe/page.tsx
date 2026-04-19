"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { ShieldCheck, Loader2, Search, UserCheck, Mail } from "lucide-react";

export default function EquipePage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const[loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const[currentUserRole, setCurrentUserRole] = useState("");

  useEffect(() => {
    fetchProfiles();
    checkCurrentUser();
  },[]);

  const checkCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (data) setCurrentUserRole(data.role);
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (!error && data) setProfiles(data);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Impede que um admin rebaixe um super_admin
    const targetUser = profiles.find(p => p.id === userId);
    if (targetUser?.role === 'super_admin' && currentUserRole !== 'super_admin') {
      alert("Você não tem permissão para alterar o cargo de um Super Administrador.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (!error) {
      fetchProfiles();
    } else {
      alert("Erro ao atualizar permissão: " + error.message);
    }
  };

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string, color: string }> = {
      super_admin: { label: "Super Admin", color: "bg-red-500/20 text-red-400 border-red-500/30" },
      admin: { label: "Administrador", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      commercial: { label: "Comercial / Vendas", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      financial: { label: "Financeiro", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
      logistics: { label: "Logística / Almoxarifado", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      marketing: { label: "Marketing", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
      training: { label: "Treinamentos", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
      support: { label: "Suporte Técnico", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
      client: { label: "Cliente (Portal)", color: "bg-surface border-surface/50 text-text-secondary" },
      student: { label: "Aluno (Academy)", color: "bg-surface border-surface/50 text-text-secondary" },
      subscriber: { label: "Assinante Avulso", color: "bg-surface border-surface/50 text-text-secondary" },
    };

    const config = roles[role] || roles.client;

    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const filteredProfiles = profiles.filter(profile => 
    profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (profile.full_name && profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <ShieldCheck className="text-cs-green" size={20} />
            Gestão de Equipe e Acessos
          </h3>
          <p className="text-xs text-text-secondary mt-1">Defina o nível de permissão de cada usuário cadastrado no sistema.</p>
        </div>
        <button 
          onClick={() => alert("Na próxima fase, este botão enviará um e-mail de convite oficial com link de cadastro.")}
          className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
        >
          <Mail size={18} /> Convidar Usuário
        </button>
      </div>

      <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-surface/50 flex justify-between items-center bg-surface">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <UserCheck className="text-cs-gold" size={18} />
            Usuários Cadastrados
          </h3>
          <div className="relative hidden sm:block w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <input
              type="text"
              placeholder="Buscar por e-mail ou nome..."
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
                <th className="px-6 py-3 font-medium">Usuário / E-mail</th>
                <th className="px-6 py-3 font-medium">Nível de Acesso Atual</th>
                <th className="px-6 py-3 font-medium">Data de Cadastro</th>
                <th className="px-6 py-3 font-medium text-right">Alterar Permissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} /> Carregando usuários...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-secondary">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cs-green/20 border border-cs-green/30 flex items-center justify-center text-cs-green font-bold text-xs uppercase shrink-0">
                          {profile.email.substring(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{profile.full_name || 'Usuário sem nome'}</p>
                          <p className="text-xs mt-0.5">{profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(profile.role)}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={profile.role}
                        onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                        disabled={profile.role === 'super_admin' && currentUserRole !== 'super_admin'}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}