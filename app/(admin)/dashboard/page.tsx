"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutDashboard,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings } from "../../providers/SettingsProvider";

type DashboardState = {
  pendingQuotes: number;
  upcomingServiceOrders: number;
  openTickets: number;
  overdueTickets: number;
  activeClients: number;
  teamMembers: number;
  activeCourses: number;
  lessonsPublished: number;
  revenueThisMonth: number;
  revenueOpen: number;
  overdueRevenue: number;
  financialItemsOpen: number;
};

type QuoteRow = {
  id: string;
  title: string | null;
  status: string | null;
  final_amount: number | string | null;
  valid_until: string | null;
  created_at: string | null;
};

type ServiceOrderRow = {
  id: string;
  status: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  quote_id: string | null;
};

type TicketRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  sla_deadline: string | null;
  created_at: string | null;
};

type SettingsShape = {
  systemPreferences?: {
    feature_toggles?: Record<string, boolean | undefined> | null;
    custom_labels?: Record<string, string | undefined> | null;
  } | null;
};

const INITIAL_STATE: DashboardState = {
  pendingQuotes: 0,
  upcomingServiceOrders: 0,
  openTickets: 0,
  overdueTickets: 0,
  activeClients: 0,
  teamMembers: 0,
  activeCourses: 0,
  lessonsPublished: 0,
  revenueThisMonth: 0,
  revenueOpen: 0,
  overdueRevenue: 0,
  financialItemsOpen: 0,
};

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function startOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function groupLabel(title: string, count: number) {
  return `${title} (${count})`;
}

function CompactRow({
  href,
  title,
  subtitle,
  meta,
}: {
  href: string;
  title: string;
  subtitle: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-background px-4 py-3 transition hover:bg-white/5"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <p className="mt-1 truncate text-xs text-text-secondary">{subtitle}</p>
      </div>
      {meta ? <p className="shrink-0 text-xs text-text-secondary">{meta}</p> : null}
    </Link>
  );
}

function SmallToggleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-surface p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <h2 className="text-base font-semibold text-white">{groupLabel(title, count)}</h2>
          <p className="mt-1 text-sm text-text-secondary">{open ? "Clique para recolher" : "Clique para expandir"}</p>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-text-secondary" /> : <ChevronDown className="h-5 w-5 text-text-secondary" />}
      </button>
      {open ? <div className="mt-4 space-y-3">{children}</div> : null}
    </section>
  );
}

export default function DashboardPage() {
  const { systemPreferences } = (useSettings() as SettingsShape) ?? {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [recentQuotes, setRecentQuotes] = useState<QuoteRow[]>([]);
  const [upcomingOrders, setUpcomingOrders] = useState<ServiceOrderRow[]>([]);
  const [priorityTickets, setPriorityTickets] = useState<TicketRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState({
    alerts: true,
    support: false,
    operations: false,
    commercial: false,
  });

  const customLabels = systemPreferences?.custom_labels ?? {};
  const featureToggles = systemPreferences?.feature_toggles ?? {};

  const labels = useMemo(
    () => ({
      dashboard: customLabels.menu_dashboard || "Visão Geral",
      quotes: customLabels.menu_quotes || "Orçamentos",
      serviceOrders: customLabels.menu_service_orders || "Ordens de Serviço",
      support: customLabels.menu_support || "Suporte",
      training: customLabels.menu_training || "Treinamentos",
      clients: customLabels.entity_client_plural || customLabels.client_plural || "Clientes",
      financial: customLabels.menu_financial || "Financeiro",
      team: customLabels.menu_team || "Equipe",
      quoteSingular: customLabels.entity_quote_singular || "orçamento",
    }),
    [customLabels]
  );

  const loadDashboard = useCallback(async () => {
    setErrorMessage(null);
    const now = new Date().toISOString();
    const todayStart = startOfTodayIso();
    const todayEnd = endOfTodayIso();
    const next7Days = addDaysIso(7);
    const monthStart = startOfMonthIso();

    try {
      const [
        quotesPending,
        ordersUpcoming,
        ticketsOpen,
        ticketsOverdue,
        clientsCount,
        teamCount,
        coursesPublished,
        lessonsCount,
        revenueThisMonth,
        revenueOpen,
        revenueOverdue,
        financialOpen,
        quotesRecent,
        ordersList,
        ticketsList,
      ] = await Promise.all([
        supabase.from("quotes").select("*", { count: "exact", head: true }).in("status", ["draft", "pending_approval"]),
        supabase.from("service_orders").select("*", { count: "exact", head: true }).gte("event_start_date", now).lte("event_start_date", next7Days),
        supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "pending", "in_progress"]),
        supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "pending", "in_progress"]).lt("sla_deadline", now),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("courses").select("*", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("lessons").select("*", { count: "exact", head: true }),
        supabase.from("financial_transactions").select("*", { count: "exact", head: true }).gte("created_at", monthStart).eq("status", "paid"),
        supabase.from("financial_transactions").select("*", { count: "exact", head: true }).in("status", ["pending"]),
        supabase.from("financial_transactions").select("*", { count: "exact", head: true }).lt("due_date", todayStart).in("status", ["pending"]),
        supabase.from("financial_transactions").select("*", { count: "exact", head: true }).in("status", ["pending"]),
        supabase.from("quotes").select("id, title, status, final_amount, valid_until, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("service_orders").select("id, status, event_start_date, event_end_date, quote_id").gte("event_start_date", todayStart).lte("event_start_date", next7Days).order("event_start_date", { ascending: true }).limit(3),
        supabase.from("tickets").select("id, title, status, priority, category, sla_deadline, created_at").in("status", ["open", "pending", "in_progress"]).order("created_at", { ascending: false }).limit(3),
      ]);

      const error = [
        quotesPending.error,
        ordersUpcoming.error,
        ticketsOpen.error,
        ticketsOverdue.error,
        clientsCount.error,
        teamCount.error,
        coursesPublished.error,
        lessonsCount.error,
        revenueThisMonth.error,
        revenueOpen.error,
        revenueOverdue.error,
        financialOpen.error,
        quotesRecent.error,
        ordersList.error,
        ticketsList.error,
      ].find(Boolean);

      if (error) throw error;

      setState({
        pendingQuotes: quotesPending.count ?? 0,
        upcomingServiceOrders: ordersUpcoming.count ?? 0,
        openTickets: ticketsOpen.count ?? 0,
        overdueTickets: ticketsOverdue.count ?? 0,
        activeClients: clientsCount.count ?? 0,
        teamMembers: teamCount.count ?? 0,
        activeCourses: coursesPublished.count ?? 0,
        lessonsPublished: lessonsCount.count ?? 0,
        revenueThisMonth: revenueThisMonth.count ?? 0,
        revenueOpen: revenueOpen.count ?? 0,
        overdueRevenue: revenueOverdue.count ?? 0,
        financialItemsOpen: financialOpen.count ?? 0,
      });

      setRecentQuotes((quotesRecent.data as QuoteRow[] | null) ?? []);
      setUpcomingOrders((ordersList.data as ServiceOrderRow[] | null) ?? []);
      setPriorityTickets((ticketsList.data as TicketRow[] | null) ?? []);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setErrorMessage("Não foi possível carregar o painel agora.");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      await loadDashboard();
      if (mounted) setLoading(false);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [loadDashboard]);

  const refresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const featured = [
    {
      title: `${labels.quotes} pendentes`,
      value: state.pendingQuotes,
      href: "/orcamentos",
      icon: FileText,
      visible: featureToggles.enable_quotes !== false,
    },
    {
      title: `${labels.serviceOrders} próximas`,
      value: state.upcomingServiceOrders,
      href: "/os",
      icon: CalendarClock,
      visible: featureToggles.enable_service_orders !== false,
    },
    {
      title: "Chamados abertos",
      value: state.openTickets,
      href: "/suporte",
      icon: Ticket,
      visible: featureToggles.enable_support !== false,
    },
  ].filter((item) => item.visible);

  const latestQuote = recentQuotes[0] ?? null;
  const nextOrder = upcomingOrders[0] ?? null;
  const topTicket = priorityTickets[0] ?? null;

  const alerts = [
    state.overdueTickets > 0
      ? {
          title: `${state.overdueTickets} ticket(s) fora do SLA`,
          description: "Priorize o atendimento mais urgente.",
          href: "/suporte",
        }
      : null,
    state.overdueRevenue > 0
      ? {
          title: `${state.overdueRevenue} lançamento(s) vencido(s)`,
          description: "Revise pendências financeiras em aberto.",
          href: "/financeiro",
        }
      : null,
    state.pendingQuotes > 0
      ? {
          title: `${state.pendingQuotes} orçamento(s) aguardando ação`,
          description: "Confira propostas sem retorno.",
          href: "/orcamentos",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; description: string; href: string }>;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-surface px-5 py-4 text-sm text-white">
          <Loader2 className="h-5 w-5 animate-spin text-cs-green" />
          Carregando visão geral...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <section className="rounded-3xl border border-white/10 bg-surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cs-green/20 bg-cs-green/10 px-3 py-1 text-xs font-semibold text-cs-green">
              <LayoutDashboard className="h-3.5 w-3.5" />
              {labels.dashboard}
            </div>
            <h1 className="text-2xl font-semibold text-white">Painel operacional</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Resumo rápido do que exige atenção agora.
            </p>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {featured.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-3xl border border-white/10 bg-surface p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.03]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-text-secondary">{card.title}</p>
                  <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                </div>
                <div className="rounded-2xl bg-cs-green/10 p-3 text-cs-green">
                  <Icon size={22} />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <SmallToggleSection
        title="Alertas"
        count={alerts.length}
        open={openPanels.alerts}
        onToggle={() => setOpenPanels((p) => ({ ...p, alerts: !p.alerts }))}
      >
        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-background px-4 py-5 text-sm text-text-secondary">
            Nenhum alerta crítico no momento.
          </div>
        ) : (
          alerts.map((alert) => (
            <CompactRow
              key={alert.title}
              href={alert.href}
              title={alert.title}
              subtitle={alert.description}
              meta="ver"
            />
          ))
        )}
      </SmallToggleSection>

      <SmallToggleSection
        title="Pendências de suporte"
        count={priorityTickets.length}
        open={openPanels.support}
        onToggle={() => setOpenPanels((p) => ({ ...p, support: !p.support }))}
      >
        {topTicket ? (
          <CompactRow
            href="/suporte"
            title={topTicket.title || `Ticket ${shortId(topTicket.id)}`}
            subtitle={`${topTicket.category || "Sem categoria"} · ${topTicket.priority || "normal"} · SLA ${formatDateTime(topTicket.sla_deadline)}`}
            meta={topTicket.status || "open"}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-background px-4 py-5 text-sm text-text-secondary">
            Nenhum ticket em aberto.
          </div>
        )}
        <Link href="/suporte" className="inline-flex items-center gap-2 text-sm text-cs-green transition hover:opacity-80">
          Ver fila completa <ArrowRight className="h-4 w-4" />
        </Link>
      </SmallToggleSection>

      <SmallToggleSection
        title="Próximas operações"
        count={upcomingOrders.length}
        open={openPanels.operations}
        onToggle={() => setOpenPanels((p) => ({ ...p, operations: !p.operations }))}
      >
        {nextOrder ? (
          <CompactRow
            href="/os"
            title={`OS ${shortId(nextOrder.id)}`}
            subtitle={`Início ${formatDateTime(nextOrder.event_start_date)} · Fim ${formatDateTime(nextOrder.event_end_date)}`}
            meta={nextOrder.status || "pending"}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-background px-4 py-5 text-sm text-text-secondary">
            Nenhuma operação próxima.
          </div>
        )}
        <Link href="/os" className="inline-flex items-center gap-2 text-sm text-cs-green transition hover:opacity-80">
          Ver agenda completa <ArrowRight className="h-4 w-4" />
        </Link>
      </SmallToggleSection>

      <SmallToggleSection
        title="Comercial recente"
        count={recentQuotes.length}
        open={openPanels.commercial}
        onToggle={() => setOpenPanels((p) => ({ ...p, commercial: !p.commercial }))}
      >
        {latestQuote ? (
          <CompactRow
            href={`/orcamentos/${latestQuote.id}`}
            title={latestQuote.title || `Orçamento ${shortId(latestQuote.id)}`}
            subtitle={`Valor ${formatCurrency(toNumber(latestQuote.final_amount))} · Criado em ${formatDateTime(latestQuote.created_at)}`}
            meta={latestQuote.status || "draft"}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-background px-4 py-5 text-sm text-text-secondary">
            Nenhum orçamento recente.
          </div>
        )}
        <Link href="/orcamentos" className="inline-flex items-center gap-2 text-sm text-cs-green transition hover:opacity-80">
          Ver orçamentos <ArrowRight className="h-4 w-4" />
        </Link>
      </SmallToggleSection>

      <section className="rounded-3xl border border-white/10 bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Financeiro em resumo</h2>
          <Link href="/financeiro" className="text-sm text-cs-green transition hover:opacity-80">
            Abrir financeiro
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/financeiro" className="rounded-3xl border border-white/10 bg-background p-4 transition hover:bg-white/5">
            <p className="text-sm text-text-secondary">Recebido no mês</p>
            <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(state.revenueThisMonth)}</p>
          </Link>
          <Link href="/financeiro" className="rounded-3xl border border-white/10 bg-background p-4 transition hover:bg-white/5">
            <p className="text-sm text-text-secondary">Em aberto</p>
            <p className="mt-2 text-2xl font-bold text-white">{state.revenueOpen}</p>
          </Link>
          <Link href="/financeiro" className="rounded-3xl border border-white/10 bg-background p-4 transition hover:bg-white/5">
            <p className="text-sm text-text-secondary">Vencidos</p>
            <p className="mt-2 text-2xl font-bold text-white">{state.overdueRevenue}</p>
          </Link>
          <Link href="/financeiro" className="rounded-3xl border border-white/10 bg-background p-4 transition hover:bg-white/5">
            <p className="text-sm text-text-secondary">Lançamentos abertos</p>
            <p className="mt-2 text-2xl font-bold text-white">{state.financialItemsOpen}</p>
          </Link>
        </div>
      </section>
    </div>
  );
}