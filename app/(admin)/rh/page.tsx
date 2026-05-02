"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  Users, UserPlus, Search, DollarSign, Clock, 
  CheckCircle, MoreVertical, Calendar, CreditCard,
  Briefcase, Filter, FileText, AlertTriangle, 
  Stethoscope, UserX, ChevronRight, Download
} from "lucide-react";

// DEFINICAO DE INTERFACES PARA O TYPESCRIPT
interface Employee {
  id: string;
  full_name: string;
  role_label: string;
  contract_type: string;
  base_salary: number;
  status: string;
}

interface Reimbursement {
  id: string;
  employee_id: string;
  description: string;
  amount: number;
  status: string;
  quote_id?: string;
  service_order_id?: string;
  hr_employee_details: {
    full_name: string;
  };
}

type HRTab = "colaboradores" | "ocorrencias" | "reembolsos" | "folha";

export default function RHPage() {
  const { systemPreferences, companyProfile } = useSettings();
  const L = systemPreferences?.custom_labels || {};
  
  const labelEquipe = L.menu_team || "Equipe";
  const labelColaborador = L.entity_member_singular || "Colaborador";

  const [activeTab, setActiveTab] = useState<HRTab>("colaboradores");
  const [members, setMembers] = useState<Employee[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, [activeTab]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      if (activeTab === "colaboradores") {
        const { data, error } = await supabase
          .from('hr_employee_details')
          .select('*')
          .order('full_name');
        if (error) throw error;
        setMembers(data || []);
      } else if (activeTab === "reembolsos") {
        const { data, error } = await supabase
          .from('hr_reimbursements')
          .select('*, hr_employee_details(full_name)')
          .eq('batch_status', 'submitted');
        if (error) throw error;
        setReimbursements(data as unknown as Reimbursement[] || []);
      }
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoading(false);
    }
  }

  const approveReimbursement = async (item: Reimbursement) => {
    const { error: hrError } = await supabase
      .from('hr_reimbursements')
      .update({ status: 'approved' })
      .eq('id', item.id);

    if (hrError) return;

    await supabase.from('financial_transactions').insert([{
      description: `Reembolso: ${item.description} - ${item.hr_employee_details.full_name}`,
      type: 'expense',
      expense_type: 'operational',
      category: 'Reembolsos',
      amount: item.amount,
      status: 'pending',
      due_date: new Date().toISOString().split('T')[0],
      member_id: item.employee_id,
      quote_id: item.quote_id,
      service_order_id: item.service_order_id
    }]);

    alert("Reembolso aprovado e enviado ao financeiro.");
    fetchInitialData();
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.role_label?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [members, searchTerm]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 border border-surface/50 rounded-xl shadow-lg">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Users className="text-cs-green" size={28} /> Capital Humano
          </h3>
          <p className="text-xs text-text-secondary mt-1 uppercase font-semibold tracking-wide">
            {companyProfile?.company_name || "ARXUM"} · Gestão de {labelEquipe}
          </p>
        </div>
        <div className="flex gap-3">
            <button className="bg-white/5 text-white border border-white/10 px-6 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                <FileText size={16} /> Relatórios
            </button>
            <button className="bg-cs-green text-white px-8 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg flex items-center gap-2">
                <UserPlus size={18} /> Novo {labelColaborador}
            </button>
        </div>
      </div>

      <div className="flex gap-0 border-b border-surface/50 overflow-x-auto">
        {[
          { id: "colaboradores", label: labelEquipe, icon: Users },
          { id: "ocorrencias", label: "Ocorrências & Faltas", icon: AlertTriangle },
          { id: "reembolsos", label: "Fila de Reembolsos", icon: CreditCard },
          { id: "folha", label: "Folha de Pagamento", icon: DollarSign },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as HRTab)}
            className={`px-6 py-4 text-xs font-black uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-cs-green text-cs-green bg-cs-green/5"
                : "border-transparent text-text-secondary hover:text-white"
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        
        {activeTab === "colaboradores" && (
          <div className="space-y-4">
            <div className="bg-surface border border-surface/50 p-4 rounded-lg flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                    <input 
                        type="text"
                        placeholder={`Pesquisar por nome, CPF ou cargo...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-background border border-surface rounded-md pl-10 pr-4 py-2 text-sm text-white focus:border-cs-green outline-none transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredMembers.map((member) => (
                <div key={member.id} className="bg-surface border border-surface/50 p-5 rounded-xl flex flex-col md:flex-row justify-between items-center gap-6 hover:border-cs-green/30 transition-all group">
                  <div className="flex items-center gap-5 flex-1">
                    <div className="h-14 w-14 rounded-full bg-cs-darkbg border border-white/5 flex items-center justify-center text-cs-green text-xl font-black shadow-inner">
                      {member.full_name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white leading-tight group-hover:text-cs-green transition-colors">
                        {member.full_name}
                      </h4>
                      <p className="text-[10px] font-black uppercase text-text-secondary mt-1 tracking-widest">
                        {member.role_label} · {member.contract_type.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 px-8 border-x border-white/5 hidden lg:flex">
                    <div className="text-center">
                      <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Salário Base</p>
                      <p className="text-sm font-bold text-white">R$ {member.base_salary?.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Status</p>
                      <span className="text-[10px] font-black uppercase text-cs-green bg-cs-green/10 px-2 py-0.5 rounded">Ativo</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-3 bg-background border border-surface rounded-lg text-text-secondary hover:text-white transition-all">
                      <FileText size={18} />
                    </button>
                    <button className="bg-white text-black px-6 py-2.5 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-cs-green hover:text-white transition-all flex items-center gap-2">
                      Ver Ficha <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "reembolsos" && (
          <div className="bg-surface border border-surface/50 rounded-lg overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-background/50 text-xs uppercase tracking-wide text-text-secondary font-black">
                <tr>
                  <th className="px-6 py-4">Colaborador</th>
                  <th className="px-6 py-4">Descrição / Centro de Custo</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Comprovante</th>
                  <th className="px-6 py-4 text-right">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface/50">
                {reimbursements.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-20 text-center text-text-secondary uppercase font-bold">Nenhum reembolso pendente na fila.</td></tr>
                ) : (
                  reimbursements.map((item) => (
                    <tr key={item.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{item.hr_employee_details.full_name}</td>
                      <td className="px-6 py-4">
                        <p className="text-white">{item.description}</p>
                        <p className="text-[10px] font-black text-cs-gold uppercase">Rastro financeiro ativo</p>
                      </td>
                      <td className="px-6 py-4 font-black text-cs-green">R$ {item.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <button className="flex items-center gap-2 text-xs text-blue-400 hover:underline">
                          <Download size={14} /> Ver Anexo
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-all"><UserX size={18} /></button>
                          <button 
                            onClick={() => approveReimbursement(item)}
                            className="bg-cs-green text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-opacity-80 transition-all"
                          >
                            Aprovar e Pagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {(activeTab === "ocorrencias" || activeTab === "folha") && (
          <div className="bg-surface border border-surface/50 p-20 rounded-xl text-center">
            <Clock size={48} className="mx-auto text-zinc-800 mb-4 animate-pulse" />
            <p className="text-text-secondary uppercase font-black text-sm tracking-widest">
              Módulo em processamento de dados...
            </p>
          </div>
        )}

      </div>
    </div>
  );
}