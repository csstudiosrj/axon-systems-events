"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileText,
  Headset,
  LayoutDashboard,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Ticket,
  Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings } from "../../providers/SettingsProvider";

type MetricCard = {
  title: string;
  value: number;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  tone: "green" | "gold" | "red" | "blue";
};

type AlertItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  level: "critical" | "warning" | "info";
};

type UpcomingServiceOrder = {
  id: string;
  status: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  quote_id: string | null;
};

type RecentQuote = {
  id: string;
  title: string | null;
  status: string | null;
  final_amount: number | null;
  valid_until: string | null;
  created_at: string | null;
};

type PriorityTicket = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  sla_deadline: string | null;
  created_at: string | null;
};

type DashboardMetrics = {
  pendingQuotes: number;
  upcomingServiceOrders: number;
  openTickets: number;
  overdueTickets: number;
  activeClients: number;
  teamMembers: number;
  activeCourses: number;
  lessonsPublished: number;
};

type SettingsContextShape = {
  systemPreferences?: {
    feature_toggles?: Record<string, boolean | undefined>;
    custom_labels?: Record<string, string | undefined>;
  } | null;
};

const INITIAL_METRICS: DashboardMetrics = {
  pendingQuotes: 0,
  upcomingServiceOrders: 0,
  openTickets: 0,
  overdueTickets: 0,
  activeClients: 0,
  teamMembers: 0,
  activeCourses: 0,
  lessonsPublished: 0,
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

function formatDateTime(value: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatCurrency(value: number | null) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getDaysUntil(value: string | null) {
  if (!value) return null;
  const now = new Date().getTime();
  const target = new Date(value).getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getToneClasses(tone: MetricCard["tone"]) {
  if (tone === "green") {
    return {
      icon: "bg-cs-green/10 text-cs-green",
      border: "border-cs-green/15",
    };
  }
  if (tone === "gold") {
    return {
      icon: "bg-cs-gold/10 text-cs-gold",
      border: "border-cs-gold/15",
    };
  }
  if (tone === "red") {
    return {
      icon: "bg-red-500/10 text-red-400",
      border: "border-red-500/15",
    };
  }
  return {
    icon: "bg-blue-500/10 text-blue-400",
    border: "border-blue-500/15",
  };
}

export default function DashboardPage() {
  const { systemPreferences } = (useSettings() as SettingsContextShape) ?? {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [upcomingOrders, setUpcomingOrders] = useState<UpcomingServiceOrder[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [priorityTickets, setPriorityTickets] = useState<PriorityTicket[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const customLabels = systemPreferences?.custom_labels ?? {};
  const featureToggles = systemPreferences?.feature_toggles ?? {};

  const labels = useMemo(
    () => ({
      quotes: customLabels.menu_quotes || "Orçamentos",
      serviceOrders: customLabels.menu_service_orders || "Ordens de Serviço",
      support: customLabels.menu_support || "Suporte",
      training: customLabels.menu_training || "Treinamentos",
      clients: customLabels.entity_client_plural || customLabels.client_plural || "Clientes",
      dashboard: customLabels.menu_dashboard || "Visão Geral",
    }),
    [customLabels]
  );

  const loadDashboard = useCallback(async () => {
    setErrorMessage(null);

    const nowIso = new Date().toISOString();
    const todayStart = startOfTodayIso();
    const todayEnd = endOfTodayIso();
    const next7Days = addDaysIso(7);

    try {
      const [
        pendingQuotesResult,
        upcomingOrdersResult,
        openTicketsResult,
        overdueTicketsResult,
        clientsResult,
        teamResult,
        activeCoursesResult,
        lessonsResult,
        upcomingOrdersListResult,
        recentQuotesResult,
        priorityTicketsResult,
      ] = await Promise.all([
        supabase
          .from("quotes")
          .select("*", { count: "exact", head: true })
          .in("status", ["draft", "pending_approval"]),

        supabase
          .from("service_orders")
          .select("*", { count: "exact", head: true })
          .gte("event_start_date", nowIso)
          .lte("event_start_date", next7Days),

        supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "pending", "in_progress"]),

        supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "pending", "in_progress"])
          .lt("sla_deadline", nowIso),

        supabase.from("clients").select("*", { count: "exact", head: true }),

        supabase.from("profiles").select("*", { count: "exact", head: true }),

        supabase
          .from("courses")
          .select("*", { count: "exact", head: true })
          .eq("status", "published"),

        supabase.from("lessons").select("*", { count: "exact", head: true }),

        supabase
          .from("service_orders")
          .select("id, status, event_start_date, event_end_date, quote_id")
          .gte("event_start_date", nowIso)
          .order("event_start_date", { ascending: true })
          .limit(5),

        supabase
          .from("quotes")
          .select("id, title, status, final_amount, valid_until, created_at")
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("tickets")
          .select("id, title, status, priority, category, sla_deadline, created_at")
          .in("status", ["open", "pending", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const possibleErrors = [
        pendingQuotesResult.error,
        upcomingOrdersResult.error,
        openTicketsResult.error,
        overdueTicketsResult.error,
        clientsResult.error,
        teamResult.error,
        activeCoursesResult.error,
        lessonsResult.error,
        upcomingOrdersListResult.error,
        recentQuotesResult.error,
        priorityTicketsResult.error,
      ].filter(Boolean);

      if (possibleErrors.length > 0) {
        throw possibleErrors[0];
      }

      const nextMetrics: DashboardMetrics = {
        pendingQuotes: pendingQuotesResult.count ?? 0,
        upcomingServiceOrders: upcomingOrdersResult.count ?? 0,
        openTickets: openTicketsResult.count ?? 0,
        overdueTickets: overdueTicketsResult.count ?? 0,
        activeClients: clientsResult.count ?? 0,
        teamMembers: teamResult.count ?? 0,
        activeCourses: activeCoursesResult.count ?? 0,
        lessonsPublished: lessonsResult.count ?? 0,
      };

      setMetrics(nextMetrics);
      setUpcomingOrders((upcomingOrdersListResult.data as UpcomingServiceOrder[] | null) ?? []);
      setRecentQuotes((recentQuotesResult.data as RecentQuote[] | null) ?? []);
      setPriorityTickets((priorityTicketsResult.data as PriorityTicket[] | null) ?? []);

      const nextAlerts: AlertItem[] = [];

      if (nextMetrics.overdueTickets > 0) {
        nextAlerts.push({
          id: "overdue-tickets",
          title: `${nextMetrics.overdueTickets} chamado(s) fora do SLA`,
          description: "Priorize atendimento imediato para evitar escalonamento.",
          href: "/suporte",
          level: "critical",
        });
      }

      const ticketsTodayCritical =
        ((priorityTicketsResult.data as PriorityTicket[] | null) ?? []).filter(
          (ticket) =>
            (ticket.priority || "").toLowerCase() === "high" ||
            (ticket.priority || "").toLowerCase() === "critical"
        ).length;

      if (ticketsTodayCritical > 0) {
        nextAlerts.push({
          id: "critical-tickets",
          title: `${ticketsTodayCritical} ticket(s) prioritário(s)`,
          description: "Existem atendimentos críticos aguardando atuação.",
          href: "/suporte",
          level: "warning",
        });
      }

      const ordersTodayCount =
        ((upcomingOrdersListResult.data as UpcomingServiceOrder[] | null) ?? []).filter((order) => {
          if (!order.event_start_date) return false;
          return order.event_start_date >= todayStart && order.event_start_date <= todayEnd;
        }).length;

      if (ordersTodayCount > 0) {
        nextAlerts.push({
          id: "orders-today",
          title: `${ordersTodayCount} operação(ões) programada(s) para hoje`,
          description: "Confira equipe, horário e execução das OS do dia.",
          href: "/os",
          level: "info",
        });
      }

      const quotesExpiringSoon =
        ((recentQuotesResult.data as RecentQuote[] | null) ?? []).filter((quote) => {
          const days = getDaysUntil(quote.valid_until);
          return days !== null && days >= 0 && days <= 3;
        }).length;

      if (quotesExpiringSoon > 0) {
        nextAlerts.push({
          id: "quotes-expiring",
          title: `${quotesExpiringSoon} orçamento(s) vencendo em até 3 dias`,
          description: "Hora de follow-up comercial para não perder oportunidade.",
          href: "/orcamentos",
          level: "warning",
        });
      }

      if (nextAlerts.length === 0) {
        nextAlerts.push({
          id: "all-good",
          title: "Operação sem alertas críticos",
          description: "Nenhum item urgente detectado neste momento.",
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const metricCards: MetricCard[] = [
    {
      title: `${labels.quotes} pendentes`,
      value: metrics.pendingQuotes,
      description: "Rascunho ou aguardando aprovação.",
      href: "/orcamentos",
      icon: FileText,
      tone: "green",
    },
    {
      title: `${labels.serviceOrders} em 7 dias`,
      value: metrics.upcomingServiceOrders,
      description: "Janela operacional da próxima semana.",
      href: "/os",
      icon: CalendarClock,
      tone: "gold",
    },
    {
      title: "Chamados abertos",
      value: metrics.openTickets,
      description: "Fila ativa de suporte.",
      href: "/suporte",
      icon: Ticket,
      tone: "red",
    },
    {
      title: `${labels.clients} cadastrados`,
      value: metrics.activeClients,
      description: "Base disponível no sistema.",
      href: "/clientes",
      icon: Users,
      tone: "blue",
    },
    {
      title: "Equipe cadastrada",
      value: metrics.teamMembers,
      description: "Usuários no ambiente.",
      href: "/equipe",
      icon: Briefcase,
      tone: "blue",
    },
    {
      title: `${labels.training} ativos`,
      value: metrics.activeCourses,
      description: "Cursos publicados para consumo.",
      href: "/treinamentos",
      icon: BookOpen,
      tone: "green",
    },
  ];

  const quickLinks = [
    { label: "Novo cliente", href: "/clientes" },
    { label: `Novo ${customLabels.entity_quote_singular || "orçamento"}`, href: "/orcamentos" },
    { label: "Nova OS", href: "/os" },
    { label: "Novo ticket", href: "/suporte" },
    { label: "Gerenciar equipe", href: "/equipe" },
    { label: "Abrir treinamentos", href: "/treinamentos" },
  ];

  const moduleVisibility = {
    crm: featureToggles.enable_crm !== false,
    clients: featureToggles.enable_clients !== false,
    quotes: featureToggles.enable_quotes !== false,
    serviceOrders: featureToggles.enable_service_orders !== false,
    support: featureToggles.enable_support !== false,
    training: featureToggles.enable_training !== false,
    team: featureToggles.enable_team !== false,
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
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
            <h1 className="text-2xl font-semibold text-white">
              Painel operacional do sistema
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Visão rápida de operação, comercial, suporte e treinamento com atalhos reais.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar painel
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
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
            {quickLinks
              .filter((item) => {
                if (item.href === "/clientes") return moduleVisibility.clients;
                if (item.href === "/orcamentos") return moduleVisibility.quotes;
                if (item.href === "/os") return moduleVisibility.serviceOrders;
                if (item.href === "/suporte") return moduleVisibility.support;
                if (item.href === "/equipe") return moduleVisibility.team;
                if (item.href === "/treinamentos") return moduleVisibility.training;
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metricCards
          .filter((card) => {
            if (card.href === "/clientes") return moduleVisibility.clients;
            if (card.href === "/orcamentos") return moduleVisibility.quotes;
            if (card.href === "/os") return moduleVisibility.serviceOrders;
            if (card.href === "/suporte") return moduleVisibility.support;
            if (card.href === "/equipe") return moduleVisibility.team;
            if (card.href === "/treinamentos") return moduleVisibility.training;
            return true;
          })
          .map((card) => {
            const tone = getToneClasses(card.tone);
            const Icon = card.icon;

            return (
              <Link
                key={card.title}
                href={card.href}
                className={`rounded-3xl border bg-surface p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.03] ${tone.border}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-secondary">{card.title}</p>
                    <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                    <p className="mt-2 text-xs text-text-secondary">{card.description}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${tone.icon}`}>
                    <Icon size={22} />
                  </div>
                </div>
              </Link>
            );
          })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
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
              const daysUntil = getDaysUntil(quote.valid_until);

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
                    <p className="mt-1 text-sm text-white">{formatCurrency(quote.final_amount)}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Validade</p>
                    <p className="mt-1 text-sm text-white">
                      {quote.valid_until ? formatDateTime(quote.valid_until) : "Sem validade"}
                    </p>
                    {daysUntil !== null && (
                      <p className="mt-1 text-xs text-text-secondary">
                        {daysUntil < 0
                          ? "Expirado"
                          : daysUntil === 0
                          ? "Vence hoje"
                          : `${daysUntil} dia(s) restantes`}
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
      <AlertTriangle className="mx-auto h-6 w-6 text-text-secondary" />
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