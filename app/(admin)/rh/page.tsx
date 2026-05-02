"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/app/lib/supabase";
import { useSettings } from "@/app/providers/SettingsProvider";
import {
  AlertTriangle,
  Banknote,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Filter,
  Heart,
  Loader2,
  MoreVertical,
  Plus,
  Save,
  Search,
  Stethoscope,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type HRTab = "colaboradores" | "ocorrencias" | "reembolsos" | "folha";

interface Employee {
  id: string;
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
  created_by: string | null;
  created_at: string;
}

interface Reimbursement {
  id: string;
  employee_id: string;
  description: string;
  amount: number;
  status: string;
  batch_status: string;
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

interface Toast { message: string; type: "success" | "error" | "warning" }

// ─── Formatadores ─────────────────────────────────────────────────────────────

function formatCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2")
          .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.length <= 10
    ? d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2")
    : d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthName(m: number) {
  return new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" });
}

// Tabela INSS 2024 simplificada (progressiva)
function calcINSS(salary: number): number {
  if (salary <= 1412.00) return salary * 0.075;
  if (salary <= 2666.68) return salary * 0.09;
  if (salary <= 4000.03) return salary * 0.12;
  if (salary <= 7786.02) return salary * 0.14;
  return 908.85; // teto
}

// Tabela IRRF 2024 simplificada
function calcIRRF(base: number): number {
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return base * 0.075 - 169.44;
  if (base <= 3751.05) return base * 0.15 - 381.44;
  if (base <= 4664.68) return base * 0.225 - 662.77;
  return base * 0.275 - 896.00;
}

const OCCURRENCE_TYPES = [
  { value: "absence",      label: "Falta"           },
  { value: "warning",      label: "Advertência"     },
  { value: "suspension",   label: "Suspensão"       },
  { value: "medical_cert", label: "Atestado Médico" },
  { value: "evaluation",   label: "Avaliação"       },
  { value: "vacation",     label: "Férias"          },
];

const CONTRACT_TYPES = [
  { value: "clt",         label: "CLT"            },
  { value: "pj",          label: "PJ"             },
  { value: "freelancer",  label: "Freelancer"     },
  { value: "internship",  label: "Estágio"        },
  { value: "temporary",   label: "Temporário"     },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthName(i + 1) }));

// ─── Componentes auxiliares ───────────────────────────────────────────────────

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
    <input
      {...props}
      className={[
        "block w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none",
        "placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)]",
        props.className,
      ].filter(Boolean).join(" ")}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "block w-full rounded-lg border border-white/10 bg-[var(--color-surface)] px-3 py-2.5 text-sm text-white outline-none",
        "focus:border-[var(--color-cs-green)] disabled:opacity-50",
        props.className,
      ].filter(Boolean).join(" ")}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={[
        "block w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none",
        "placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-cs-green)]",
        props.className,
      ].filter(Boolean).join(" ")}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-4 border-b border-white/10 pb-2 text-sm font-bold text-white">{children}</h4>;
}

function StatusBadge({ status }: { status: string }) {
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
    active: "Ativo", inactive: "Inativo",
    pending_approval: "Pendente", approved: "Aprovado", rejected: "Rejeitado",
    draft: "Rascunho", closed: "Fechada", paid: "Paga",
  };
  return (
    <span className={`rounded border-l-2 px-2 py-0.5 text-[10px] font-bold ${map[status] ?? "border-white/20 bg-white/5 text-white/40"}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RHPage() {
  const { systemPreferences, companyProfile } = useSettings();
  const L = systemPreferences?.custom_labels ?? {};
  const labelEquipe = L.menu_team ?? "Equipe";
  const labelColaborador = "Colaborador";
  const companyName = companyProfile?.company_name ?? "AXON";

  const [tab, setTab]           = useState<HRTab>("colaboradores");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");
  const [toast, setToast]       = useState<Toast | null>(null);

  // Modais
  const [employeeModal, setEmployeeModal] = useState<"new" | Employee | null>(null);
  const [occurrenceModal, setOccurrenceModal] = useState<string | null>(null); // employee_id
  const [payrollModal, setPayrollModal] = useState<string | null>(null); // employee_id
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("hr_employee_details").select("*").order("full_name");
    setEmployees((data ?? []) as Employee[]);
    setLoading(false);
  }, []);

  const fetchOccurrences = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hr_occurrences")
      .select("*")
      .order("occurrence_date", { ascending: false });
    setOccurrences((data ?? []) as Occurrence[]);
    setLoading(false);
  }, []);

  const fetchReimbursements = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hr_reimbursements")
      .select("*, hr_employee_details(full_name)")
      .order("created_at", { ascending: false });
    setReimbursements((data ?? []) as unknown as Reimbursement[]);
    setLoading(false);
  }, []);

  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hr_payrolls")
      .select("*, hr_employee_details(full_name, role_label)")
      .order("reference_year", { ascending: false })
      .order("reference_month", { ascending: false });
    setPayrolls((data ?? []) as unknown as Payroll[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "colaboradores") void fetchEmployees();
    else if (tab === "ocorrencias") { void fetchEmployees(); void fetchOccurrences(); }
    else if (tab === "reembolsos") void fetchReimbursements();
    else if (tab === "folha") { void fetchEmployees(); void fetchPayrolls(); }
  }, [tab, fetchEmployees, fetchOccurrences, fetchReimbursements, fetchPayrolls]);

  // ── Approve reimbursement ─────────────────────────────────────────────────

  async function approveReimbursement(item: Reimbursement) {
    const { error: e1 } = await supabase
      .from("hr_reimbursements")
      .update({ status: "approved", approved_by: "admin", approved_at: new Date().toISOString() })
      .eq("id", item.id);
    if (e1) { showToast(e1.message, "error"); return; }

    const { error: e2 } = await supabase.from("financial_transactions").insert([{
      description: `Reembolso: ${item.description} — ${item.hr_employee_details.full_name}`,
      type: "expense",
      category: "Reembolsos RH",
      amount: item.amount,
      status: "pending",
      due_date: new Date().toISOString().split("T")[0],
      quote_id: item.quote_id,
      service_order_id: item.service_order_id,
    }]);
    if (e2) { showToast("Reembolso aprovado, mas erro ao criar transação financeira.", "warning"); }
    else showToast("Aprovado e enviado ao financeiro.", "success");
    void fetchReimbursements();
  }

  async function rejectReimbursement(id: string, reason: string) {
    await supabase.from("hr_reimbursements").update({ status: "rejected", rejection_reason: reason }).eq("id", id);
    showToast("Reembolso rejeitado.", "warning");
    void fetchReimbursements();
  }

  // ── Filtered ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() =>
    employees.filter((e) =>
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.role_label ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.document_cpf ?? "").includes(search)
    ), [employees, search]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-12">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-lg border border-white/10 bg-[var(--color-surface)] px-5 py-3.5 shadow-2xl">
          {toast.type === "success" ? <Check size={16} className="shrink-0 text-[var(--color-cs-green)]" /> : <AlertTriangle size={16} className="shrink-0 text-[var(--color-cs-gold)]" />}
          <span className="text-sm font-semibold text-white">{toast.message}</span>
          <button onClick={() => setToast(null)}><X size={13} className="text-white/30 hover:text-white" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[var(--color-surface)] p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-[var(--color-cs-green)]" size={22} />
          <div>
            <h3 className="text-lg font-bold text-white">Capital Humano</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{companyName} · Gestão de {labelEquipe}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setEmployeeModal("new")}
            className="flex items-center gap-2 rounded-md bg-[var(--color-cs-green)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <UserPlus size={15} /> Novo {labelColaborador}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-0 overflow-x-auto border-b border-white/10">
        {[
          { id: "colaboradores", label: labelEquipe,           icon: Users        },
          { id: "ocorrencias",   label: "Ocorrências",         icon: AlertTriangle },
          { id: "reembolsos",    label: "Fila de Reembolsos",  icon: CreditCard   },
          { id: "folha",         label: "Folha de Pagamento",  icon: DollarSign   },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as HRTab)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3.5 text-xs font-semibold uppercase tracking-wide transition ${
              tab === id
                ? "border-[var(--color-cs-green)] text-[var(--color-cs-green)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-white"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ══ COLABORADORES ══════════════════════════════════════════════════════ */}
      {tab === "colaboradores" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={15} />
              <input
                type="text"
                placeholder="Buscar por nome, CPF ou cargo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-4 py-2.5 text-sm text-white outline-none focus:border-[var(--color-cs-green)]"
              />
            </div>
          </div>

          {loading
            ? <Spinner />
            : filtered.length === 0
            ? <Empty label="Nenhum colaborador cadastrado." />
            : (
              <div className="space-y-3">
                {filtered.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[var(--color-surface)] p-5 transition hover:border-white/20 md:flex-row md:items-center"
                  >
                    {/* Avatar */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 text-lg font-bold text-[var(--color-cs-green)]">
                      {emp.full_name.charAt(0)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{emp.full_name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {emp.role_label ?? "—"} · {emp.contract_type?.toUpperCase() ?? "—"}
                      </p>
                    </div>

                    {/* Dados financeiros */}
                    <div className="hidden items-center gap-8 border-x border-white/10 px-8 lg:flex">
                      <div className="text-center">
                        <p className="text-[9px] font-bold uppercase text-[var(--color-text-secondary)]">Salário</p>
                        <p className="text-sm font-bold text-white">{formatBRL(emp.base_salary)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-bold uppercase text-[var(--color-text-secondary)]">Status</p>
                        <StatusBadge status={emp.status} />
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDetailEmployee(emp)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                      >
                        Ficha <ChevronRight size={13} />
                      </button>
                      <button
                        onClick={() => setEmployeeModal(emp)}
                        className="rounded-lg border border-white/10 bg-black/20 p-2 text-[var(--color-text-secondary)] transition hover:text-white"
                      >
                        <MoreVertical size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ══ OCORRÊNCIAS ════════════════════════════════════════════════════════ */}
      {tab === "ocorrencias" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">{occurrences.length} registro(s)</p>
            <button
              onClick={() => setOccurrenceModal("new")}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
            >
              <Plus size={14} /> Registrar ocorrência
            </button>
          </div>

          {loading ? <Spinner /> : occurrences.length === 0 ? <Empty label="Nenhuma ocorrência registrada." /> : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-5 py-3">Colaborador</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Dias</th>
                    <th className="px-5 py-3">Descrição</th>
                    <th className="px-5 py-3">Anexo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {occurrences.map((oc) => {
                    const emp = employees.find((e) => e.id === oc.employee_id);
                    const typeLabel = OCCURRENCE_TYPES.find((t) => t.value === oc.type)?.label ?? oc.type;
                    return (
                      <tr key={oc.id} className="transition hover:bg-white/5">
                        <td className="px-5 py-3 font-medium text-white">{emp?.full_name ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">{typeLabel}</span>
                        </td>
                        <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                          {new Date(oc.occurrence_date).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-5 py-3 text-center text-[var(--color-text-secondary)]">{oc.days_count}</td>
                        <td className="px-5 py-3 max-w-xs truncate text-[var(--color-text-secondary)]">{oc.description}</td>
                        <td className="px-5 py-3">
                          {oc.attachment_url
                            ? <a href={oc.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline"><Download size={13} /> Ver</a>
                            : <span className="text-xs text-white/20">—</span>}
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

      {/* ══ REEMBOLSOS ═════════════════════════════════════════════════════════ */}
      {tab === "reembolsos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {reimbursements.filter((r) => r.status === "pending_approval").length} pendente(s)
            </p>
          </div>

          {loading ? <Spinner /> : reimbursements.length === 0 ? <Empty label="Nenhum reembolso na fila." /> : (
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
                  {reimbursements.map((item) => (
                    <tr key={item.id} className="transition hover:bg-white/5">
                      <td className="px-5 py-3 font-medium text-white">{item.hr_employee_details.full_name}</td>
                      <td className="px-5 py-3 max-w-[180px] truncate text-[var(--color-text-secondary)]">{item.description}</td>
                      <td className="px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                        {item.quote_id ? `OS #${item.quote_id.slice(0, 6)}` : item.service_order_id ? `OS #${item.service_order_id.slice(0, 6)}` : "—"}
                      </td>
                      <td className="px-5 py-3 font-bold text-[var(--color-cs-green)]">{formatBRL(item.amount)}</td>
                      <td className="px-5 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-5 py-3">
                        {item.receipt_url
                          ? <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline"><Download size={13} /> Ver</a>
                          : <span className="text-xs text-white/20">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {item.status === "pending_approval" && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { const r = prompt("Motivo da rejeição (opcional):") ?? ""; void rejectReimbursement(item.id, r); }}
                              className="rounded p-1.5 text-red-400 transition hover:bg-red-500/10"
                            ><UserX size={15} /></button>
                            <button
                              onClick={() => void approveReimbursement(item)}
                              className="rounded bg-[var(--color-cs-green)] px-3 py-1.5 text-[10px] font-bold text-white transition hover:opacity-90"
                            >Aprovar</button>
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

      {/* ══ FOLHA DE PAGAMENTO ═════════════════════════════════════════════════ */}
      {tab === "folha" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">{payrolls.length} folha(s) gerada(s)</p>
            <button
              onClick={() => setPayrollModal("new")}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
            >
              <Plus size={14} /> Gerar folha
            </button>
          </div>

          {loading ? <Spinner /> : payrolls.length === 0 ? <Empty label="Nenhuma folha gerada ainda." /> : (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payrolls.map((p) => (
                    <tr key={p.id} className="transition hover:bg-white/5">
                      <td className="px-5 py-3 font-medium text-white">{p.hr_employee_details.full_name}</td>
                      <td className="px-5 py-3 text-[var(--color-text-secondary)] capitalize">{monthName(p.reference_month)}/{p.reference_year}</td>
                      <td className="px-5 py-3 text-white">{formatBRL(p.total_base_salary)}</td>
                      <td className="px-5 py-3 text-[var(--color-cs-green)]">+{formatBRL(p.total_benefits)}</td>
                      <td className="px-5 py-3 text-red-400">-{formatBRL(p.total_deductions)}</td>
                      <td className="px-5 py-3 font-bold text-white">{formatBRL(p.final_net_value)}</td>
                      <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL: FICHA DO COLABORADOR ════════════════════════════════════════ */}
      {detailEmployee && (
        <Modal title={detailEmployee.full_name} onClose={() => setDetailEmployee(null)} wide>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoItem label="CPF"            value={detailEmployee.document_cpf ?? "—"} />
              <InfoItem label="RG"             value={detailEmployee.document_rg ?? "—"} />
              <InfoItem label="Nascimento"     value={detailEmployee.birth_date ? new Date(detailEmployee.birth_date).toLocaleDateString("pt-BR") : "—"} />
              <InfoItem label="Admissão"       value={detailEmployee.hiring_date ? new Date(detailEmployee.hiring_date).toLocaleDateString("pt-BR") : "—"} />
              <InfoItem label="Cargo"          value={detailEmployee.role_label ?? "—"} />
              <InfoItem label="Contrato"       value={detailEmployee.contract_type?.toUpperCase() ?? "—"} />
              <InfoItem label="E-mail"         value={detailEmployee.email ?? "—"} />
              <InfoItem label="Telefone"       value={detailEmployee.phone ?? "—"} />
            </div>

            <div>
              <SectionTitle>Remuneração</SectionTitle>
              <div className="grid gap-4 md:grid-cols-3">
                <InfoItem label="Salário base"    value={formatBRL(detailEmployee.base_salary)} highlight />
                <InfoItem label="Comissão"        value={`${detailEmployee.commission_rate ?? 0}%`} />
                <InfoItem label="Vale Transporte" value={formatBRL(detailEmployee.vt_value)} />
                <InfoItem label="Vale Alimentação" value={formatBRL(detailEmployee.va_value)} />
                <InfoItem label="Vale Refeição"   value={formatBRL(detailEmployee.vr_value ?? 0)} />
                <InfoItem label="Plano de Saúde"  value={formatBRL(detailEmployee.health_plan_value ?? 0)} />
                <InfoItem label="Plano Odonto"    value={formatBRL(detailEmployee.dental_plan_value ?? 0)} />
                <InfoItem label="Seguro de vida"  value={formatBRL(detailEmployee.insurance_value ?? 0)} />
              </div>
            </div>

            <div>
              <SectionTitle>Dados bancários</SectionTitle>
              <div className="grid gap-4 md:grid-cols-3">
                <InfoItem label="Banco"   value={(detailEmployee.bank_info as Record<string,string>)?.name ?? "—"} />
                <InfoItem label="Agência" value={(detailEmployee.bank_info as Record<string,string>)?.agency ?? "—"} />
                <InfoItem label="Conta"   value={(detailEmployee.bank_info as Record<string,string>)?.account ?? "—"} />
                <InfoItem label="PIX"     value={detailEmployee.pix_key ?? "—"} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: NOVO / EDITAR COLABORADOR ═══════════════════════════════════ */}
      {employeeModal !== null && (
        <EmployeeFormModal
          initial={employeeModal === "new" ? null : employeeModal}
          onClose={() => setEmployeeModal(null)}
          onSaved={() => { setEmployeeModal(null); void fetchEmployees(); showToast("Colaborador salvo.", "success"); }}
        />
      )}

      {/* ══ MODAL: REGISTRAR OCORRÊNCIA ════════════════════════════════════════ */}
      {occurrenceModal !== null && (
        <OccurrenceFormModal
          employees={employees}
          onClose={() => setOccurrenceModal(null)}
          onSaved={() => { setOccurrenceModal(null); void fetchOccurrences(); showToast("Ocorrência registrada.", "success"); }}
        />
      )}

      {/* ══ MODAL: GERAR FOLHA ═════════════════════════════════════════════════ */}
      {payrollModal !== null && (
        <PayrollFormModal
          employees={employees}
          onClose={() => setPayrollModal(null)}
          onSaved={() => { setPayrollModal(null); void fetchPayrolls(); showToast("Folha gerada.", "success"); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ─── Modal base ───────────────────────────────────────────────────────────────

function Modal({ title, children, onClose, wide }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16 backdrop-blur-sm">
      <div className={`w-full rounded-2xl border border-white/10 bg-[var(--color-surface)] shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] transition hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-[var(--color-cs-green)]" : "text-white"}`}>{value}</p>
    </div>
  );
}

// ─── Modal: Formulário de Colaborador ────────────────────────────────────────

function EmployeeFormModal({ initial, onClose, onSaved }: {
  initial: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({
    full_name:          initial?.full_name ?? "",
    document_cpf:       initial?.document_cpf ?? "",
    document_rg:        initial?.document_rg ?? "",
    birth_date:         initial?.birth_date ?? "",
    hiring_date:        initial?.hiring_date ?? "",
    email:              initial?.email ?? "",
    phone:              initial?.phone ?? "",
    role_label:         initial?.role_label ?? "",
    contract_type:      initial?.contract_type ?? "clt",
    base_salary:        String(initial?.base_salary ?? "0"),
    commission_rate:    String(initial?.commission_rate ?? "0"),
    vt_value:           String(initial?.vt_value ?? "0"),
    va_value:           String(initial?.va_value ?? "0"),
    vr_value:           String(initial?.vr_value ?? "0"),
    health_plan_value:  String(initial?.health_plan_value ?? "0"),
    dental_plan_value:  String(initial?.dental_plan_value ?? "0"),
    insurance_value:    String(initial?.insurance_value ?? "0"),
    pix_key:            initial?.pix_key ?? "",
    bank_name:          (initial?.bank_info as Record<string,string>)?.name ?? "",
    bank_agency:        (initial?.bank_info as Record<string,string>)?.agency ?? "",
    bank_account:       (initial?.bank_info as Record<string,string>)?.account ?? "",
    status:             initial?.status ?? "active",
  });

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // Payload base — somente colunas que existiam no schema original
    const basePayload = {
      full_name:     form.full_name.trim(),
      document_cpf:  form.document_cpf || null,
      document_rg:   form.document_rg || null,
      birth_date:    form.birth_date || null,
      hiring_date:   form.hiring_date || null,
      contract_type: form.contract_type,
      base_salary:   parseFloat(form.base_salary) || 0,
      vt_value:      parseFloat(form.vt_value) || 0,
      va_value:      parseFloat(form.va_value) || 0,
      pix_key:       form.pix_key || null,
      status:        form.status,
      // bank_info é JSONB e sempre existiu — guarda tudo como fallback
      bank_info: {
        name:              form.bank_name,
        agency:            form.bank_agency,
        account:           form.bank_account,
        email:             form.email,
        phone:             form.phone,
        role_label:        form.role_label,
        commission_rate:   parseFloat(form.commission_rate) || 0,
        vr_value:          parseFloat(form.vr_value) || 0,
        health_plan_value: parseFloat(form.health_plan_value) || 0,
        dental_plan_value: parseFloat(form.dental_plan_value) || 0,
        insurance_value:   parseFloat(form.insurance_value) || 0,
      },
    };

    // Payload estendido — inclui colunas adicionadas pela migration
    const extendedPayload = {
      ...basePayload,
      email:             form.email || null,
      phone:             form.phone || null,
      role_label:        form.role_label || null,
      commission_rate:   parseFloat(form.commission_rate) || 0,
      vr_value:          parseFloat(form.vr_value) || 0,
      health_plan_value: parseFloat(form.health_plan_value) || 0,
      dental_plan_value: parseFloat(form.dental_plan_value) || 0,
      insurance_value:   parseFloat(form.insurance_value) || 0,
    };

    let error;
    if (initial) {
      ({ error } = await supabase.from("hr_employee_details").update(extendedPayload).eq("id", initial.id));
      if (error) ({ error } = await supabase.from("hr_employee_details").update(basePayload).eq("id", initial.id));
    } else {
      ({ error } = await supabase.from("hr_employee_details").insert([extendedPayload]));
      if (error) ({ error } = await supabase.from("hr_employee_details").insert([basePayload]));
    }

    setSaving(false);
    if (!error) onSaved();
    else console.error("Erro ao salvar colaborador:", error);
  }

  return (
    <Modal title={initial ? "Editar colaborador" : "Novo colaborador"} onClose={onClose} wide>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Dados pessoais</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome completo *">
              <Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <Field label="CPF">
              <Input value={form.document_cpf} onChange={(e) => set("document_cpf", formatCPF(e.target.value))} placeholder="000.000.000-00" />
            </Field>
            <Field label="RG">
              <Input value={form.document_rg} onChange={(e) => set("document_rg", e.target.value)} />
            </Field>
            <Field label="Data de nascimento">
              <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} className="[color-scheme:dark]" />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Telefone">
              <Input value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(21) 99999-9999" />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Vínculo contratual</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cargo">
              <Input value={form.role_label} onChange={(e) => set("role_label", e.target.value)} />
            </Field>
            <Field label="Tipo de contrato">
              <Select value={form.contract_type} onChange={(e) => set("contract_type", e.target.value)}>
                {CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Data de admissão">
              <Input type="date" value={form.hiring_date} onChange={(e) => set("hiring_date", e.target.value)} className="[color-scheme:dark]" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Remuneração e benefícios</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Salário base (R$)">
              <Input type="number" min="0" step="0.01" value={form.base_salary} onChange={(e) => set("base_salary", e.target.value)} />
            </Field>
            <Field label="Comissão (%)">
              <Input type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={(e) => set("commission_rate", e.target.value)} />
            </Field>
            <Field label="Vale Transporte (R$)">
              <Input type="number" min="0" step="0.01" value={form.vt_value} onChange={(e) => set("vt_value", e.target.value)} />
            </Field>
            <Field label="Vale Alimentação (R$)">
              <Input type="number" min="0" step="0.01" value={form.va_value} onChange={(e) => set("va_value", e.target.value)} />
            </Field>
            <Field label="Vale Refeição (R$)">
              <Input type="number" min="0" step="0.01" value={form.vr_value} onChange={(e) => set("vr_value", e.target.value)} />
            </Field>
            <Field label="Plano de Saúde (R$)">
              <Input type="number" min="0" step="0.01" value={form.health_plan_value} onChange={(e) => set("health_plan_value", e.target.value)} />
            </Field>
            <Field label="Plano Odonto (R$)">
              <Input type="number" min="0" step="0.01" value={form.dental_plan_value} onChange={(e) => set("dental_plan_value", e.target.value)} />
            </Field>
            <Field label="Seguro de vida (R$)">
              <Input type="number" min="0" step="0.01" value={form.insurance_value} onChange={(e) => set("insurance_value", e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Dados bancários</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Banco">
              <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
            </Field>
            <Field label="Agência">
              <Input value={form.bank_agency} onChange={(e) => set("bank_agency", e.target.value)} />
            </Field>
            <Field label="Conta">
              <Input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} />
            </Field>
            <Field label="Chave PIX">
              <Input value={form.pix_key} onChange={(e) => set("pix_key", e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:text-white">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal: Registrar Ocorrência ─────────────────────────────────────────────

function OccurrenceFormModal({ employees, onClose, onSaved }: {
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm]         = useState({
    employee_id:     "",
    type:            "absence",
    occurrence_date: new Date().toISOString().slice(0, 10),
    days_count:      "1",
    description:     "",
    witnesses:       "",
    attachment_url:  "",
  });

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `rh/ocorrencias/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("axon-assets").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("axon-assets").getPublicUrl(path);
      set("attachment_url", data.publicUrl);
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    if (form.occurrence_date > today) { alert("Não é permitido registrar ocorrências em datas futuras."); setSaving(false); return; }

    const { error } = await supabase.from("hr_occurrences").insert([{
      employee_id:     form.employee_id,
      type:            form.type,
      occurrence_date: form.occurrence_date,
      days_count:      parseInt(form.days_count) || 1,
      description:     form.description,
      witnesses:       form.witnesses || null,
      attachment_url:  form.attachment_url || null,
    }]);
    setSaving(false);
    if (!error) onSaved();
  }

  const needsWitnesses = form.type === "warning" || form.type === "suspension";

  return (
    <Modal title="Registrar ocorrência" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Field label="Colaborador *">
          <Select required value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)}>
            <option value="">Selecione</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo *">
            <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
              {OCCURRENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Data (máx. hoje) *">
            <Input type="date" required value={form.occurrence_date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("occurrence_date", e.target.value)} className="[color-scheme:dark]" />
          </Field>
          {(form.type === "absence" || form.type === "suspension" || form.type === "medical_cert") && (
            <Field label="Qtd. de dias">
              <Input type="number" min="1" value={form.days_count} onChange={(e) => set("days_count", e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Descrição *">
          <Textarea required value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        {needsWitnesses && (
          <Field label="Testemunhas">
            <Input value={form.witnesses} onChange={(e) => set("witnesses", e.target.value)} placeholder="Nome das testemunhas, se houver" />
          </Field>
        )}
        <Field label="Anexo (atestado, termo, etc.)">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:text-white">
              {uploading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
              {form.attachment_url ? "Arquivo enviado ✓" : "Escolher arquivo"}
              <input type="file" className="hidden" onChange={(e) => void handleFile(e)} />
            </label>
          </div>
        </Field>
        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:text-white">Cancelar</button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal: Gerar Folha ───────────────────────────────────────────────────────

function PayrollFormModal({ employees, onClose, onSaved, showToast }: {
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string, t: Toast["type"]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({
    employee_id:      "",
    reference_month:  String(now.getMonth() + 1),
    reference_year:   String(now.getFullYear()),
    total_commissions:    "0",
    total_reimbursements: "0",
    absence_days:     "0",
    other_discounts:  "0",
  });

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  const emp = employees.find((e) => e.id === form.employee_id);

  // Cálculo automático
  const benefits     = emp ? (emp.vt_value + emp.va_value + (emp.vr_value ?? 0) + (emp.health_plan_value ?? 0) + (emp.dental_plan_value ?? 0) + (emp.insurance_value ?? 0)) : 0;
  const absenceDays  = parseInt(form.absence_days) || 0;
  const dailyRate    = emp ? emp.base_salary / 30 : 0;
  const absDiscount  = dailyRate * absenceDays;
  const inss         = emp ? calcINSS(emp.base_salary) : 0;
  const irrf         = emp ? calcIRRF(emp.base_salary - inss) : 0;
  const totalDeduct  = inss + irrf + absDiscount + (parseFloat(form.other_discounts) || 0);
  const netSalary    = emp
    ? emp.base_salary + benefits + (parseFloat(form.total_commissions) || 0) + (parseFloat(form.total_reimbursements) || 0) - totalDeduct
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emp) return;
    setSaving(true);

    const payload = {
      employee_id:          form.employee_id,
      reference_month:      parseInt(form.reference_month),
      reference_year:       parseInt(form.reference_year),
      total_base_salary:    emp.base_salary,
      total_benefits:       benefits,
      total_commissions:    parseFloat(form.total_commissions) || 0,
      total_reimbursements: parseFloat(form.total_reimbursements) || 0,
      total_deductions:     totalDeduct,
      inss_deduction:       inss,
      irrf_deduction:       irrf,
      absence_discount:     absDiscount,
      absence_days:         absenceDays,
      final_net_value:      netSalary,
      status:               "draft",
    };

    const { data: payrollData, error: e1 } = await supabase
      .from("hr_payrolls")
      .insert([payload])
      .select()
      .single();

    if (e1) { showToast(e1.message, "error"); setSaving(false); return; }

    // Injeta no financeiro
    const { error: e2 } = await supabase.from("financial_transactions").insert([{
      description: `Folha ${monthName(parseInt(form.reference_month))}/${form.reference_year} — ${emp.full_name}`,
      type: "expense",
      category: "Folha de Pagamento",
      amount: netSalary,
      status: "pending",
      due_date: new Date(parseInt(form.reference_year), parseInt(form.reference_month) - 1, 5).toISOString().split("T")[0],
    }]);

    if (e2) showToast("Folha gerada, mas erro ao criar transação financeira.", "warning");

    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Gerar folha de pagamento" onClose={onClose} wide>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <Field label="Colaborador *">
              <Select required value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)}>
                <option value="">Selecione</option>
                {employees.filter((e) => e.status === "active").map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Mês *">
            <Select value={form.reference_month} onChange={(e) => set("reference_month", e.target.value)}>
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Ano *">
            <Input type="number" value={form.reference_year} onChange={(e) => set("reference_year", e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Comissões (R$)">
            <Input type="number" min="0" step="0.01" value={form.total_commissions} onChange={(e) => set("total_commissions", e.target.value)} />
          </Field>
          <Field label="Reembolsos aprovados (R$)">
            <Input type="number" min="0" step="0.01" value={form.total_reimbursements} onChange={(e) => set("total_reimbursements", e.target.value)} />
          </Field>
          <Field label="Dias de falta">
            <Input type="number" min="0" max="30" value={form.absence_days} onChange={(e) => set("absence_days", e.target.value)} />
          </Field>
          <Field label="Outros descontos (R$)">
            <Input type="number" min="0" step="0.01" value={form.other_discounts} onChange={(e) => set("other_discounts", e.target.value)} />
          </Field>
        </div>

        {/* Prévia */}
        {emp && (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Prévia do contracheque</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
              <PreviewRow label="Salário base"    value={formatBRL(emp.base_salary)} />
              <PreviewRow label="Benefícios"      value={`+ ${formatBRL(benefits)}`} green />
              <PreviewRow label="Comissões"       value={`+ ${formatBRL(parseFloat(form.total_commissions) || 0)}`} green />
              <PreviewRow label="Reembolsos"      value={`+ ${formatBRL(parseFloat(form.total_reimbursements) || 0)}`} green />
              <PreviewRow label="Desc. faltas"    value={`- ${formatBRL(absDiscount)}`} red />
              <PreviewRow label="INSS"            value={`- ${formatBRL(inss)}`} red />
              <PreviewRow label="IRRF"            value={`- ${formatBRL(irrf)}`} red />
              <PreviewRow label="Outros descontos" value={`- ${formatBRL(parseFloat(form.other_discounts) || 0)}`} red />
            </div>
            <div className="mt-3 border-t border-white/10 pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-white">Líquido a receber</span>
              <span className="text-lg font-black text-[var(--color-cs-green)]">{formatBRL(netSalary)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:text-white">Cancelar</button>
          <button type="submit" disabled={saving || !emp}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-cs-green)] px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Gerar folha
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PreviewRow({ label, value, green, red }: { label: string; value: string; green?: boolean; red?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <span className={`text-xs font-semibold ${green ? "text-[var(--color-cs-green)]" : red ? "text-red-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--color-text-secondary)]" size={28} /></div>;
}

function Empty({ label }: { label: string }) {
  return <div className="py-16 text-center text-sm text-[var(--color-text-secondary)]">{label}</div>;
}