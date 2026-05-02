"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  Users, UserPlus, Search, DollarSign, Clock, 
  CheckCircle, MoreVertical, Calendar, CreditCard,
  Briefcase, Filter, FileText, AlertTriangle, 
  UserX, ChevronRight, Download, Trash2, X, Plus,
  FileCheck, ShieldCheck, Percent, MapPin
} from "lucide-react";

// --- INTERFACES TÉCNICAS ---
interface Employee {
  id: string;
  full_name: string;
  document_cpf: string;
  role_label: string;
  contract_type: 'clt' | 'pj' | 'freelancer' | 'socio';
  base_salary: number;
  vt_value: number;
  va_value: number;
  status: string;
  hiring_date: string;
  pix_key: string;
}

interface Occurrence {
  id: string;
  employee_id: string;
  type: 'warning' | 'suspension' | 'medical_certificate' | 'lack' | 'performance_review';
  description: string;
  occurrence_date: string;
  attachment_url?: string;
  hr_employee_details?: { full_name: string };
}

interface Reimbursement {
  id: string;
  employee_id: string;
  description: string;
  amount: number;
  status: 'pending_approval' | 'approved' | 'rejected' | 'paid';
  quote_id?: string;
  service_order_id?: string;
  receipt_url?: string;
  hr_employee_details: { full_name: string };
}

type HRTab = "colaboradores" | "ocorrencias" | "reembolsos" | "folha";

export default function RHPage() {
  const { systemPreferences, companyProfile } = useSettings();
  const labels = systemPreferences?.custom_labels || {};
  const companyId = companyProfile?.id;

  const [activeTab, setActiveTab] = useState<HRTab>("colaboradores");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // States de Dados Reais
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);

  // States de Modais
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddOccurrenceOpen, setIsAddOccurrenceOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (companyId) fetchAllHRData();
  }, [companyId, activeTab]);

  async function fetchAllHRData() {
    setLoading(true);
    try {
      if (activeTab === "colaboradores") {
        const { data } = await supabase.from('hr_employee_details').select('*').eq('company_id', companyId).order('full_name');
        setEmployees(data || []);
      } 
      else if (activeTab === "ocorrencias") {
        const { data } = await supabase.from('hr_occurrences').select('*, hr_employee_details(full_name)').eq('company_id', companyId).order('occurrence_date', { ascending: false });
        setOccurrences(data || []);
      }
      else if (activeTab === "reembolsos") {
        const { data } = await supabase.from('hr_reimbursements').select('*, hr_employee_details(full_name)').eq('company_id', companyId).eq('batch_status', 'submitted');
        setReimbursements(data || []);
      }
    } catch (err) {
      console.error("Erro ARXUM RH:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- LÓGICA DE NEGÓCIO: LANÇAR FALTA/OCORRÊNCIA ---
  const handleAddOccurrence = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const payload = {
      employee_id: formData.get('employee_id'),
      company_id: companyId,
      type: formData.get('type'),
      description: formData.get('description'),
      occurrence_date: formData.get('date'),
    };

    const { error } = await supabase.from('hr_occurrences').insert([payload]);
    if (!error) {
      setIsAddOccurrenceOpen(false);
      fetchAllHRData();
    }
  };

  // --- LÓGICA DE NEGÓCIO: APROVAR REEMBOLSO COM RASTRO ---
  const handleApproveReimbursement = async (item: Reimbursement) => {
    const { error } = await supabase.rpc('approve_reimbursement_v2', {
      reimb_id: item.id,
      comp_id: companyId,
      target_amount: item.amount,
      desc: `Reembolso: ${item.description} - ${item.hr_employee_details.full_name}`
    });

    if (!error) {
      alert("Reembolso aprovado e integrado ao financeiro.");
      fetchAllHRData();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* HEADER ESTRUTURAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 border border-surface/50 rounded-xl shadow-lg">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Users className="text-cs-green" size={28} /> Capital Humano
          </h3>
          <p className="text-xs text-text-secondary mt-1 uppercase font-semibold tracking-wide">
            {companyProfile?.company_name || "ARXUM"} · Gestão de {labels.menu_team || "Equipe"}
          </p>
        </div>
        <div className="flex gap-3">
            <button 
              onClick={() => setIsAddOccurrenceOpen(true)}
              className="bg-white/5 text-white border border-white/10 px-6 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                <AlertTriangle size={16} className="text-cs-gold" /> Lançar Ocorrência
            </button>
            <button 
              onClick={() => setIsAddEmployeeOpen(true)}
              className="bg-cs-green text-white px-8 py-3 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg flex items-center gap-2">
                <UserPlus size={18} /> Novo Registro
            </button>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO REAL */}
      <div className="flex gap-0 border-b border-surface/50 overflow-x-auto">
        {[
          { id: "colaboradores", label: labels.menu_team || "Colaboradores", icon: Users },
          { id: "ocorrencias", label: "Histórico & Faltas", icon: FileText },
          { id: "reembolsos", label: "Fila de Reembolsos", icon: CreditCard },
          { id: "folha", label: "Folha de Pagamento", icon: DollarSign },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as HRTab)}
            className={`px-6 py-4 text-xs font-black uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id ? "border-cs-green text-cs-green bg-cs-green/5" : "border-transparent text-text-secondary hover:text-white"
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* CONTEÚDO DINÂMICO POR ABA */}
      <div className="min-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Clock className="animate-spin text-cs-green" size={40} />
            <p className="text-xs font-black uppercase text-text-secondary tracking-widest">Sincronizando base de dados...</p>
          </div>
        ) : (
          <>
            {/* LISTA DE COLABORADORES */}
            {activeTab === "colaboradores" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {employees.map(emp => (
                  <div key={emp.id} className="bg-surface border border-surface/50 p-6 rounded-2xl hover:border-cs-green/40 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${emp.status === 'active' ? 'bg-cs-green/10 text-cs-green' : 'bg-red-500/10 text-red-500'}`}>
                        {emp.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-12 w-12 rounded-full bg-cs-darkbg border border-white/5 flex items-center justify-center text-cs-green font-black text-xl">
                        {emp.full_name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white group-hover:text-cs-green transition-colors">{emp.full_name}</h4>
                        <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{emp.role_label} · {emp.contract_type}</p>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-white/5 pt-4">
                      <div className="flex justify-between text-[11px] uppercase font-bold">
                        <span className="text-text-secondary">Salário Base</span>
                        <span className="text-white">R$ {emp.base_salary.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] uppercase font-bold">
                        <span className="text-text-secondary">Benefícios (VT/VA)</span>
                        <span className="text-cs-gold">R$ {(emp.vt_value + emp.va_value).toLocaleString()}</span>
                      </div>
                    </div>
                    <button className="w-full mt-6 bg-white/5 hover:bg-cs-green hover:text-white text-text-secondary py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                      Acessar Ficha Completa
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* LISTA DE OCORRÊNCIAS (Faltas, Atestados, etc) */}
            {activeTab === "ocorrencias" && (
              <div className="bg-surface border border-surface/50 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-background/50 text-[10px] uppercase font-black text-text-secondary">
                    <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Colaborador</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">Descrição</th>
                      <th className="px-6 py-4 text-right">Anexo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface/50">
                    {occurrences.map(occ => (
                      <tr key={occ.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 text-white font-medium">{new Date(occ.occurrence_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-white font-bold">{occ.hr_employee_details?.full_name}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
                            occ.type === 'lack' ? 'bg-red-500/10 text-red-500' : 
                            occ.type === 'warning' ? 'bg-cs-gold/10 text-cs-gold' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {occ.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-text-secondary text-xs">{occ.description}</td>
                        <td className="px-6 py-4 text-right">
                          {occ.attachment_url && <Download size={16} className="ml-auto text-cs-green cursor-pointer" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FILA DE REEMBOLSOS */}
            {activeTab === "reembolsos" && (
              <div className="grid grid-cols-1 gap-4">
                {reimbursements.map(reimb => (
                  <div key={reimb.id} className="bg-surface border border-surface/50 p-5 rounded-xl flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-cs-green/10 rounded-lg text-cs-green"><CreditCard size={20} /></div>
                      <div>
                        <h4 className="font-bold text-white">{reimb.description}</h4>
                        <p className="text-[10px] font-black text-text-secondary uppercase">{reimb.hr_employee_details.full_name} · OS Vinculada</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-text-secondary uppercase">Valor Solicitado</p>
                        <p className="text-lg font-black text-cs-green">R$ {reimb.amount.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-red-500/10 text-red-500 rounded-md transition-all"><Trash2 size={18} /></button>
                        <button 
                          onClick={() => handleApproveReimbursement(reimb)}
                          className="bg-white text-black px-6 py-2 rounded font-black text-[10px] uppercase tracking-widest hover:bg-cs-green hover:text-white transition-all">
                          Aprovar Pagamento
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL LANÇAR OCORRÊNCIA (FUNCIONAL) */}
      {isAddOccurrenceOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface border border-surface/50 w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Lançar Ocorrência</h3>
              <button onClick={() => setIsAddOccurrenceOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddOccurrence} className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-text-secondary block mb-2">Colaborador</label>
                <select name="employee_id" required className="w-full bg-background border border-surface rounded-md p-3 text-sm outline-none focus:border-cs-green">
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-text-secondary block mb-2">Tipo</label>
                  <select name="type" className="w-full bg-background border border-surface rounded-md p-3 text-sm outline-none focus:border-cs-green">
                    <option value="lack">Falta</option>
                    <option value="warning">Advertência</option>
                    <option value="medical_certificate">Atestado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-text-secondary block mb-2">Data</label>
                  <input type="date" name="date" required className="w-full bg-background border border-surface rounded-md p-3 text-sm outline-none focus:border-cs-green" style={{colorScheme: 'dark'}} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-text-secondary block mb-2">Observações</label>
                <textarea name="description" rows={3} className="w-full bg-background border border-surface rounded-md p-3 text-sm outline-none focus:border-cs-green resize-none"></textarea>
              </div>
              <button type="submit" className="w-full bg-cs-green py-4 rounded-md font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all">Gravar no Histórico</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}