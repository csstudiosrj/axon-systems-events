"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  PlaySquare,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type Role = "client_gestor" | "client_comercial" | "client_financeiro" | "client_operador";

interface Profile {
  id: string;
  full_name: string | null;
  role: Role | string | null;
  client_id: string | null;
}

interface KpiData {
  openTickets: number;
  pendingInvoices: number;
  activeInvoices: number;
  pendingQuotes: number;
}

interface ActivityItem {
  id: string;
  kind: "ticket" | "invoice" | "quote";
  title: string;
  status: string;
  date: string;
}

const MODULE_ACCESS: Record<string, Role[]> = {
  orcamentos: ["client_gestor", "client_comercial"],
  faturas:    ["client_gestor", "client_financeiro"],
  suporte:    ["client_gestor", "client_comercial", "client_financeiro"],
  academy:    ["client_gestor", "client_operador"],
  ajuda:      ["client_gestor", "client_comercial", "client_financeiro", "client_operador"],
};

function canAccess(role: string | null, module: string): boolean {
  if (!role) return false;
  return (MODULE_ACCESS[module] ?? []).includes(role as Role);
}

const TICKET_LABELS: Record<string, string> = {
  open:        "Aberto",
  in_progress: "Em andamento",
  resolved:    "Resolvido",
  closed:      "Fechado",
};

const INVOICE_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid:    "Pago",
  active:  "Ativo",
  overdue: "Vencido",
};

const QUOTE_LABELS: Record<string, string> = {
  pending:  "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
  draft:    "Rascunho",
};

function statusColor(status: string): string {
  switch (status) {
    case "resolved": case "closed": case "paid": case "approved":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "in_progress": case "active":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "overdue": case "rejected":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function PortalHomePage() {
  const [loading, setLoading]   = useState(true);
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [company, setCompany]   = useState<string | null>(null);
  const [kpis, setKpis]         = useState<KpiData>({ openTickets: 0, pendingInvoices: 0, activeInvoices: 0, pendingQuotes: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: p } = await supabase
          .from("profiles")
          .select("id, full_name, role, client_id")
          .eq("id", session.user.id)
          .single();

        if (!p) return;
        setProfile(p as Profile);

        if (p.client_id) {
          const { data: c } = await supabase
            .from("clients")
            .select("company_name")
            .eq("id", p.client_id)
            .single();
          setCompany(c?.company_name ?? null);

          const [ticketsRes, invoicesRes, quotesRes] = await Promise.all([
            supabase.from("tickets")
              .select("id, status", { count: "exact" })
              .eq("client_id", p.client_id)
              .in("status", ["open", "in_progress"]),
            supabase.from("invoices")
              .select("id, status", { count: "exact" })
              .eq("client_id", p.client_id),
            supabase.from("quotes")
              .select("id, status", { count: "exact" })
              .eq("client_id", p.client_id)
              .in("status", ["pending", "draft"]),
          ]);

          const invoices = invoicesRes.data ?? [];
          setKpis({
            openTickets:     ticketsRes.count ?? 0,
            pendingInvoices: invoices.filter((i: any) => i.status === "pending" || i.status === "overdue").length,
            activeInvoices:  invoices.filter((i: any) => i.status === "paid"    || i.status === "active").length,
            pendingQuotes:   quotesRes.count ?? 0,
          });

          const [tFeed, iFeed, qFeed] = await Promise.all([
            supabase.from("tickets")
              .select("id, title, status, created_at")
              .eq("client_id", p.client_id)
              .order("created_at", { ascending: false })
              .limit(3),
            supabase.from("invoices")
              .select("id, description, status, created_at")
              .eq("client_id", p.client_id)
              .order("created_at", { ascending: false })
              .limit(3),
            supabase.from("quotes")
              .select("id, title, status, created_at")
              .eq("client_id", p.client_id)
              .order("created_at", { ascending: false })
              .limit(3),
          ]);

          const items: ActivityItem[] = [
            ...(tFeed.data ?? []).map((r: any) => ({ id: `t-${r.id}`, kind: "ticket"  as const, title: r.title,              status: r.status, date: r.created_at })),
            ...(iFeed.data ?? []).map((r: any) => ({ id: `i-${r.id}`, kind: "invoice" as const, title: r.description ?? "Fatura", status: r.status, date: r.created_at })),
            ...(qFeed.data ?? []).map((r: any) => ({ id: `q-${r.id}`, kind: "quote"   as const, title: r.title,              status: r.status, date: r.created_at })),
          ]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 6);

          setActivity(items);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const firstName = useMemo(() => {
    const name = profile?.full_name?.trim();
    return name ? name.split(" ")[0] : "Usuário";
  }, [profile]);

  const role = profile?.role ?? null;

  const kpiCards = [
    {
      label: "Chamados abertos",
      value: kpis.openTickets,
      icon:  <MessageSquare className="h-5 w-5" />,
      accent: "border-amber-500/20 bg-amber-500/5",
      iconBg: "text-amber-400 bg-amber-500/10",
      show:  canAccess(role, "suporte"),
      alert: kpis.openTickets > 0,
    },
    {
      label: "Faturas pendentes",
      value: kpis.pendingInvoices,
      icon:  <AlertCircle className="h-5 w-5" />,
      accent: "border-red-500/20 bg-red-500/5",
      iconBg: "text-red-400 bg-red-500/10",
      show:  canAccess(role, "faturas"),
      alert: kpis.pendingInvoices > 0,
    },
    {
      label: "Faturas ativas / pagas",
      value: kpis.activeInvoices,
      icon:  <CheckCircle2 className="h-5 w-5" />,
      accent: "border-emerald-500/20 bg-emerald-500/5",
      iconBg: "text-emerald-400 bg-emerald-500/10",
      show:  canAccess(role, "faturas"),
      alert: false,
    },
    {
      label: "Orçamentos pendentes",
      value: kpis.pendingQuotes,
      icon:  <TrendingUp className="h-5 w-5" />,
      accent: "border-blue-500/20 bg-blue-500/5",
      iconBg: "text-blue-400 bg-blue-500/10",
      show:  canAccess(role, "orcamentos"),
      alert: kpis.pendingQuotes > 0,
    },
  ].filter((k) => k.show);

  const modules = [
    {
      key:       "orcamentos",
      href:      "/portal/orcamentos",
      label:     "Orçamentos",
      desc:      "Visualize e aprove propostas comerciais.",
      icon:      <FileText className="h-6 w-6" />,
      accent:    "hover:border-blue-500/40 hover:shadow-[0_0_24px_rgba(59,130,246,0.12)]",
      iconBg:    "bg-blue-500/10 text-blue-400",
      linkColor: "text-blue-400",
    },
    {
      key:       "faturas",
      href:      "/portal/faturas",
      label:     "Faturas e Contratos",
      desc:      "Acompanhe cobranças, pagamentos e contratos ativos.",
      icon:      <CreditCard className="h-6 w-6" />,
      accent:    "hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(16,185,129,0.12)]",
      iconBg:    "bg-emerald-500/10 text-emerald-400",
      linkColor: "text-emerald-400",
    },
    {
      key:       "suporte",
      href:      "/portal/suporte",
      label:     "Suporte Técnico",
      desc:      "Abra chamados e acompanhe atendimentos.",
      icon:      <MessageSquare className="h-6 w-6" />,
      accent:    "hover:border-amber-500/40 hover:shadow-[0_0_24px_rgba(245,158,11,0.12)]",
      iconBg:    "bg-amber-500/10 text-amber-400",
      linkColor: "text-amber-400",
    },
    {
      key:       "academy",
      href:      "/portal/treinamentos",
      label:     "LOC FIX Academy",
      desc:      "Treinamentos em vídeo para sua equipe de operação.",
      icon:      <PlaySquare className="h-6 w-6" />,
      accent:    "hover:border-[#138946]/40 hover:shadow-[0_0_24px_rgba(19,137,70,0.12)]",
      iconBg:    "bg-[#138946]/10 text-[#79d89f]",
      linkColor: "text-[#79d89f]",
    },
    {
      key:       "ajuda",
      href:      "/portal/ajuda",
      label:     "Central de Ajuda",
      desc:      "Tutoriais, manuais e perguntas frequentes.",
      icon:      <HelpCircle className="h-6 w-6" />,
      accent:    "hover:border-purple-500/40 hover:shadow-[0_0_24px_rgba(168,85,247,0.12)]",
      iconBg:    "bg-purple-500/10 text-purple-400",
      linkColor: "text-purple-400",
    },
  ].filter((m) => canAccess(role, m.key));

  function ActivityIcon({ kind }: { kind: ActivityItem["kind"] }) {
    if (kind === "ticket")  return <MessageSquare className="h-4 w-4 text-amber-400" />;
    if (kind === "invoice") return <Receipt        className="h-4 w-4 text-emerald-400" />;
    return <BookOpen className="h-4 w-4 text-blue-400" />;
  }

  function kindLabel(kind: ActivityItem["kind"]) {
    if (kind === "ticket")  return "Chamado";
    if (kind === "invoice") return "Fatura";
    return "Orçamento";
  }

  function activityLabel(item: ActivityItem): string {
    if (item.kind === "ticket")  return TICKET_LABELS[item.status]  ?? item.status;
    if (item.kind === "invoice") return INVOICE_LABELS[item.status] ?? item.status;
    return QUOTE_LABELS[item.status] ?? item.status;
  }

  if (loading) return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1413] px-5 py-4 text-sm text-zinc-300">
        <Loader2 className="h-5 w-5 animate-spin text-[#138946]" />
        Carregando painel...
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-[#0d0807]">

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5 bg-[#1a1413]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(19,137,70,0.18),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
          <div className="flex flex-col gap-3">
            {company && (
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#138946]/25 bg-[#138946]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#79d89f]">
                {company}
              </span>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {greeting()}, {firstName}.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-zinc-400">
              Aqui está um resumo da sua conta. Acesse os módulos abaixo conforme sua área de atuação.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-10 px-6 py-10 sm:px-10">

        {/* KPIs */}
        {kpiCards.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <TrendingUp className="h-3.5 w-3.5" /> Situação atual
            </h2>
            <div className={`grid gap-4 ${
              kpiCards.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4"
              : kpiCards.length === 3 ? "sm:grid-cols-3"
              : "sm:grid-cols-2"
            }`}>
              {kpiCards.map((kpi) => (
                <div key={kpi.label}
                  className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
                    kpi.alert ? kpi.accent : "border-white/5 bg-[#1a1413]"
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-zinc-500">{kpi.label}</p>
                      <p className="mt-2 text-4xl font-black tabular-nums text-white">{kpi.value}</p>
                    </div>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                      {kpi.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Acesso rápido */}
        {modules.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <ArrowRight className="h-3.5 w-3.5" /> Acesso rápido
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => (
                <Link key={mod.key} href={mod.href}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#1a1413] p-6 transition-all duration-200 ${mod.accent}`}>
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${mod.iconBg}`}>
                    {mod.icon}
                  </div>
                  <h3 className="mb-1 text-base font-bold text-white">{mod.label}</h3>
                  <p className="flex-1 text-sm leading-6 text-zinc-400">{mod.desc}</p>
                  <div className={`mt-4 flex items-center gap-1.5 text-xs font-semibold transition-transform duration-200 group-hover:translate-x-1 ${mod.linkColor}`}>
                    Acessar <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Atividade recente */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <Clock className="h-3.5 w-3.5" /> Atividade recente
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1a1413]">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <Clock className="h-8 w-8 text-zinc-700" />
                <p className="text-sm font-medium text-zinc-400">Nenhuma atividade recente.</p>
                <p className="text-xs text-zinc-600">As últimas movimentações da sua conta aparecerão aqui.</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-[#0d0807]">
                      <ActivityIcon kind={item.kind} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-600">
                        {kindLabel(item.kind)} · {new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusColor(item.status)}`}>
                      {activityLabel(item)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}