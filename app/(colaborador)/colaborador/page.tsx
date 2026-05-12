"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Calendar, Check, ChevronRight,
  DollarSign, Download, FileText, Loader2, LogOut,
  Plus, Printer, Upload, User, X,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Company { company_name: string; logo_url: string; primary_color: string }

interface Employee {
  id: string; full_name: string; role_label: string | null;
  email: string | null; phone: string | null; document_cpf: string | null;
  hiring_date: string | null; contract_type: string | null;
  base_salary: number; vt_value: number; va_value: number;
  vr_value: number; health_plan_value: number; dental_plan_value: number;
  insurance_value: number; commission_rate: number;
  pix_key: string | null; bank_info: Record<string, string> | null;
}

interface Payroll {
  id: string; reference_month: number; reference_year: number;
  total_base_salary: number; total_benefits: number; total_commissions: number;
  total_reimbursements: number; total_deductions: number;
  inss_deduction: number; irrf_deduction: number;
  absence_discount: number; absence_days: number;
  final_net_value: number; status: string; confirmed_at: string | null;
}

interface Reimbursement {
  id: string; description: string; amount: number; status: string;
  receipt_url: string | null; created_at: string;
  approved_at: string | null; rejection_reason: string | null;
  quote_id: string | null; service_order_id: string | null;
}

interface Occurrence {
  id: string; type: string; occurrence_date: string;
  days_count: number; description: string; attachment_url: string | null;
}

interface PortalData {
  employee: Employee; payrolls: Payroll[];
  reimbursements: Reimbursement[]; occurrences: Occurrence[];
  company: Company;
}

type Tab = "inicio" | "contracheques" | "reembolsos" | "ocorrencias" | "perfil";
interface Toast { message: string; type: "success" | "error" | "warning" }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fBRL(v: number) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mName(m: number) {
  return new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" });
}

function occLabel(type: string): string {
  const map: Record<string, string> = {
    absence: "Falta", warning: "Advertência", suspension: "Suspensão",
    medical_certificate: "Atestado Médico", performance_review: "Avaliação", other: "Outro",
  };
  return map[type] ?? type;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending_approval: "Aguardando aprovação", approved: "Aprovado",
    rejected: "Rejeitado", draft: "Rascunho", closed: "Fechada", paid: "Paga",
  };
  return map[s] ?? s;
}

function statusColor(s: string): string {
  if (s === "approved" || s === "closed" || s === "paid") return "text-emerald-400";
  if (s === "rejected") return "text-red-400";
  return "text-[#C5A059]";
}

// ─── Upload helper (via API — usa service role) ───────────────────────────────

async function uploadFile(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/portal/upload", { method: "POST", body: fd });
  const data = await res.json() as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Erro no upload.");
  return data.url;
}

// ─── Componentes base ─────────────────────────────────────────────────────────

function SlipRow({ label, value, red, bold, sub }: {
  label: string; value: string; red?: boolean; bold?: boolean; sub?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${bold ? "border-t border-white/10 mt-1 pt-2" : ""}`}>
      <span className={`text-xs ${sub ? "pl-3 text-[#a19d9c]" : bold ? "font-bold text-white" : "text-[#a19d9c]"}`}>{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${red ? "text-red-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#1a1413] p-5 ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1413] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-[#a19d9c] hover:text-white"><X size={18} /></button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ColaboradorPage() {
  const [data, setData]       = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>("inicio");
  const [toast, setToast]     = useState<Toast | null>(null);
  const [payrollModal, setPayrollModal] = useState<Payroll | null>(null);
  const [reimbModal, setReimbModal]     = useState<"new" | null>(null);
  const [occModal, setOccModal]         = useState<Occurrence | "new" | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/me");
      if (!res.ok) { window.location.href = "/colaborador/login"; return; }
      const json = await res.json() as PortalData;
      setData(json);
    } catch {
      window.location.href = "/colaborador/login";
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    window.location.href = "/colaborador/login";
  }

  const primaryColor = data?.company?.primary_color || "#138946";
  const emp = data?.employee;
  const latestPayroll = data?.payrolls?.[0];

  function handlePrint() {
    const el = printRef.current; if (!el) return;
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Contracheque</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:24px}
      .header{border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between}
      .header h2{margin:0;font-size:16px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;padding:12px;background:#f5f5f5;border-radius:6px}
      .meta p{margin:0;font-size:11px}.meta strong{display:block;font-size:10px;text-transform:uppercase;color:#666;margin-bottom:2px}
      .grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ddd}
      .col{padding:12px 16px}.col+.col{border-left:1px solid #ddd}
      .section{font-size:10px;font-weight:bold;text-transform:uppercase;color:#666;margin-bottom:8px}
      .row{display:flex;justify-content:space-between;padding:2px 0;font-size:11px;border-bottom:1px solid #f0f0f0}
      .row.total{font-weight:bold;border-top:2px solid #000;border-bottom:none;padding-top:5px;margin-top:3px}
      .net{display:flex;justify-content:space-between;background:#f0f0f0;padding:12px 16px;font-size:14px;font-weight:bold;margin-top:0;border-top:2px solid #000}
      @media print{body{padding:0}}
    </style></head><body>${el.innerHTML}</body></html>`);
    win.document.close(); win.focus(); win.print();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0807]">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  if (!data || !emp) return null;

  return (
    <div className="min-h-screen bg-[#0d0807] text-white">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-lg border border-white/10 bg-[#1a1413] px-5 py-3.5 shadow-2xl">
          {toast.type === "success" ? <Check size={15} className="text-emerald-400" /> : <AlertTriangle size={15} className="text-[#C5A059]" />}
          <span className="text-sm font-semibold text-white">{toast.message}</span>
          <button onClick={() => setToast(null)}><X size={13} className="text-white/30 hover:text-white" /></button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d0807]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {data.company.logo_url
              ? <img src={data.company.logo_url} alt={data.company.company_name} className="h-8 w-auto object-contain" />
              : <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white" style={{ backgroundColor: primaryColor }}>
                  {data.company.company_name?.charAt(0)}
                </div>}
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-white">{data.company.company_name}</p>
              <p className="text-[10px] text-[#a19d9c]">Portal do Colaborador</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-white">{emp.full_name}</p>
              <p className="text-[10px] text-[#a19d9c]">{emp.role_label ?? "Colaborador"}</p>
            </div>
            <button onClick={() => void handleLogout()}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#a19d9c] transition hover:text-white">
              <LogOut size={13} /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* Abas */}
      <div className="sticky top-[53px] z-30 border-b border-white/10 bg-[#0d0807]">
        <div className="mx-auto flex max-w-4xl overflow-x-auto">
          {([
            { id: "inicio",        label: "Início",        Icon: DollarSign  },
            { id: "contracheques", label: "Contracheques", Icon: FileText    },
            { id: "reembolsos",    label: "Reembolsos",    Icon: Upload      },
            { id: "ocorrencias",   label: "Ocorrências",   Icon: Calendar    },
            { id: "perfil",        label: "Meu Perfil",    Icon: User        },
          ] as { id: Tab; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide transition ${
                tab === id ? "border-current text-white" : "border-transparent text-[#a19d9c] hover:text-white"
              }`}
              style={tab === id ? { borderColor: primaryColor, color: primaryColor } : {}}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTEÚDO ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-4xl space-y-5 p-4 pb-32">

        {/* ── INÍCIO ────────────────────────────────────────────────────── */}
        {tab === "inicio" && (
          <div className="space-y-5">
            <div className="pt-2">
              <p className="text-lg font-bold text-white">Olá, {emp.full_name.split(" ")[0]}</p>
              <p className="text-sm text-[#a19d9c]">{emp.role_label ?? "Colaborador"} · {emp.contract_type?.toUpperCase() ?? "—"}</p>
            </div>

            {latestPayroll ? (
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#a19d9c]">Último contracheque</p>
                  <button onClick={() => setPayrollModal(latestPayroll)}
                    className="flex items-center gap-1 text-xs font-semibold transition hover:underline"
                    style={{ color: primaryColor }}>
                    Ver detalhes <ChevronRight size={12} />
                  </button>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-black text-white">{fBRL(latestPayroll.final_net_value)}</p>
                    <p className="text-xs capitalize text-[#a19d9c]">{mName(latestPayroll.reference_month)}/{latestPayroll.reference_year}</p>
                  </div>
                  <span className={`rounded border-l-2 px-2 py-0.5 text-[10px] font-bold ${
                    latestPayroll.status === "closed" ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : latestPayroll.status === "paid"  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-500 bg-zinc-500/10 text-zinc-400"
                  }`}>{statusLabel(latestPayroll.status)}</span>
                </div>
              </Card>
            ) : (
              <Card>
                <p className="text-center text-sm text-[#a19d9c]">Nenhum contracheque disponível ainda.</p>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Ver contracheques",   icon: FileText,      action: () => setTab("contracheques") },
                { label: "Solicitar reembolso", icon: Upload,        action: () => { setTab("reembolsos"); setReimbModal("new"); } },
                { label: "Enviar atestado",     icon: AlertTriangle, action: () => { setTab("ocorrencias"); setOccModal("new"); } },
                { label: "Meu perfil",          icon: User,          action: () => setTab("perfil") },
              ].map(({ label, icon: Icon, action }) => (
                <button key={label} onClick={action}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#1a1413] p-4 text-center transition hover:border-white/20">
                  <Icon size={20} style={{ color: primaryColor }} />
                  <span className="text-xs font-semibold text-white">{label}</span>
                </button>
              ))}
            </div>

            {data.reimbursements.filter(r => r.status === "pending_approval").length > 0 && (
              <Card>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#a19d9c]">Reembolsos aguardando aprovação</p>
                <div className="space-y-2">
                  {data.reimbursements.filter(r => r.status === "pending_approval").map(r => (
                    <div key={r.id} className="flex items-center justify-between">
                      <p className="text-sm text-white truncate">{r.description}</p>
                      <span className="ml-3 shrink-0 text-sm font-bold" style={{ color: primaryColor }}>{fBRL(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── CONTRACHEQUES ─────────────────────────────────────────────── */}
        {tab === "contracheques" && (
          <div className="space-y-4">
            <p className="text-sm text-[#a19d9c]">{data.payrolls.length} contracheque(s)</p>
            {data.payrolls.length === 0
              ? <Card><p className="text-center text-sm text-[#a19d9c]">Nenhum contracheque disponível.</p></Card>
              : data.payrolls.map(p => (
                <Card key={p.id} className="cursor-pointer hover:border-white/20">
                  <div className="flex items-center justify-between" onClick={() => setPayrollModal(p)}>
                    <div>
                      <p className="font-bold capitalize text-white">{mName(p.reference_month)}/{p.reference_year}</p>
                      <p className="text-xs text-[#a19d9c]">Líquido: <span className="font-bold text-white">{fBRL(p.final_net_value)}</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                      <ChevronRight size={15} className="text-[#a19d9c]" />
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        )}

        {/* ── REEMBOLSOS ────────────────────────────────────────────────── */}
        {tab === "reembolsos" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#a19d9c]">{data.reimbursements.length} solicitação(ões)</p>
              <button onClick={() => setReimbModal("new")}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}>
                <Plus size={14} /> Solicitar reembolso
              </button>
            </div>
            {data.reimbursements.length === 0
              ? <Card><p className="text-center text-sm text-[#a19d9c]">Nenhum reembolso solicitado.</p></Card>
              : data.reimbursements.map(r => (
                <Card key={r.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{r.description}</p>
                      <p className="text-xs text-[#a19d9c]">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                      {r.rejection_reason && <p className="mt-1 text-xs text-red-400">Motivo: {r.rejection_reason}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-white">{fBRL(r.amount)}</p>
                      <p className={`text-xs font-semibold ${statusColor(r.status)}`}>{statusLabel(r.status)}</p>
                    </div>
                  </div>
                  {r.receipt_url && (
                    <a href={r.receipt_url} target="_blank" rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
                      <Download size={12} /> Ver comprovante
                    </a>
                  )}
                </Card>
              ))}
          </div>
        )}

        {/* ── OCORRÊNCIAS ───────────────────────────────────────────────── */}
        {tab === "ocorrencias" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#a19d9c]">{data.occurrences.length} registro(s)</p>
              <button onClick={() => setOccModal("new")}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}>
                <Plus size={14} /> Enviar atestado
              </button>
            </div>
            {data.occurrences.length === 0
              ? <Card><p className="text-center text-sm text-[#a19d9c]">Nenhuma ocorrência registrada.</p></Card>
              : data.occurrences.map(oc => (
                <Card key={oc.id} className="cursor-pointer hover:border-white/20" onClick={() => setOccModal(oc)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{occLabel(oc.type)}</p>
                      <p className="text-xs text-[#a19d9c]">{new Date(oc.occurrence_date + "T12:00").toLocaleDateString("pt-BR")} · {oc.days_count ?? 1} dia(s)</p>
                      <p className="mt-1 text-xs text-[#a19d9c] truncate">{oc.description}</p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-[#a19d9c]" />
                  </div>
                </Card>
              ))}
          </div>
        )}

        {/* ── PERFIL ────────────────────────────────────────────────────── */}
        {tab === "perfil" && (
          <div className="space-y-4">
            <Card>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#a19d9c]">Dados pessoais</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Nome completo", value: emp.full_name },
                  { label: "CPF",           value: emp.document_cpf ?? "—" },
                  { label: "Cargo",         value: emp.role_label ?? "—" },
                  { label: "Contrato",      value: emp.contract_type?.toUpperCase() ?? "—" },
                  { label: "Admissão",      value: emp.hiring_date ? new Date(emp.hiring_date + "T12:00").toLocaleDateString("pt-BR") : "—" },
                  { label: "E-mail",        value: emp.email ?? "—" },
                  { label: "Telefone",      value: emp.phone ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a19d9c]">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#a19d9c]">Remuneração e benefícios</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Salário base",     value: fBRL(emp.base_salary) },
                  { label: "Comissão",         value: `${emp.commission_rate ?? 0}%` },
                  { label: "Vale Transporte",  value: fBRL(emp.vt_value) },
                  { label: "Vale Alimentação", value: fBRL(emp.va_value) },
                  { label: "Vale Refeição",    value: fBRL(emp.vr_value ?? 0) },
                  { label: "Plano de Saúde",   value: fBRL(emp.health_plan_value ?? 0) },
                  { label: "Plano Odonto",     value: fBRL(emp.dental_plan_value ?? 0) },
                  { label: "Seguro de vida",   value: fBRL(emp.insurance_value ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a19d9c]">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#a19d9c]">Dados bancários</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Banco",   value: (emp.bank_info as Record<string, string>)?.name ?? "—" },
                  { label: "Agência", value: (emp.bank_info as Record<string, string>)?.agency ?? "—" },
                  { label: "Conta",   value: (emp.bank_info as Record<string, string>)?.account ?? "—" },
                  { label: "PIX",     value: emp.pix_key ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a19d9c]">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* ── MODAL: CONTRACHEQUE ──────────────────────────────────────────── */}
      {payrollModal && (
        <Modal title="Contracheque" onClose={() => setPayrollModal(null)}>
          <div className="space-y-4">
            <button onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/5">
              <Printer size={13} /> Imprimir / Salvar PDF
            </button>
            <div ref={printRef}>
              <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                <div className="border-b border-white/10 bg-black/30 px-4 py-3 flex justify-between">
                  <div>
                    <p className="font-bold text-white">{data.company.company_name}</p>
                    <p className="text-xs text-[#a19d9c]">CONTRACHEQUE</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold capitalize text-white">{mName(payrollModal.reference_month)}/{payrollModal.reference_year}</p>
                    <p className={`text-xs font-semibold ${statusColor(payrollModal.status)}`}>{statusLabel(payrollModal.status)}</p>
                  </div>
                </div>
                <div className="border-b border-white/10 grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3">
                  <div><p className="text-[10px] text-[#a19d9c] uppercase">Colaborador</p><p className="text-xs font-bold text-white">{emp.full_name}</p></div>
                  <div><p className="text-[10px] text-[#a19d9c] uppercase">Cargo</p><p className="text-xs font-bold text-white">{emp.role_label ?? "—"}</p></div>
                  <div><p className="text-[10px] text-[#a19d9c] uppercase">Salário base</p><p className="text-xs font-bold text-white">{fBRL(payrollModal.total_base_salary)}</p></div>
                </div>
                <div className="grid sm:grid-cols-2">
                  <div className="border-r border-white/10 p-4 space-y-0.5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: primaryColor }}>Proventos</p>
                    <SlipRow label="Salário base" value={fBRL(payrollModal.total_base_salary)} />
                    {payrollModal.total_commissions > 0    && <SlipRow label="Comissões"       value={fBRL(payrollModal.total_commissions)}    sub />}
                    {payrollModal.total_reimbursements > 0 && <SlipRow label="Reembolsos"      value={fBRL(payrollModal.total_reimbursements)} sub />}
                    {emp.vt_value > 0                && <SlipRow label="Vale Transporte"  value={fBRL(emp.vt_value)}               sub />}
                    {emp.va_value > 0                && <SlipRow label="Vale Alimentação" value={fBRL(emp.va_value)}               sub />}
                    {(emp.vr_value ?? 0) > 0         && <SlipRow label="Vale Refeição"    value={fBRL(emp.vr_value ?? 0)}          sub />}
                    {(emp.health_plan_value ?? 0) > 0 && <SlipRow label="Plano de Saúde"  value={fBRL(emp.health_plan_value ?? 0)} sub />}
                    {(emp.dental_plan_value ?? 0) > 0 && <SlipRow label="Plano Odonto"    value={fBRL(emp.dental_plan_value ?? 0)} sub />}
                    {(emp.insurance_value ?? 0) > 0   && <SlipRow label="Seguro de vida"  value={fBRL(emp.insurance_value ?? 0)}   sub />}
                    <SlipRow label="Total proventos" value={fBRL(payrollModal.total_base_salary + payrollModal.total_benefits + payrollModal.total_commissions + payrollModal.total_reimbursements)} bold />
                  </div>
                  <div className="p-4 space-y-0.5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-red-400">Descontos</p>
                    <SlipRow label="INSS" value={fBRL(payrollModal.inss_deduction)} red />
                    <SlipRow label="IRRF" value={fBRL(payrollModal.irrf_deduction)} red />
                    {payrollModal.absence_days > 0 && <SlipRow label={`Faltas (${payrollModal.absence_days}d)`} value={fBRL(payrollModal.absence_discount)} red sub />}
                    <SlipRow label="Total descontos" value={fBRL(payrollModal.total_deductions)} bold red />
                  </div>
                </div>
                <div className="border-t px-4 py-4 flex justify-between items-center"
                  style={{ borderColor: primaryColor + "50", backgroundColor: primaryColor + "0D" }}>
                  <span className="font-bold text-white">Salário líquido a receber</span>
                  <span className="text-2xl font-black" style={{ color: primaryColor }}>{fBRL(payrollModal.final_net_value)}</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: SOLICITAR REEMBOLSO ───────────────────────────────────── */}
      {reimbModal === "new" && (
        <ReimbursementModal
          primaryColor={primaryColor}
          onClose={() => setReimbModal(null)}
          onSaved={() => { setReimbModal(null); void fetchData(); showToast("Reembolso solicitado com sucesso.", "success"); }}
          showToast={showToast}
        />
      )}

      {/* ── MODAL: OCORRÊNCIA ────────────────────────────────────────────── */}
      {occModal !== null && (
        <OccurrenceModal
          occurrence={occModal === "new" ? null : occModal}
          primaryColor={primaryColor}
          onClose={() => setOccModal(null)}
          onSaved={() => { setOccModal(null); void fetchData(); showToast("Registrado com sucesso.", "success"); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ─── Modal: Solicitar reembolso ───────────────────────────────────────────────

function ReimbursementModal({ primaryColor, onClose, onSaved, showToast }: {
  primaryColor: string;
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string, t: Toast["type"]) => void;
}) {
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({
    description: "", amount: "", quote_id: "", receipt_url: "",
  });
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, "rh/reembolsos");
      s("receipt_url", url);
    } catch {
      showToast("Erro no upload do comprovante.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.description || !f.amount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/portal/reembolso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description:  f.description,
          amount:       parseFloat(f.amount) || 0,
          quote_id:     f.quote_id || null,
          receipt_url:  f.receipt_url || null,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) { showToast(data.error ?? "Erro ao solicitar.", "error"); return; }
      onSaved();
    } catch {
      showToast("Erro de conexão.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Solicitar reembolso" onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Descrição *</label>
          <input required value={f.description} onChange={e => s("description", e.target.value)}
            placeholder="Ex: Combustível para entrega OS #123"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#a19d9c]" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Valor (R$) *</label>
          <input required type="number" min="0" step="0.01" value={f.amount} onChange={e => s("amount", e.target.value)}
            placeholder="0,00"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#a19d9c]" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Orçamento / OS relacionado</label>
          <input value={f.quote_id} onChange={e => s("quote_id", e.target.value)}
            placeholder="ID do orçamento ou OS (opcional)"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#a19d9c]" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Comprovante</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[#a19d9c] transition hover:text-white w-fit">
            {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            {f.receipt_url ? "Arquivo enviado ✓" : "Enviar comprovante"}
            <input type="file" className="hidden" onChange={e => void handleFile(e)} />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[#a19d9c] transition hover:text-white">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}>
            {saving ? <Loader2 className="animate-spin" size={15} /> : null} Solicitar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal: Ocorrência / Atestado ─────────────────────────────────────────────

function OccurrenceModal({ occurrence, primaryColor, onClose, onSaved, showToast }: {
  occurrence: Occurrence | null;
  primaryColor: string;
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string, t: Toast["type"]) => void;
}) {
  const isView = occurrence !== null;
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [f, setF] = useState({
    type: "medical_certificate",
    occurrence_date: new Date().toISOString().slice(0, 10),
    days_count: "1",
    description: "",
    attachment_url: "",
  });
  const s = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, "rh/atestados");
      s("attachment_url", url);
    } catch {
      showToast("Erro no upload.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/portal/ocorrencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:            f.type,
          occurrence_date: f.occurrence_date,
          days_count:      parseInt(f.days_count) || 1,
          description:     f.description,
          attachment_url:  f.attachment_url || null,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) { showToast(data.error ?? "Erro ao registrar.", "error"); return; }
      onSaved();
    } catch {
      showToast("Erro de conexão.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (isView) {
    return (
      <Modal title={occLabel(occurrence.type)} onClose={onClose}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-[10px] uppercase text-[#a19d9c]">Tipo</p><p className="text-sm font-semibold text-white">{occLabel(occurrence.type)}</p></div>
            <div><p className="text-[10px] uppercase text-[#a19d9c]">Data</p><p className="text-sm font-semibold text-white">{new Date(occurrence.occurrence_date + "T12:00").toLocaleDateString("pt-BR")}</p></div>
            <div><p className="text-[10px] uppercase text-[#a19d9c]">Dias</p><p className="text-sm font-semibold text-white">{occurrence.days_count ?? 1}</p></div>
          </div>
          <div><p className="text-[10px] uppercase text-[#a19d9c]">Descrição</p><p className="text-sm text-white">{occurrence.description}</p></div>
          {occurrence.attachment_url && (
            <a href={occurrence.attachment_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-400 hover:underline">
              <Download size={14} /> Ver anexo
            </a>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Enviar atestado / comunicar ausência" onClose={onClose}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Tipo</label>
          <select value={f.type} onChange={e => s("type", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#1a1413] px-3 py-2.5 text-sm text-white outline-none">
            <option value="medical_certificate">Atestado Médico</option>
            <option value="absence">Falta</option>
            <option value="other">Outro</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Data *</label>
            <input type="date" required value={f.occurrence_date} max={new Date().toISOString().slice(0, 10)}
              onChange={e => s("occurrence_date", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark]" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Dias</label>
            <input type="number" min="1" value={f.days_count} onChange={e => s("days_count", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">Descrição *</label>
          <textarea required rows={3} value={f.description} onChange={e => s("description", e.target.value)}
            placeholder="Descreva brevemente o motivo…"
            className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#a19d9c]" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#a19d9c]">
            {f.type === "medical_certificate" ? "Atestado (obrigatório)" : "Anexo (opcional)"}
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[#a19d9c] transition hover:text-white w-fit">
            {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            {f.attachment_url ? "Arquivo enviado ✓" : "Enviar arquivo"}
            <input type="file" className="hidden" onChange={e => void handleFile(e)} />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-[#a19d9c] transition hover:text-white">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}>
            {saving ? <Loader2 className="animate-spin" size={15} /> : null} Enviar
          </button>
        </div>
      </form>
    </Modal>
  );
}