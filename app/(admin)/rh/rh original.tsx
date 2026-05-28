"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  AlertTriangle, Check, ChevronRight, CreditCard,
  DollarSign, Download, Edit, Info, Loader2,
  Plus, Printer, Save, Search, UserPlus, Users,
  UserX, X,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type HRTab = "colaboradores" | "ocorrencias" | "reembolsos" | "folha";

interface Employee {
  id: string;
  profile_id: string | null;  // vínculo com profiles.id para comissões
  full_name: string;
  role_label: string | null;
  contract_type: string | null;
  base_salary: number;
  status: string;
  email: string | null;
  phone: string | null;
  document_cpf: string | null;
  document_rg: string | null;
  birth_date: string | null;
  hiring_date: string | null;
  vt_value: number;
  va_value: number;
  vr_value: number;
  health_plan_value: number;
  dental_plan_value: number;
  insurance_value: number;
  commission_rate: number;
  pix_key: string | null;
  bank_info: Record<string, string> | null;
  address_json: Record<string, string> | null;
}

interface Occurrence {
  id: string;
  employee_id: string;
  type: string;
  description: string;
  occurrence_date: string;
  days_count: number;
  attachment_url: string | null;
  witnesses: string | null;
  created_at: string;
}

interface Reimbursement {
  id: string;
  employee_id: string;
  description: string;
  amount: number;
  status: string;
  receipt_url: string | null;
  quote_id: string | null;
  service_order_id: string | null;
  created_at: string;
  approved_by: string | null;
  rejection_reason: string | null;
  hr_employee_details: { full_name: string };
}

interface Payroll {
  id: string;
  employee_id: string;
  reference_month: number;
  reference_year: number;
  total_base_salary: number;
  total_benefits: number;
  total_commissions: number;
  total_reimbursements: number;
  total_deductions: number;
  inss_deduction: number;
  irrf_deduction: number;
  absence_discount: number;
  absence_days: number;
  final_net_value: number;
  status: string;
  confirmed_at: string | null;
  hr_employee_details: { full_name: string; role_label: string | null };
}

interface Quote {
  id: string;
  title: string;
  final_amount: number;
  status: string;
  commission_reserved_at: string | null;
  commission_reserved_payroll_id: string | null;
}

// Perfil do sistema — usado no dropdown de vínculo de comissão
interface SystemProfile {
  id: string;
  full_name: string;
  email: string;
}

interface Toast { message: string; type: "success" | "error" | "warning" }

// ─── Constantes ───────────────────────────────────────────────────────────────

const BRAZILIAN_BANKS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú" },
  { code: "260", name: "Nubank" },
  { code: "290", name: "PagSeguro" },
  { code: "323", name: "Mercado Pago" },
  { code: "336", name: "C6 Bank" },
  { code: "380", name: "PicPay" },
  { code: "422", name: "Safra" },
  { code: "655", name: "BV (Votorantim)" },
  { code: "041", name: "Banrisul" },
  { code: "748", name: "Sicredi" },
  { code: "756", name: "Sicoob" },
  { code: "077", name: "Inter" },
  { code: "212", name: "Banco Original" },
  { code: "208", name: "BTG Pactual" },
  { code: "070", name: "BRB" },
  { code: "197", name: "Stone" },
  { code: "403", name: "Cora" },
  { code: "102", name: "XP Investimentos" },
  { code: "000", name: "Outro" },
];

const OCCURRENCE_TYPES = [
  { value: "absence",             label: "Falta",           hasDiscount: true,  hasDays: true  },
  { value: "warning",             label: "Advertência",     hasDiscount: false, hasDays: false },
  { value: "suspension",          label: "Suspensão",       hasDiscount: true,  hasDays: true  },
  { value: "medical_certificate", label: "Atestado Médico", hasDiscount: false, hasDays: true  },
  { value: "performance_review",  label: "Avaliação",       hasDiscount: false, hasDays: false },
  { value: "other",               label: "Outro",           hasDiscount: false, hasDays: false },
];

const CONTRACT_TYPES = [
  { value: "clt",        label: "CLT"        },
  { value: "pj",         label: "PJ"         },
  { value: "freelancer", label: "Freelancer" },
  { value: "internship", label: "Estágio"    },
  { value: "temporary",  label: "Temporário" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString("pt-BR", { month: "long" }),
}));

// ─── Cálculos ─────────────────────────────────────────────────────────────────

function calcINSS(s: number) {
  if (s <= 1412.00) return +(s * 0.075).toFixed(2);
  if (s <= 2666.68) return +(s * 0.09).toFixed(2);
  if (s <= 4000.03) return +(s * 0.12).toFixed(2);
  if (s <= 7786.02) return +(s * 0.14).toFixed(2);
  return 908.85;
}

function calcIRRF(b: number) {
  if (b <= 2259.20) return 0;
  if (b <= 2826.65) return +(b * 0.075 - 169.44).toFixed(2);
  if (b <= 3751.05) return +(b * 0.15 - 381.44).toFixed(2);
  if (b <= 4664.68) return +(b * 0.225 - 662.77).toFixed(2);
  return +(b * 0.275 - 896.00).toFixed(2);
}

function calcVTDiscount(salary: number, vt: number) {
  return +Math.min(salary * 0.06, vt).toFixed(2);
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

function fCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/(\d{3})-?(\d{2})$/, "$1-$2");
}

function fPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.length <= 10
    ? d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2")
    : d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function fBRL(v: number) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mName(m: number) {
  return new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" });
}

function sanitize(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

// ─── Componentes base ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={[
      "block w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none",
      "placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)] [color-scheme:dark]",
      props.className].filter(Boolean).join(" ")} />
  );
}

function Sel(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={[
      "block w-full rounded-lg border border-white/10 bg-[var(--color-surface)] px-3 py-2.5 text-sm text-white outline-none",
      "focus:border-[var(--color-cs-green)] disabled:opacity-50", props.className].filter(Boolean).join(" ")} />
  );
}

function Tarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea rows={3} {...props} className={[
      "block w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none",
      "placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)]",
      props.className].filter(Boolean).join(" ")} />
  );
}

function Modal({ title, children, onClose, wide }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12 backdrop-blur-sm">
      <div className={`w-full rounded-2xl border border-white/10 bg-[var(--color-surface)] shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] transition hover:text-white"><X size={18} /></button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:           "border-[var(--color-cs-green)] bg-[var(--color-cs-green)]/10 text-[var(--color-cs-green)]",
    inactive:         "border-zinc-500 bg-zinc-500/10 text-zinc-400",
    pending_approval: "border-[var(--color-cs-gold)] bg-[var(--color-cs-gold)]/10 text-[var(--color-cs-gold)]",
    approved:         "border-[var(--color-cs-green)] bg-[var(--color-cs-green)]/10 text-[var(--color-cs-green)]",
    rejected:         "border-red-500 bg-red-500/10 text-red-400",
    draft:            "border-zinc-500 bg-zinc-500/10 text-zinc-400",
    closed:           "border-blue-500 bg-blue-500/10 text-blue-400",
    paid:             "border-[var(--color-cs-green)] bg-[var(--color-cs-green)]/10 text-[var(--color-cs-green)]",
  };
  const labels: Record<string, string> = {
    active: "Ativo", inactive: "Inativo", pending_approval: "Pendente",
    approved: "Aprovado", rejected: "Rejeitado", draft: "Rascunho",
    closed: "Fechada", paid: "Paga",
  };
  return (
    <span className={`rounded border-l-2 px-2 py-0.5 text-[10px] font-bold ${map[status] ?? "border-white/20 bg-white/5 text-white/40"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function II({ label, value, hi }: { label: string; value: string; hi?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</p>
      <p className={`text-sm font-semibold ${hi ? "text-[var(--color-cs-green)]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function SR({ label, value, red, bold, sub }: { label: string; value: string; red?: boolean; bold?: boolean; sub?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-0.5 ${bold ? "border-t border-white/10 mt-1 pt-2" : ""}`}>
      <span className={`text-xs ${sub ? "pl-3 text-[var(--color-text-secondary)]" : bold ? "font-bold text-white" : "text-[var(--color-text-secondary)]"}`}>{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${red ? "text-red-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

function Spin() {
  return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--color-text-secondary)]" size={28} /></div>;
}

function Empty({ label }: { label: string }) {
  return <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">{label}</div>;
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RHPage() {
  const { systemPreferences, companyProfile } = useSettings();
  const L = systemPreferences?.custom_labels ?? {};
  const labelEquipe = L.menu_team ?? "Equipe";
  const companyName = companyProfile?.company_name ?? "AXON";

  const [tab, setTab]               = useState<HRTab>("colaboradores");
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [occurrences, setOcurrences] = useState<Occurrence[]>([]);
  const [reimbursements, setReimbs] = useState<Reimbursement[]>([]);
  const [payrolls, setPayrolls]     = useState<Payroll[]>([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState("");
  const [toast, setToast]           = useState<Toast | null>(null);

  const [empModal,  setEmpModal]  = useState<"new" | Employee | null>(null);
  const [occModal,  setOccModal]  = useState<Occurrence | "new" | null>(null);
  const [payModal,  setPayModal]  = useState<Payroll | "new" | null>(null);
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);

  const showToast = useCallback((msg: string, type: Toast["type"]) => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const loadEmps = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("hr_employee_details").select("*").order("full_name");
    setEmployees((data ?? []) as Employee[]);
    setLoading(false);
  }, []);

  const loadOccs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("hr_occurrences").select("*").order("occurrence_date", { ascending: false });
    setOcurrences((data ?? []) as Occurrence[]);
    setLoading(false);
  }, []);

  const loadReimbs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("hr_reimbursements").select("*, hr_employee_details(full_name)").order("created_at", { ascending: false });
    setReimbs((data ?? []) as unknown as Reimbursement[]);
    setLoading(false);
  }, []);

  const loadPays = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("hr_payrolls").select("*, hr_employee_details(full_name, role_label)").order("reference_year", { ascending: false }).order("reference_month", { ascending: false });
    setPayrolls((data ?? []) as unknown as Payroll[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "colaboradores") void loadEmps();
    else if (tab === "ocorrencias") { void loadEmps(); void loadOccs(); }
    else if (tab === "reembolsos") void loadReimbs();
    else { void loadEmps(); void loadPays(); }
  }, [tab, loadEmps, loadOccs, loadReimbs, loadPays]);

  async function approveReimb(item: Reimbursement) {
    const { error } = await supabase.from("hr_reimbursements").update({ status: "approved", approved_by: "admin", approved_at: new Date().toISOString() }).eq("id", item.id);
    if (error) { showToast(error.message, "error"); return; }
    await supabase.from("financial_transactions").insert([{
      description: `Reembolso: ${item.description} — ${item.hr_employee_details.full_name}`,
      type: "expense", category: "Reembolsos RH", amount: item.amount, status: "pending",
      due_date: new Date().toISOString().split("T")[0],
      quote_id: item.quote_id, service_order_id: item.service_order_id,
    }]);
    showToast("Aprovado e enviado ao financeiro.", "success");
    void loadReimbs();
  }

  const filtered = useMemo(() =>
    employees.filter(e =>
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.role_label ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.document_cpf ?? "").includes(search)
    ), [employees, search]);

  const occLabel = (v: string) => OCCURRENCE_TYPES.find(t => t.value === v)?.label ?? v;

  return (
    <div className="space-y-6 pb-12">

      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-lg border border-white/10 bg-[var(--color-surface)] px-5 py-3.5 shadow-2xl">
          {toast.type === "success" ? <Check size={16} className="shrink-0 text-[var(--color-cs-green)]" /> : <AlertTriangle size={16} className="shrink-0 text-[var(--color-cs-gold)]" />}
          <span className="text-sm font-semibold text-white">{toast.message}</span>
          <button onClick={() => setToast(null)}><X size={13} className="text-white/30 hover:text-white" /></button>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[var(--color-surface)] p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-[var(--color-cs-green)]" size={20} />
          <div>
            <h3 className="text-base font-bold text-white">Capital Humano</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{companyName} · Gestão de {labelEquipe}</p>
          </div>
        </div>
        <button onClick={() => setEmpModal("new")} className="flex items-center gap-2 rounded-md bg-[var(--color-cs-green)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          <UserPlus size={15} /> Novo colaborador
        </button>
      </div>

      <div className="flex gap-0 overflow-x-auto border-b border-white/10">
        {[
          { id: "colaboradores", label: labelEquipe,          Icon: Users         },
          { id: "ocorrencias",   label: "Ocorrências",        Icon: AlertTriangle },
          { id: "reembolsos",    label: "Reembolsos",         Icon: CreditCard    },
          { id: "folha",         label: "Folha de Pagamento", Icon: DollarSign    },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id as HRTab)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3.5 text-xs font-semibold uppercase tracking-wide transition ${
              tab === id ? "border-[var(--color-cs-green)] text-[var(--color-cs-green)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-white"}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* COLABORADORES */}
      {tab === "colaboradores" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={15} />
            <input type="text" placeholder="Buscar por nome, CPF ou cargo…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-4 py-2.5 text-sm text-white outline-none focus:border-[var(--color-cs-green)]" />
          </div>
          {loading ? <Spin /> : filtered.length === 0 ? <Empty label="Nenhum colaborador cadastrado." /> : (
            <div className="space-y-3">
              {filtered.map(emp => (
                <div key={emp.id} className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[var(--color-surface)] p-5 transition hover:border-white/20 md:flex-row md:items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/30 text-lg font-bold text-[var(--color-cs-green)] border border-white/10">{emp.full_name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{emp.full_name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{emp.role_label ?? "—"} · {emp.contract_type?.toUpperCase() ?? "—"}</p>
                  </div>
                  <div className="hidden items-center gap-8 border-x border-white/10 px-8 lg:flex">
                    <div className="text-center">
                      <p className="text-[9px] font-bold uppercase text-[var(--color-text-secondary)]">Salário</p>
                      <p className="text-sm font-bold text-white">{fBRL(emp.base_salary)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold uppercase text-[var(--color-text-secondary)]">Status</p>
                      <Badge status={emp.status} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDetailEmp(emp)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5">
                      Ficha <ChevronRight size={13} />
                    </button>
                    <button onClick={() => setEmpModal(emp)} className="rounded-lg border border-white/10 bg-black/20 p-2 text-[var(--color-text-secondary)] transition hover:text-white">
                      <Edit size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OCORRÊNCIAS */}
      {tab === "ocorrencias" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">{occurrences.length} registro(s)</p>
            <button onClick={() => setOccModal("new")} className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90">
              <Plus size={14} /> Registrar ocorrência
            </button>
          </div>
          {loading ? <Spin /> : occurrences.length === 0 ? <Empty label="Nenhuma ocorrência registrada." /> : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-5 py-3">Colaborador</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Dias</th>
                    <th className="px-5 py-3">Impacto financeiro</th>
                    <th className="px-5 py-3">Descrição</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {occurrences.map(oc => {
                    const emp = employees.find(e => e.id === oc.employee_id);
                    const ot  = OCCURRENCE_TYPES.find(t => t.value === oc.type);
                    return (
                      <tr key={oc.id} className="cursor-pointer transition hover:bg-white/5" onClick={() => setOccModal(oc)}>
                        <td className="px-5 py-3 font-medium text-white">{emp?.full_name ?? "—"}</td>
                        <td className="px-5 py-3"><span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">{occLabel(oc.type)}</span></td>
                        <td className="px-5 py-3 text-[var(--color-text-secondary)]">{new Date(oc.occurrence_date + "T12:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-5 py-3 text-center text-[var(--color-text-secondary)]">{ot?.hasDays ? (oc.days_count ?? 1) : "—"}</td>
                        <td className="px-5 py-3">
                          {ot?.hasDiscount
                            ? <span className="text-xs font-semibold text-red-400">Desconto na folha</span>
                            : oc.type === "medical_certificate"
                            ? <span className="text-xs text-[var(--color-text-secondary)]">Coberto por atestado</span>
                            : <span className="text-xs text-white/20">—</span>}
                        </td>
                        <td className="px-5 py-3 max-w-[200px] truncate text-[var(--color-text-secondary)]">{oc.description}</td>
                        <td className="px-5 py-3">
                          {oc.attachment_url && (
                            <a href={oc.attachment_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                              <Download size={13} /> Anexo
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REEMBOLSOS */}
      {tab === "reembolsos" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{reimbursements.filter(r => r.status === "pending_approval").length} pendente(s)</p>
          {loading ? <Spin /> : reimbursements.length === 0 ? <Empty label="Nenhum reembolso na fila." /> : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-5 py-3">Colaborador</th>
                    <th className="px-5 py-3">Descrição</th>
                    <th className="px-5 py-3">Centro de custo</th>
                    <th className="px-5 py-3">Valor</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Comprovante</th>
                    <th className="px-5 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reimbursements.map(item => (
                    <tr key={item.id} className="transition hover:bg-white/5">
                      <td className="px-5 py-3 font-medium text-white">{item.hr_employee_details.full_name}</td>
                      <td className="px-5 py-3 max-w-[160px] truncate text-[var(--color-text-secondary)]">{item.description}</td>
                      <td className="px-5 py-3 text-xs text-[var(--color-text-secondary)]">{item.quote_id ? `ORC #${item.quote_id.slice(0,6)}` : item.service_order_id ? `OS #${item.service_order_id.slice(0,6)}` : "—"}</td>
                      <td className="px-5 py-3 font-bold text-[var(--color-cs-green)]">{fBRL(item.amount)}</td>
                      <td className="px-5 py-3"><Badge status={item.status} /></td>
                      <td className="px-5 py-3">{item.receipt_url ? <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline"><Download size={13} /> Ver</a> : <span className="text-xs text-white/20">—</span>}</td>
                      <td className="px-5 py-3 text-right">
                        {item.status === "pending_approval" && (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { const r = prompt("Motivo da rejeição:") ?? ""; void supabase.from("hr_reimbursements").update({ status: "rejected", rejection_reason: r }).eq("id", item.id).then(() => { showToast("Rejeitado.", "warning"); void loadReimbs(); }); }} className="rounded p-1.5 text-red-400 transition hover:bg-red-500/10"><UserX size={15} /></button>
                            <button onClick={() => void approveReimb(item)} className="rounded bg-[var(--color-cs-green)] px-3 py-1.5 text-[10px] font-bold text-white transition hover:opacity-90">Aprovar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FOLHA */}
      {tab === "folha" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">{payrolls.length} folha(s)</p>
            <button onClick={() => setPayModal("new")} className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90">
              <Plus size={14} /> Gerar folha
            </button>
          </div>
          {loading ? <Spin /> : payrolls.length === 0 ? <Empty label="Nenhuma folha gerada." /> : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-5 py-3">Colaborador</th>
                    <th className="px-5 py-3">Competência</th>
                    <th className="px-5 py-3">Salário base</th>
                    <th className="px-5 py-3">Benefícios</th>
                    <th className="px-5 py-3">Descontos</th>
                    <th className="px-5 py-3">Líquido</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payrolls.map(p => (
                    <tr key={p.id} className="cursor-pointer transition hover:bg-white/5" onClick={() => setPayModal(p)}>
                      <td className="px-5 py-3 font-medium text-white">{p.hr_employee_details.full_name}</td>
                      <td className="px-5 py-3 capitalize text-[var(--color-text-secondary)]">{mName(p.reference_month)}/{p.reference_year}</td>
                      <td className="px-5 py-3 text-white">{fBRL(p.total_base_salary)}</td>
                      <td className="px-5 py-3 text-[var(--color-cs-green)]">+{fBRL(p.total_benefits)}</td>
                      <td className="px-5 py-3 text-red-400">-{fBRL(p.total_deductions)}</td>
                      <td className="px-5 py-3 font-bold text-white">{fBRL(p.final_net_value)}</td>
                      <td className="px-5 py-3"><Badge status={p.status} /></td>
                      <td className="px-5 py-3"><button onClick={e => { e.stopPropagation(); setPayModal(p); }} className="rounded border border-white/10 p-1.5 text-[var(--color-text-secondary)] hover:text-white"><Edit size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAIS */}
      {detailEmp && <EmpDetailModal emp={detailEmp} onClose={() => setDetailEmp(null)} onEdit={() => { setDetailEmp(null); setEmpModal(detailEmp); }} />}
      {empModal  !== null && <EmpFormModal initial={empModal === "new" ? null : empModal} onClose={() => setEmpModal(null)} onSaved={() => { setEmpModal(null); void loadEmps(); showToast("Colaborador salvo.", "success"); }} />}
      {occModal  !== null && <OccModal occurrence={occModal === "new" ? null : occModal} employees={employees} onClose={() => setOccModal(null)} onSaved={() => { setOccModal(null); void loadOccs(); showToast("Ocorrência registrada.", "success"); }} showToast={showToast} />}
      {payModal  !== null && <PayModal payroll={payModal === "new" ? null : payModal} employees={employees} companyName={companyName} onClose={() => setPayModal(null)} onSaved={() => { setPayModal(null); void loadPays(); showToast("Folha salva.", "success"); }} showToast={showToast} />}
    </div>
  );
}

// ─── Ficha do colaborador ─────────────────────────────────────────────────────

function EmpDetailModal({ emp, onClose, onEdit }: { emp: Employee; onClose: () => void; onEdit: () => void }) {
  const bankName = BRAZILIAN_BANKS.find(b => b.code === (emp.bank_info as Record<string,string>)?.code)?.name ?? (emp.bank_info as Record<string,string>)?.name ?? "—";
  return (
    <Modal title={emp.full_name} onClose={onClose} wide>
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={onEdit} className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5"><Edit size={13} /> Editar</button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <II label="CPF"         value={emp.document_cpf ?? "—"} />
          <II label="RG"          value={emp.document_rg ?? "—"} />
          <II label="Nascimento"  value={emp.birth_date  ? new Date(emp.birth_date  + "T12:00").toLocaleDateString("pt-BR") : "—"} />
          <II label="Admissão"    value={emp.hiring_date ? new Date(emp.hiring_date + "T12:00").toLocaleDateString("pt-BR") : "—"} />
          <II label="Cargo"       value={emp.role_label ?? "—"} />
          <II label="Contrato"    value={emp.contract_type?.toUpperCase() ?? "—"} />
          <II label="E-mail"      value={emp.email ?? "—"} />
          <II label="Telefone"    value={emp.phone ?? "—"} />
          <II label="Status"      value={emp.status === "active" ? "Ativo" : "Inativo"} />
        </div>
        <div>
          <p className="mb-3 border-b border-white/10 pb-2 text-sm font-bold text-white">Remuneração</p>
          <div className="grid gap-4 md:grid-cols-3">
            <II label="Salário base"      value={fBRL(emp.base_salary)}         hi />
            <II label="Comissão"          value={`${emp.commission_rate ?? 0}%`} />
            <II label="Vale Transporte"   value={fBRL(emp.vt_value)}            />
            <II label="Vale Alimentação"  value={fBRL(emp.va_value)}            />
            <II label="Vale Refeição"     value={fBRL(emp.vr_value ?? 0)}       />
            <II label="Plano de Saúde"    value={fBRL(emp.health_plan_value ?? 0)} />
            <II label="Plano Odonto"      value={fBRL(emp.dental_plan_value ?? 0)} />
            <II label="Seguro de vida"    value={fBRL(emp.insurance_value ?? 0)}   />
          </div>
        </div>
        <div>
          <p className="mb-3 border-b border-white/10 pb-2 text-sm font-bold text-white">Dados bancários</p>
          <div className="grid gap-4 md:grid-cols-3">
            <II label="Banco"   value={bankName} />
            <II label="Agência" value={(emp.bank_info as Record<string,string>)?.agency  ?? "—"} />
            <II label="Conta"   value={(emp.bank_info as Record<string,string>)?.account ?? "—"} />
            <II label="PIX"     value={emp.pix_key ?? "—"} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Formulário colaborador ───────────────────────────────────────────────────

function EmpFormModal({ initial, onClose, onSaved }: { initial: Employee | null; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  // FIX #3: dropdown de profiles para vínculo de comissão
  const [profiles, setProfiles] = useState<SystemProfile[]>([]);

  const [f, setF] = useState({
    full_name: initial?.full_name ?? "", document_cpf: initial?.document_cpf ?? "",
    document_rg: initial?.document_rg ?? "", birth_date: initial?.birth_date ?? "",
    hiring_date: initial?.hiring_date ?? "", email: initial?.email ?? "",
    phone: initial?.phone ?? "", role_label: initial?.role_label ?? "",
    contract_type: initial?.contract_type ?? "clt",
    base_salary: String(initial?.base_salary ?? 0),
    commission_rate: String(initial?.commission_rate ?? 0),
    vt_value: String(initial?.vt_value ?? 0), va_value: String(initial?.va_value ?? 0),
    vr_value: String(initial?.vr_value ?? 0), health_plan_value: String(initial?.health_plan_value ?? 0),
    dental_plan_value: String(initial?.dental_plan_value ?? 0), insurance_value: String(initial?.insurance_value ?? 0),
    pix_key: initial?.pix_key ?? "",
    bank_code: (initial?.bank_info as Record<string,string>)?.code ?? "",
    bank_agency: (initial?.bank_info as Record<string,string>)?.agency ?? "",
    bank_account: (initial?.bank_info as Record<string,string>)?.account ?? "",
    status: initial?.status ?? "active",
    profile_id: initial?.profile_id ?? "",
  });
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  // FIX #3: busca perfis disponíveis para o dropdown de vínculo de comissão
  useEffect(() => {
    void supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name")
      .then(({ data }) => setProfiles((data ?? []) as SystemProfile[]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const bankName = BRAZILIAN_BANKS.find(b => b.code === f.bank_code)?.name ?? "";
    const payload = {
      full_name: f.full_name.trim(), document_cpf: f.document_cpf || null,
      document_rg: f.document_rg || null, birth_date: f.birth_date || null,
      hiring_date: f.hiring_date || null, email: f.email || null, phone: f.phone || null,
      role_label: f.role_label || null, contract_type: f.contract_type,
      base_salary: parseFloat(f.base_salary) || 0, commission_rate: parseFloat(f.commission_rate) || 0,
      vt_value: parseFloat(f.vt_value) || 0, va_value: parseFloat(f.va_value) || 0,
      vr_value: parseFloat(f.vr_value) || 0, health_plan_value: parseFloat(f.health_plan_value) || 0,
      dental_plan_value: parseFloat(f.dental_plan_value) || 0, insurance_value: parseFloat(f.insurance_value) || 0,
      pix_key: f.pix_key || null, status: f.status,
      profile_id: f.profile_id || null,
      bank_info: { code: f.bank_code, name: bankName, agency: f.bank_agency, account: f.bank_account },
    };
    const { error } = initial
      ? await supabase.from("hr_employee_details").update(payload).eq("id", initial.id)
      : await supabase.from("hr_employee_details").insert([payload]);
    setSaving(false);
    if (!error) onSaved(); else console.error(error);
  }

  return (
    <Modal title={initial ? "Editar colaborador" : "Novo colaborador"} onClose={onClose} wide>
      <form onSubmit={e => void submit(e)} className="space-y-6">
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Dados pessoais</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome completo *"><Input required value={f.full_name} onChange={e => s("full_name", e.target.value)} /></Field>
            <Field label="CPF"><Input value={f.document_cpf} onChange={e => s("document_cpf", fCPF(e.target.value))} placeholder="000.000.000-00" /></Field>
            <Field label="RG"><Input value={f.document_rg} onChange={e => s("document_rg", e.target.value)} /></Field>
            <Field label="Data de nascimento"><Input type="date" value={f.birth_date} onChange={e => s("birth_date", e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={f.email} onChange={e => s("email", e.target.value)} /></Field>
            <Field label="Telefone"><Input value={f.phone} onChange={e => s("phone", fPhone(e.target.value))} placeholder="(21) 99999-9999" /></Field>
          </div>
        </section>

        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Vínculo</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cargo"><Input value={f.role_label} onChange={e => s("role_label", e.target.value)} /></Field>
            <Field label="Tipo de contrato"><Sel value={f.contract_type} onChange={e => s("contract_type", e.target.value)}>{CONTRACT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</Sel></Field>
            <Field label="Data de admissão"><Input type="date" value={f.hiring_date} onChange={e => s("hiring_date", e.target.value)} /></Field>
            <Field label="Status"><Sel value={f.status} onChange={e => s("status", e.target.value)}><option value="active">Ativo</option><option value="inactive">Inativo</option></Sel></Field>

            {/* FIX #3: dropdown de profiles em vez de input de UUID livre.
                Vincula o colaborador a um usuário do sistema para que o
                cálculo de comissões use profile_id = quotes.salesperson_id. */}
            <div className="md:col-span-2">
              <Field label="Usuário do sistema (para comissão automática)">
                <Sel value={f.profile_id} onChange={e => s("profile_id", e.target.value)}>
                  <option value="">Nenhum — sem comissão automática</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </option>
                  ))}
                </Sel>
                <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                  Vincula ao usuário que assina orçamentos como responsável comercial.
                  Orçamentos aprovados por esse usuário serão incluídos na folha.
                </p>
              </Field>
            </div>
          </div>
        </section>

        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Remuneração e benefícios</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Salário base (R$)"><Input type="number" min="0" step="0.01" value={f.base_salary} onChange={e => s("base_salary", e.target.value)} /></Field>
            <Field label="Comissão (%)"><Input type="number" min="0" max="100" step="0.1" value={f.commission_rate} onChange={e => s("commission_rate", e.target.value)} /></Field>
            <div>
              <Field label="Vale Transporte (R$)"><Input type="number" min="0" step="0.01" value={f.vt_value} onChange={e => s("vt_value", e.target.value)} /></Field>
              <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">Desconto de 6% do salário aplicado na folha (lei trabalhista).</p>
            </div>
            <Field label="Vale Alimentação (R$)"><Input type="number" min="0" step="0.01" value={f.va_value} onChange={e => s("va_value", e.target.value)} /></Field>
            <Field label="Vale Refeição (R$)"><Input type="number" min="0" step="0.01" value={f.vr_value} onChange={e => s("vr_value", e.target.value)} /></Field>
            <Field label="Plano de Saúde (R$)"><Input type="number" min="0" step="0.01" value={f.health_plan_value} onChange={e => s("health_plan_value", e.target.value)} /></Field>
            <Field label="Plano Odonto (R$)"><Input type="number" min="0" step="0.01" value={f.dental_plan_value} onChange={e => s("dental_plan_value", e.target.value)} /></Field>
            <Field label="Seguro de vida (R$)"><Input type="number" min="0" step="0.01" value={f.insurance_value} onChange={e => s("insurance_value", e.target.value)} /></Field>
          </div>
        </section>

        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Dados bancários</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Banco"><Sel value={f.bank_code} onChange={e => s("bank_code", e.target.value)}><option value="">Selecione</option>{BRAZILIAN_BANKS.map(b => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}</Sel></Field>
            <Field label="Agência"><Input value={f.bank_agency} onChange={e => s("bank_agency", e.target.value)} placeholder="0000" /></Field>
            <Field label="Conta"><Input value={f.bank_account} onChange={e => s("bank_account", e.target.value)} placeholder="00000-0" /></Field>
            <Field label="Chave PIX"><Input value={f.pix_key} onChange={e => s("pix_key", e.target.value)} /></Field>
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:text-white">Cancelar</button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal ocorrência ─────────────────────────────────────────────────────────

function OccModal({ occurrence, employees, onClose, onSaved, showToast }: {
  occurrence: Occurrence | null; employees: Employee[];
  onClose: () => void; onSaved: () => void;
  showToast: (m: string, t: Toast["type"]) => void;
}) {
  const isView = occurrence !== null;
  const [editing, setEditing]   = useState(!isView);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({
    employee_id: occurrence?.employee_id ?? "",
    type: occurrence?.type ?? "warning",
    occurrence_date: occurrence?.occurrence_date ?? new Date().toISOString().slice(0, 10),
    days_count: String(occurrence?.days_count ?? 1),
    description: occurrence?.description ?? "",
    witnesses: occurrence?.witnesses ?? "",
    attachment_url: occurrence?.attachment_url ?? "",
  });
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const emp = employees.find(e => e.id === (occurrence?.employee_id ?? f.employee_id));
  const ot  = OCCURRENCE_TYPES.find(t => t.value === (isView ? occurrence!.type : f.type));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const path = `rh/ocorrencias/${Date.now()}-${sanitize(file.name)}`;
    const { error } = await supabase.storage.from("axon-assets").upload(path, file, { upsert: true });
    if (!error) { const { data } = supabase.storage.from("axon-assets").getPublicUrl(path); s("attachment_url", data.publicUrl); }
    else showToast("Erro no upload.", "error");
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!f.employee_id) return;
    const today = new Date().toISOString().slice(0, 10);
    if (f.occurrence_date > today) { showToast("Não é permitido registrar ocorrências em datas futuras.", "warning"); return; }
    setSaving(true);
    const occType = OCCURRENCE_TYPES.find(t => t.value === f.type);
    const { error } = await supabase.from("hr_occurrences").insert([{
      employee_id: f.employee_id, type: f.type, occurrence_date: f.occurrence_date,
      days_count: occType?.hasDays ? parseInt(f.days_count) || 1 : 1,
      description: f.description,
      witnesses: (f.type === "warning" || f.type === "suspension") ? f.witnesses || null : null,
      attachment_url: f.attachment_url || null,
    }]);
    if (error) { showToast(error.message, "error"); setSaving(false); return; }
    if (occType?.hasDiscount && emp) {
      const days = parseInt(f.days_count) || 1;
      const discount = +((emp.base_salary / 30) * days).toFixed(2);
      await supabase.from("financial_transactions").insert([{
        description: `Desconto suspensão — ${emp.full_name} (${days}d)`,
        type: "expense", category: "Desconto RH",
        amount: discount, status: "pending",
        due_date: new Date().toISOString().split("T")[0],
      }]);
    }
    setSaving(false); onSaved();
  }

  if (isView && !editing) {
    return (
      <Modal title="Ocorrência" onClose={onClose}>
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5"><Edit size={13} /> Editar</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <II label="Colaborador" value={emp?.full_name ?? "—"} />
            <II label="Tipo"        value={ot?.label ?? occurrence!.type} />
            <II label="Data"        value={new Date(occurrence!.occurrence_date + "T12:00").toLocaleDateString("pt-BR")} />
            {ot?.hasDays && <II label="Dias" value={String(occurrence!.days_count ?? 1)} />}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Descrição</p>
            <p className="text-sm text-white">{occurrence!.description}</p>
          </div>
          {occurrence!.witnesses && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Testemunhas</p>
              <p className="text-sm text-white">{occurrence!.witnesses}</p>
            </div>
          )}
          {ot?.hasDiscount && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <Info size={14} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-400">
                Esta ocorrência gerou um desconto de {fBRL(((emp?.base_salary ?? 0) / 30) * (occurrence!.days_count ?? 1))} na folha.
              </p>
            </div>
          )}
          {ot?.value === "medical_certificate" && (
            <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
              <Info size={14} className="mt-0.5 shrink-0 text-[var(--color-text-secondary)]" />
              <p className="text-xs text-[var(--color-text-secondary)]">Falta coberta por atestado médico — sem desconto na folha.</p>
            </div>
          )}
          {occurrence!.attachment_url && (
            <a href={occurrence!.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:underline">
              <Download size={14} /> Ver anexo
            </a>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isView ? "Editar ocorrência" : "Registrar ocorrência"} onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <Field label="Colaborador *">
          <Sel required value={f.employee_id} onChange={e => s("employee_id", e.target.value)}>
            <option value="">Selecione</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
          </Sel>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo *">
            <Sel value={f.type} onChange={e => s("type", e.target.value)}>
              {OCCURRENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Sel>
          </Field>
          <Field label="Data *">
            <Input type="date" required value={f.occurrence_date} max={new Date().toISOString().slice(0,10)} onChange={e => s("occurrence_date", e.target.value)} />
          </Field>
          {OCCURRENCE_TYPES.find(t => t.value === f.type)?.hasDays && (
            <Field label="Qtd. de dias"><Input type="number" min="1" value={f.days_count} onChange={e => s("days_count", e.target.value)} /></Field>
          )}
        </div>
        {OCCURRENCE_TYPES.find(t => t.value === f.type)?.hasDiscount && f.employee_id && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--color-cs-gold)]/20 bg-[var(--color-cs-gold)]/5 p-3">
            <Info size={14} className="mt-0.5 shrink-0 text-[var(--color-cs-gold)]" />
            <p className="text-xs text-[var(--color-cs-gold)]">
              Gerará um desconto de {fBRL(((employees.find(e => e.id === f.employee_id)?.base_salary ?? 0) / 30) * (parseInt(f.days_count) || 1))} na folha.
            </p>
          </div>
        )}
        <Field label="Descrição *"><Tarea required value={f.description} onChange={e => s("description", e.target.value)} /></Field>
        {(f.type === "warning" || f.type === "suspension") && (
          <Field label="Testemunhas"><Input value={f.witnesses} onChange={e => s("witnesses", e.target.value)} placeholder="Nome das testemunhas" /></Field>
        )}
        <Field label="Anexo">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:text-white w-fit">
            {uploading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            {f.attachment_url ? "Arquivo enviado ✓" : "Escolher arquivo"}
            <input type="file" className="hidden" onChange={e => void handleFile(e)} />
          </label>
        </Field>
        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:text-white">Cancelar</button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal folha ──────────────────────────────────────────────────────────────

function PayModal({ payroll, employees, companyName, onClose, onSaved, showToast }: {
  payroll: Payroll | null; employees: Employee[]; companyName: string;
  onClose: () => void; onSaved: () => void;
  showToast: (m: string, t: Toast["type"]) => void;
}) {
  const isView = payroll !== null;
  const [editing, setEditing] = useState(!isView);
  const [saving, setSaving]   = useState(false);
  const [closing, setClosing] = useState(false);
  const [quotes, setQuotes]   = useState<Quote[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const [f, setF] = useState({
    employee_id:          payroll?.employee_id ?? "",
    reference_month:      String(payroll?.reference_month ?? now.getMonth() + 1),
    reference_year:       String(payroll?.reference_year ?? now.getFullYear()),
    total_commissions:    String(payroll?.total_commissions ?? 0),
    total_reimbursements: String(payroll?.total_reimbursements ?? 0),
    absence_days:         String(payroll?.absence_days ?? 0),
  });
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const emp = employees.find(e => e.id === (payroll?.employee_id ?? f.employee_id));

  // FIX #1 + #2: busca orçamentos usando profile_id do colaborador.
  // Inclui tanto orçamentos não reservados (para novas folhas) quanto os já
  // reservados para esta folha específica (para edição/view de folha existente).
  // Antes, o filtro .is("commission_reserved_at", null) excluía os orçamentos
  // reservados, deixando `quotes` vazio ao fechar a folha e zerando as comissões.
  useEffect(() => {
    if (!f.employee_id) { setQuotes([]); return; }
    const currentEmp = employees.find(e => e.id === f.employee_id);
    const profileId  = currentEmp?.profile_id;

    // Sem vínculo de profile_id: não há como calcular comissões automaticamente
    if (!profileId) { setQuotes([]); return; }

    const baseQuery = supabase
      .from("quotes")
      .select("id,title,final_amount,status,commission_reserved_at,commission_reserved_payroll_id")
      .eq("salesperson_id", profileId)   // salesperson_id referencia profiles.id
      .eq("status", "approved")
      .is("commission_paid_at", null);

    // FIX #2: quando há folha existente, inclui orçamentos reservados para ela
    // usando .or() — evita que `quotes` fique vazio no fechamento.
    const fetcher = payroll?.id
      ? baseQuery.or(
          `commission_reserved_at.is.null,commission_reserved_payroll_id.eq.${payroll.id}`
        )
      : baseQuery.is("commission_reserved_at", null);

    void fetcher.then(({ data }) => setQuotes((data ?? []) as Quote[]));
  }, [f.employee_id, employees, payroll?.id]);

  // Auto-preenche comissão com base nos orçamentos encontrados
  useEffect(() => {
    if (!emp || quotes.length === 0) return;
    const total = quotes.reduce(
      (sum, q) => sum + q.final_amount * ((emp.commission_rate ?? 0) / 100),
      0
    );
    s("total_commissions", total.toFixed(2));
  }, [quotes, emp]);

  // Pré-preenche dias de falta com base nas ocorrências do mês
  useEffect(() => {
    if (!f.employee_id || !f.reference_month || !f.reference_year) return;
    const monthStart = `${f.reference_year}-${String(parseInt(f.reference_month)).padStart(2,"0")}-01`;
    const monthEnd   = new Date(parseInt(f.reference_year), parseInt(f.reference_month), 0).toISOString().slice(0,10);
    void supabase.from("hr_occurrences")
      .select("type,days_count,occurrence_date")
      .eq("employee_id", f.employee_id)
      .in("type", ["absence","suspension"])
      .gte("occurrence_date", monthStart)
      .lte("occurrence_date", monthEnd)
      .then(({ data }) => {
        const totalDays = (data ?? []).reduce((sum, oc) => sum + (oc.days_count ?? 1), 0);
        if (totalDays > 0) s("absence_days", String(totalDays));
      });
  }, [f.employee_id, f.reference_month, f.reference_year]);

  const salary      = emp?.base_salary ?? 0;
  const vtDiscount  = emp ? calcVTDiscount(salary, emp.vt_value) : 0;
  const benefits    = emp ? (emp.vt_value + emp.va_value + (emp.vr_value ?? 0) + (emp.health_plan_value ?? 0) + (emp.dental_plan_value ?? 0) + (emp.insurance_value ?? 0)) : 0;
  const absenceDays = parseInt(f.absence_days) || 0;
  const absDiscount = +((salary / 30) * absenceDays).toFixed(2);
  const inss        = calcINSS(salary);
  const irrf        = calcIRRF(salary - inss);
  const commissions = parseFloat(f.total_commissions) || 0;
  const reimbs      = parseFloat(f.total_reimbursements) || 0;
  const totalDeduct = inss + irrf + vtDiscount + absDiscount;
  const netSalary   = salary + benefits + commissions + reimbs - totalDeduct;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!emp) return; setSaving(true);
    const { data: ex } = await supabase.from("hr_payrolls").select("id")
      .eq("employee_id", f.employee_id)
      .eq("reference_month", parseInt(f.reference_month))
      .eq("reference_year", parseInt(f.reference_year))
      .neq("id", payroll?.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    if (ex) { showToast(`Já existe folha para ${mName(parseInt(f.reference_month))}/${f.reference_year} deste colaborador.`, "warning"); setSaving(false); return; }

    const payload = {
      employee_id: f.employee_id, reference_month: parseInt(f.reference_month), reference_year: parseInt(f.reference_year),
      total_base_salary: salary, total_benefits: benefits, total_commissions: commissions,
      total_reimbursements: reimbs, total_deductions: totalDeduct, inss_deduction: inss,
      irrf_deduction: irrf, absence_discount: absDiscount, absence_days: absenceDays,
      final_net_value: netSalary, status: "draft",
    };
    let payrollId = payroll?.id;

    if (payroll) {
      const { error } = await supabase.from("hr_payrolls").update(payload).eq("id", payroll.id);
      if (error) { showToast(error.message, "error"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("hr_payrolls").insert([payload]).select().single();
      if (error) { showToast(error.message, "error"); setSaving(false); return; }
      payrollId = (data as { id: string }).id;
    }

    // Reserva os orçamentos para esta folha — impede duplicação em folhas futuras
    if (quotes.length > 0 && payrollId) {
      const reserveNow = new Date().toISOString();
      await Promise.all(
        quotes
          .filter(q => !q.commission_reserved_at) // só reserva os ainda não reservados
          .map(q =>
            supabase.from("quotes").update({
              commission_reserved_at:         reserveNow,
              commission_reserved_payroll_id: payrollId,
            }).eq("id", q.id)
          )
      );
    }

    setSaving(false);
    onSaved();
  }

  // FIX #1: closePayroll busca os orçamentos reservados diretamente do banco,
  // não usa o state `quotes`. Antes, `quotes` estava vazio no fechamento porque
  // o useEffect filtrava commission_reserved_at = null (orçamentos reservados
  // têm commission_reserved_at preenchido), logo as comissões nunca eram pagas.
  async function closePayroll() {
    if (!payroll) return;
    setClosing(true);
    const closeNow = new Date().toISOString();

    // 1. Fecha a folha
    const { error: e1 } = await supabase
      .from("hr_payrolls")
      .update({ status: "closed", confirmed_at: closeNow })
      .eq("id", payroll.id);
    if (e1) { showToast(e1.message, "error"); setClosing(false); return; }

    // 2. Injeta no financeiro
    await supabase.from("financial_transactions").insert([{
      description: `Folha ${mName(payroll.reference_month)}/${payroll.reference_year} — ${payroll.hr_employee_details.full_name}`,
      type: "expense", category: "Folha de Pagamento", amount: payroll.final_net_value, status: "pending",
      due_date: new Date(payroll.reference_year, payroll.reference_month - 1, 5).toISOString().split("T")[0],
    }]);

    // FIX #1: busca orçamentos reservados para ESTA folha direto do banco
    const commissionedEmp = employees.find(e => e.id === payroll.employee_id);
    const rate = (commissionedEmp?.commission_rate ?? 0) / 100;

    const { data: reservedQuotes } = await supabase
      .from("quotes")
      .select("id, final_amount")
      .eq("commission_reserved_payroll_id", payroll.id)
      .is("commission_paid_at", null);

    if (reservedQuotes && reservedQuotes.length > 0) {
      await Promise.all(
        reservedQuotes.map(q =>
          supabase.from("quotes").update({
            commission_paid_at:             closeNow,
            commission_payroll_id:          payroll.id,
            commission_amount:              +(q.final_amount * rate).toFixed(2),
            // Limpa a reserva — comissão oficialmente paga
            commission_reserved_at:         null,
            commission_reserved_payroll_id: null,
          }).eq("id", q.id)
        )
      );
    }

    const commCount = reservedQuotes?.length ?? 0;
    showToast(
      commCount > 0
        ? `Folha fechada — ${commCount} comissão(ões) liquidada(s).`
        : "Folha fechada.",
      "success"
    );
    setClosing(false);
    onSaved();
  }

  function handlePrint() {
    const el = printRef.current; if (!el) return;
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Contracheque</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:24px}
      .header{border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between}
      .header h2{margin:0;font-size:16px}.header p{margin:2px 0;font-size:11px;color:#555}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #ddd;margin-bottom:12px}
      .col{padding:12px 16px}.col+.col{border-left:1px solid #ddd}
      .section-title{font-size:10px;font-weight:bold;text-transform:uppercase;color:#555;margin-bottom:8px;letter-spacing:.05em}
      .row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid #f0f0f0}
      .row.bold{font-weight:bold;border-top:2px solid #000;border-bottom:none;padding-top:6px;margin-top:4px}
      .row .red{color:#c00}.net{display:flex;justify-content:space-between;background:#f5f5f5;border:2px solid #000;padding:12px 16px;font-size:15px;font-weight:bold}
      @media print{body{padding:0}}
    </style></head><body>${el.innerHTML}</body></html>`);
    win.document.close(); win.focus(); win.print();
  }

  const displayP   = payroll;
  const displayEmp = isView ? employees.find(e => e.id === payroll?.employee_id) : emp;
  const displayVT  = displayEmp ? calcVTDiscount(displayEmp.base_salary, displayEmp.vt_value) : 0;

  if (isView && !editing) {
    return (
      <Modal title="Contracheque" onClose={onClose} wide>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setEditing(true)} disabled={displayP?.status === "closed"}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5 disabled:opacity-40">
              <Edit size={13} /> Editar
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5">
              <Printer size={13} /> Imprimir / PDF
            </button>
            {displayP?.status === "draft" && (
              <button onClick={() => void closePayroll()} disabled={closing}
                className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50">
                {closing ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />} Fechar folha
              </button>
            )}
          </div>

          <div ref={printRef}>
            <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
              <div className="border-b border-white/10 bg-black/30 px-5 py-4 flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-white">{companyName}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">CONTRACHEQUE</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold capitalize text-white">{mName(displayP!.reference_month)}/{displayP!.reference_year}</p>
                  <Badge status={displayP!.status} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-0 border-b border-white/10 px-5 py-3 md:grid-cols-4">
                <II label="Colaborador"  value={displayP!.hr_employee_details.full_name} />
                <II label="Cargo"        value={displayP!.hr_employee_details.role_label ?? "—"} />
                <II label="Salário base" value={fBRL(displayP!.total_base_salary)} />
                {displayP!.absence_days > 0 && <II label="Dias de falta" value={String(displayP!.absence_days)} />}
              </div>
              <div className="grid md:grid-cols-2">
                <div className="border-r border-white/10 p-4 space-y-0.5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-cs-green)]">Proventos</p>
                  <SR label="Salário base" value={fBRL(displayP!.total_base_salary)} />
                  {displayP!.total_commissions > 0    && <SR label="Comissões"       value={fBRL(displayP!.total_commissions)}    sub />}
                  {displayP!.total_reimbursements > 0 && <SR label="Reembolsos"      value={fBRL(displayP!.total_reimbursements)} sub />}
                  {displayEmp && displayEmp.vt_value > 0           && <SR label="Vale Transporte"  value={fBRL(displayEmp.vt_value)}            sub />}
                  {displayEmp && displayEmp.va_value > 0           && <SR label="Vale Alimentação" value={fBRL(displayEmp.va_value)}            sub />}
                  {displayEmp && (displayEmp.vr_value ?? 0) > 0          && <SR label="Vale Refeição"    value={fBRL(displayEmp.vr_value ?? 0)}       sub />}
                  {displayEmp && (displayEmp.health_plan_value ?? 0) > 0 && <SR label="Plano de Saúde"  value={fBRL(displayEmp.health_plan_value ?? 0)} sub />}
                  {displayEmp && (displayEmp.dental_plan_value ?? 0) > 0 && <SR label="Plano Odonto"    value={fBRL(displayEmp.dental_plan_value ?? 0)} sub />}
                  {displayEmp && (displayEmp.insurance_value ?? 0) > 0   && <SR label="Seguro de vida"  value={fBRL(displayEmp.insurance_value ?? 0)}   sub />}
                  <SR label="Total proventos" value={fBRL(displayP!.total_base_salary + displayP!.total_benefits + displayP!.total_commissions + displayP!.total_reimbursements)} bold />
                </div>
                <div className="p-4 space-y-0.5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-red-400">Descontos</p>
                  <SR label="INSS"  value={fBRL(displayP!.inss_deduction)} red />
                  <SR label="IRRF"  value={fBRL(displayP!.irrf_deduction)} red />
                  {displayVT > 0                    && <SR label="VT (6% salário)"           value={fBRL(displayVT)}                   red sub />}
                  {displayP!.absence_days > 0       && <SR label={`Faltas (${displayP!.absence_days}d)`} value={fBRL(displayP!.absence_discount)} red sub />}
                  <SR label="Total descontos" value={fBRL(displayP!.total_deductions)} bold red />
                </div>
              </div>
              <div className="border-t border-[var(--color-cs-green)]/30 bg-[var(--color-cs-green)]/5 px-5 py-4 flex justify-between items-center">
                <span className="font-bold text-white">Salário líquido a receber</span>
                <span className="text-2xl font-black text-[var(--color-cs-green)]">{fBRL(displayP!.final_net_value)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isView ? "Editar folha" : "Gerar folha de pagamento"} onClose={onClose} wide>
      <form onSubmit={e => void submit(e)} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <Field label="Colaborador *">
              <Sel required value={f.employee_id} onChange={e => s("employee_id", e.target.value)}>
                <option value="">Selecione</option>
                {employees.filter(e => e.status === "active").map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </Sel>
            </Field>
          </div>
          <Field label="Mês *"><Sel value={f.reference_month} onChange={e => s("reference_month", e.target.value)}>{MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</Sel></Field>
          <Field label="Ano *"><Input type="number" value={f.reference_year} onChange={e => s("reference_year", e.target.value)} /></Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Field label="Comissões (R$)">
              <Input type="number" min="0" step="0.01" value={f.total_commissions} onChange={e => s("total_commissions", e.target.value)} />
            </Field>
            {emp && !emp.profile_id && (
              <p className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
                <Info size={11} /> Sem vínculo de usuário — comissão não será calculada automaticamente.
              </p>
            )}
            {quotes.length > 0 && (
              <div className="mt-2 rounded-lg border border-white/5 bg-black/20 p-2 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">{quotes.length} orçamento(s)</p>
                {quotes.map(q => (
                  <div key={q.id} className="flex justify-between text-[10px]">
                    <span className="truncate text-[var(--color-text-secondary)]">{q.title}</span>
                    <span className="ml-2 shrink-0 text-[var(--color-cs-green)]">+{fBRL(q.final_amount * ((emp?.commission_rate ?? 0) / 100))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Field label="Reembolsos (R$)"><Input type="number" min="0" step="0.01" value={f.total_reimbursements} onChange={e => s("total_reimbursements", e.target.value)} /></Field>
          <Field label="Dias de falta"><Input type="number" min="0" max="30" value={f.absence_days} onChange={e => s("absence_days", e.target.value)} /></Field>
        </div>

        {emp && (
          <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
            <div className="border-b border-white/10 bg-black/20 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Prévia · {emp.full_name} · {mName(parseInt(f.reference_month))}/{f.reference_year}</p>
            </div>
            <div className="grid md:grid-cols-2">
              <div className="border-r border-white/10 p-4 space-y-0.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-cs-green)]">Proventos</p>
                <SR label="Salário base"    value={fBRL(salary)} />
                {commissions > 0  && <SR label="Comissões"       value={fBRL(commissions)} sub />}
                {reimbs > 0       && <SR label="Reembolsos"      value={fBRL(reimbs)}      sub />}
                {emp.vt_value > 0 && <SR label="Vale Transporte" value={fBRL(emp.vt_value)} sub />}
                {emp.va_value > 0 && <SR label="Vale Alimentação" value={fBRL(emp.va_value)} sub />}
                {(emp.vr_value ?? 0) > 0          && <SR label="Vale Refeição"   value={fBRL(emp.vr_value ?? 0)}         sub />}
                {(emp.health_plan_value ?? 0) > 0 && <SR label="Plano de Saúde" value={fBRL(emp.health_plan_value ?? 0)} sub />}
                {(emp.dental_plan_value ?? 0) > 0 && <SR label="Plano Odonto"   value={fBRL(emp.dental_plan_value ?? 0)} sub />}
                {(emp.insurance_value ?? 0) > 0   && <SR label="Seguro de vida" value={fBRL(emp.insurance_value ?? 0)}   sub />}
                <SR label="Total proventos" value={fBRL(salary + benefits + commissions + reimbs)} bold />
              </div>
              <div className="p-4 space-y-0.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-red-400">Descontos</p>
                <SR label="INSS"  value={fBRL(inss)} red />
                <SR label="IRRF"  value={fBRL(irrf)} red />
                {vtDiscount > 0  && <SR label="VT (6% salário)"      value={fBRL(vtDiscount)}   red sub />}
                {absDiscount > 0 && <SR label={`Faltas (${absenceDays}d)`} value={fBRL(absDiscount)} red sub />}
                <SR label="Total descontos" value={fBRL(totalDeduct)} bold red />
              </div>
            </div>
            <div className="border-t border-[var(--color-cs-green)]/30 bg-[var(--color-cs-green)]/5 px-4 py-3 flex justify-between items-center">
              <span className="text-sm font-bold text-white">Salário líquido</span>
              <span className="text-xl font-black text-[var(--color-cs-green)]">{fBRL(netSalary)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:text-white">Cancelar</button>
          <button type="submit" disabled={saving || !emp} className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}