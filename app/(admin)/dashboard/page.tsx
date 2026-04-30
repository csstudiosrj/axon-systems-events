"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Headset,
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

type AlertItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  level: "critical" | "warning" | "info";
};

type SimpleCard = {
  title: string;
  value: number;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  tone: "green" | "gold" | "red" | "blue";
};

type FeaturedCard = {
  title: string;
  value: number;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  tone: "green" | "gold" | "red";
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

function startOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function toneClasses(tone: FeaturedCard["tone"] | SimpleCard["tone"]) {
  switch (tone) {
    case "green":
      return { chip: "bg-cs-green/10 text-cs-green", border: "border-cs-green/20" };
    case "gold":
      return { chip: "bg-cs-gold/10 text-cs-gold", border: "border-cs-gold/20" };
    case "red":
      return { chip: "bg-red-500/10 text-red-300", border: "border-red-500/20" };
    default:
      return { chip: "bg-blue-500/10 text-blue-300", border: "border-blue-500/20" };
  }
}

function EmptyState({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-background px-4 py-6 text-center">
      <Clock3 className="mx-auto h-6 w-6 text-text-secondary" />
      <p className="mt-3 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-text-secondary">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { systemPreferences } = (useSettings() as SettingsShape) ?? {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<QuoteRow[]>([]);
  const [upcomingOrders, setUpcomingOrders] = useState<ServiceOrderRow[]>([]);
  const [priorityTickets, setPriorityTickets] = useState<TicketRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      revenue: customLabels.menu_financial || "Financeiro",
      team: customLabels.menu_team || "Equipe",
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
        supabase.from("financial_transactions").select("*", { count: "exact", head: true }).gte("created_at", monthStart).in("status", ["paid", "received", "confirmed"]),
        supabase.from("financial_transactions").select("*", { count: "exact", head: true }).in("status", ["open", "pending", "overdue"]),
        supabase.from("financial_transactions").select("*", { count: "exact", head: true }).eq("status", "overdue"),
        supabase.from("financial_transactions").select("*", { count: "exact", head: true }).in("status", ["open", "pending", "overdue"]),
        supabase.from("quotes").select("id, title, status, final_amount, valid_until, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("service_orders").select("id, status, event_start_date, event_end_date, quote_id").gte("event_start_date", todayStart).lte("event_start_date", next7Days).order("event_start_date", { ascending: true }).limit(5),
        supabase.from("tickets").select("id, title, status, priority, category, sla_deadline, created_at").in("status", ["open", "pending", "in_progress"]).order("created_at", { ascending: false }).limit(5),
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

      const nextState: DashboardState = {
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
      };

      setState(nextState);
      setRecentQuotes((quotesRecent.data as QuoteRow[] | null) ?? []);
      setUpcomingOrders((ordersList.data as ServiceOrderRow[] | null) ?? []);
      setPriorityTickets((ticketsList.data as TicketRow[] | null) ?? []);

      const nextAlerts: AlertItem[] = [];

      if (nextState.overdueTickets > 0) {
        nextAlerts.push({
          id: "sla",
          title: `${nextState.overdueTickets} ticket(s) fora do SLA`,
          description: "Priorize atendimento imediato.",
          href: "/suporte",
          level: "critical",
        });
      }

      const criticalTickets = (ticketsList.data as TicketRow[] | null) ?? [];
      const highPriorityCount = criticalTickets.filter((t) =>
        ["high", "critical"].includes((t.priority || "").toLowerCase())
      ).length;

      if (highPriorityCount > 0) {
        nextAlerts.push({
          id: "priority",
          title: `${highPriorityCount} ticket(s) prioritário(s)`,
          description: "Fila com prioridade alta precisa de ação.",
          href: "/suporte",
          level: "warning",
        });
      }

      const ordersTodayCount = (ordersList.data as ServiceOrderRow[] | null) ?? [];
      const ordersToday = ordersTodayCount.filter(
        (o) => o.event_start_date && o.event_start_date >= todayStart && o.event_start_date <= todayEnd
      ).length;

      if (ordersToday > 0) {
        nextAlerts.push({
          id: "today-orders",
          title: `${ordersToday} operação(ões) hoje`,
          description: "Confira equipe e horários das OS de hoje.",
          href: "/os",
          level: "info",
        });
      }

      const expiringQuotes = (quotesRecent.data as QuoteRow[] | null) ?? [];
      const expiringSoon = expiringQuotes.filter((q) => {
        const d = daysUntil(q.valid_until);
        return d !== null && d >= 0 && d <= 3;
      }).length;

      if (expiringSoon > 0) {
        nextAlerts.push({
          id: "expiring-quotes",
          title: `${expiringSoon} orçamento(s) vencendo`,
          description: "Faça follow-up comercial agora.",
          href: "/orcamentos",
          level: "warning",
        });
      }

      if (nextAlerts.length === 0) {
        nextAlerts.push({
          id: "ok",
          title: "Operação estável",
          description: "Nenhum alerta crítico no momento.",
          href: "/dashboard",
          level: "info",
        });
      }

      setAlerts(nextAlerts);
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

  const featured: FeaturedCard[] = [
    {
      title: `${labels.quotes} pendentes`,
      value: state.pendingQuotes,
      description: "Rascunho ou aguardando aprovação.",
      href: "/orcamentos",
      icon: FileText,
      tone: "green",
    },
    {
      title: `${labels.serviceOrders} próximas`,
      value: state.upcomingServiceOrders,
      description: "Programação dos próximos 7 dias.",
      href: "/os",
      icon: CalendarClock,
      tone: "gold",
    },
    {
      title: "Chamados abertos",
      value: state.openTickets,
      description: "Fila de suporte ativa.",
      href: "/suporte",
      icon: Ticket,
      tone: "red",
    },
  ];

  const supportCards: SimpleCard[] = [
    {
      title: `${labels.clients} cadastrados`,
      value: state.activeClients,
      description: "Base principal do sistema.",
      href: "/clientes",
      icon: Users,
      tone: "blue",
    },
    {
      title: `${labels.training} ativos`,
      value: state.activeCourses,
      description: "Conteúdo publicado para consumo.",
      href: "/treinamentos",
      icon: BookOpen,
      tone: "green",
    },
    {
      title: "Equipe cadastrada",
      value: state.teamMembers,
      description: "Usuários e responsáveis.",
      href: "/equipe",
      icon: LayoutDashboard,
      tone: "blue",
    },
    {
      title: "Aulas publicadas",
      value: state.lessonsPublished,
      description: "Volume de conteúdo disponível.",
      href: "/treinamentos",
      icon: Headset,
      tone: "gold",
    },
  ];

  const financialCards: SimpleCard[] = [
    {
      title: "Receita do mês",
      value: state.revenueThisMonth,
      description: "Valores confirmados neste período.",
      href: "/financeiro",
      icon: Wallet,
      tone: "green",
    },
    {
      title: "Receita em aberto",
      value: state.revenueOpen,
      description: "Contas pendentes de baixa.",
      href: "/financeiro",
      icon: TrendingUp,
      tone: "gold",
    },
    {
      title: "Receita vencida",
      value: state.overdueRevenue,
      description: "Valores que já passaram do prazo.",
      href: "/financeiro",
      icon: TrendingDown,
      tone: "red",
    },
    {
      title: "Lançamentos em aberto",
      value: state.financialItemsOpen,
      description: "Pendências financeiras ativas.",
      href: "/financeiro",
      icon: Clock3,
      tone: "blue",
    },
  ];

  const visibleModules = {
    quotes: featureToggles.enable_quotes !== false,
    serviceOrders: featureToggles.enable_service_orders !== false,
    support: featureToggles.enable_support !== false,
    clients: featureToggles.enable_clients !== false,
    training: featureToggles.enable_training !== false,
    team: featureToggles.enable_team !== false,
    financial: true,
  };

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
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="rounded-3xl border border-white/10 bg-surface p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cs-green/20 bg-cs-green/10 px-3 py-1 text-xs font-semibold text-cs-green">
              <LayoutDashboard className="h-3.5 w-3.5" />
              {labels.dashboard}
            </div>
            <h1 className="text-2xl font-semibold text-white">Painel operacional do sistema</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Visão rápida de comercial, financeiro, operação, suporte e treinamento com atalhos reais.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar painel
          </button>
        </div>
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {featured
          .filter((card) => {
            if (card.href === "/orcamentos") return visibleModules.quotes;
            if (card.href === "/os") return visibleModules.serviceOrders;
            if (card.href === "/suporte") return visibleModules.support;
            return true;
          })
          .map((card) => {
            const Icon = card.icon;
            const tones = toneClasses(card.tone);
            return (
              <Link
                key={card.title}
                href={card.href}
                className={`rounded-3xl border bg-surface p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.03] ${tones.border}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-secondary">{card.title}</p>
                    <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                    <p className="mt-2 text-xs text-text-secondary">{card.description}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${tones.chip}`}>
                    <Icon size={22} />
                  </div>
                </div>
              </Link>
            );
          })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-3xl border border-white/10 bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-cs-gold" />
            <h2 className="text-base font-semibold text-white">Ações imediatas</h2>
          </div>
          <div className="grid gap-3">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className={`rounded-2xl border p-4 transition hover:bg-white/5 ${
                  alert.level === "critical"
                    ? "border-red-500/20 bg-red-500/5"
                    : alert.level === "warning"
                    ? "border-cs-gold/20 bg-cs-gold/5"
                    : "border-cs-green/20 bg-cs-green/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{alert.title}</p>
                    <p className="mt-1 text-xs text-text-secondary">{alert.description}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cs-green" />
            <h2 className="text-base font-semibold text-white">Atalhos rápidos</h2>
          </div>

          <div className="grid gap-3">
            {[
              { label: `Novo ${labels.clients.slice(0, -1).toLowerCase()}`, href: "/clientes" },
              { label: `Novo ${customLabels.entity_quote_singular || "orçamento"}`, href: "/orcamentos" },
              { label: "Nova OS", href: "/os" },
              { label: "Novo ticket", href: "/suporte" },
              { label: "Gerenciar equipe", href: "/equipe" },
              { label: `Abrir ${labels.training.toLowerCase()}`, href: "/treinamentos" },
              { label: "Ir para financeiro", href: "/financeiro" },
            ]
              .filter((item) => {
                if (item.href === "/clientes") return visibleModules.clients;
                if (item.href === "/orcamentos") return visibleModules.quotes;
                if (item.href === "/os") return visibleModules.serviceOrders;
                if (item.href === "/suporte") return visibleModules.support;
                if (item.href === "/equipe") return visibleModules.team;
                if (item.href === "/treinamentos") return visibleModules.training;
                return true;
              })
              .map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white transition hover:bg-white/5"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="h-4 w-4 text-text-secondary" />
                </Link>
              ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Financeiro</h2>
          <Link href="/financeiro" className="text-sm text-cs-green transition hover:opacity-80">
            Abrir financeiro
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {financialCards.map((card) => {
            const Icon = card.icon;
            const tones = toneClasses(card.tone);
            return (
              <Link
                key={card.title}
                href={card.href}
                className={`rounded-3xl border bg-background p-4 transition hover:bg-white/5 ${tones.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-secondary">{card.title}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(card.value)}</p>
                    <p className="mt-2 text-xs text-text-secondary">{card.description}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${tones.chip}`}>
                    <Icon size={20} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Próximas operações</h2>
            <Link href="/os" className="text-sm text-cs-green transition hover:opacity-80">
              Ver todas
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingOrders.length === 0 ? (
              <EmptyState
                title="Nenhuma operação próxima"
                description="Não há OS programadas para os próximos dias."
                href="/os"
                cta="Abrir Ordens de Serviço"
              />
            ) : (
              upcomingOrders.map((order) => (
                <Link
                  key={order.id}
                  href="/os"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-background px-4 py-3 transition hover:bg-white/5"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      OS {order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Início: {formatDateTime(order.event_start_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-text-secondary">
                      {order.status || "sem status"}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Fim: {formatDateTime(order.event_end_date)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Tickets prioritários</h2>
            <Link href="/suporte" className="text-sm text-cs-green transition hover:opacity-80">
              Ver fila
            </Link>
          </div>
          <div className="space-y-3">
            {priorityTickets.length === 0 ? (
              <EmptyState
                title="Nenhum ticket em aberto"
                description="A fila de suporte está vazia neste momento."
                href="/suporte"
                cta="Abrir suporte"
              />
            ) : (
              priorityTickets.map((ticket) => {
                const isCritical =
                  (ticket.priority || "").toLowerCase() === "critical" ||
                  (ticket.priority || "").toLowerCase() === "high";

                return (
                  <Link
                    key={ticket.id}
                    href="/suporte"
                    className={`flex items-start justify-between rounded-2xl border px-4 py-3 transition hover:bg-white/5 ${
                      isCritical
                        ? "border-red-500/20 bg-red-500/5"
                        : "border-white/10 bg-background"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {ticket.title || `Ticket ${ticket.id.slice(0, 8).toUpperCase()}`}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {ticket.category || "Sem categoria"} · {ticket.status || "Sem status"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-text-secondary">
                        {ticket.priority || "normal"}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        SLA: {formatDateTime(ticket.sla_deadline)}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Comercial recente</h2>
          <Link href="/orcamentos" className="text-sm text-cs-green transition hover:opacity-80">
            Ver {labels.quotes.toLowerCase()}
          </Link>
        </div>
        <div className="space-y-3">
          {recentQuotes.length === 0 ? (
            <EmptyState
              title={`Nenhum ${labels.quotes.toLowerCase()} cadastrado`}
              description="Comece registrando propostas e negociações reais."
              href="/orcamentos"
              cta={`Abrir ${labels.quotes}`}
            />
          ) : (
            recentQuotes.map((quote) => {
              const d = daysUntil(quote.valid_until);
              return (
                <Link
                  key={quote.id}
                  href={`/orcamentos/${quote.id}`}
                  className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-background px-4 py-3 transition hover:bg-white/5 md:grid-cols-[1.4fr_0.7fr_0.6fr_0.7fr]"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {quote.title || `Orçamento ${quote.id.slice(0, 8).toUpperCase()}`}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Criado em {formatDateTime(quote.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Status</p>
                    <p className="mt-1 text-sm text-white">{quote.status || "Sem status"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Valor</p>
                    <p className="mt-1 text-sm text-white">{formatCurrency(toNumber(quote.final_amount))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Validade</p>
                    <p className="mt-1 text-sm text-white">
                      {quote.valid_until ? formatDateTime(quote.valid_until) : "Sem validade"}
                    </p>
                    {d !== null && (
                      <p className="mt-1 text-xs text-text-secondary">
                        {d < 0 ? "Expirado" : d === 0 ? "Vence hoje" : `${d} dia(s) restantes`}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}