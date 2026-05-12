"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
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
  Wallet,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSettings } from "../../providers/SettingsProvider";

type DashboardState = {
  totalIncomePaid: number;
  totalExpensePaid: number;
  balance: number;
  pendingQuotes: number;
  upcomingServiceOrders: number;
  openTickets: number;
  overdueTickets: number;
  overdueIncome: number;
  overdueExpense: number;
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
};

type TicketRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  sla_deadline: string | null;
};

type FinancialAmountRow = {
  amount: number | string | null;
};

type SettingsShape = {
  userCompanyId?: string | null;
  systemPreferences?: {
    feature_toggles?: Record<string, boolean | undefined> | null;
    custom_labels?: Record<string, string | undefined> | null;
  } | null;
};

const INITIAL_STATE: DashboardState = {
  totalIncomePaid: 0,
  totalExpensePaid: 0,
  balance: 0,
  pendingQuotes: 0,
  upcomingServiceOrders: 0,
  openTickets: 0,
  overdueTickets: 0,
  overdueIncome: 0,
  overdueExpense: 0,
};

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
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
          <h2 className="text-base font-semibold text-white">
            {title} ({count})
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {open ? "Clique para recolher" : "Clique para expandir"}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-text-secondary" />
        ) : (
          <ChevronDown className="h-5 w-5 text-text-secondary" />
        )}
      </button>
      {open ? <div className="mt-4 space-y-3">{children}</div> : null}
    </section>
  );
}

export default function DashboardPage() {
  const { systemPreferences, userCompanyId } =
    (useSettings() as SettingsShape) ?? {};
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
    }),
    [customLabels]
  );

  // userCompanyId é dependência do callback para recarregar quando a empresa mudar
  const loadDashboard = useCallback(async () => {
    if (!userCompanyId) return;

    setErrorMessage(null);
    const now = new Date().toISOString();
    const todayStart = startOfTodayIso();
    const next7Days = addDaysIso(7);

    try {
      const [
        paidIncomeRes,
        paidExpenseRes,
        overdueIncomeRes,
        overdueExpenseRes,
        openTicketsRes,
        overdueTicketsRes,
        upcomingOrdersRes,
        pendingQuotesRes,
        quotesRecentRes,
        ordersListRes,
        ticketsListRes,
      ] = await Promise.all([
        supabase
          .from("financial_transactions")
          .select("amount")
          .eq("company_id", userCompanyId)
          .eq("type", "income")
          .eq("status", "paid"),
        supabase
          .from("financial_transactions")
          .select("amount")
          .eq("company_id", userCompanyId)
          .eq("type", "expense")
          .eq("status", "paid"),
        supabase
          .from("financial_transactions")
          .select("amount")
          .eq("company_id", userCompanyId)
          .eq("type", "income")
          .eq("status", "pending")
          .lt("due_date", todayStart.slice(0, 10)),
        supabase
          .from("financial_transactions")
          .select("amount")
          .eq("company_id", userCompanyId)
          .eq("type", "expense")
          .eq("status", "pending")
          .lt("due_date", todayStart.slice(0, 10)),
        supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .eq("company_id", userCompanyId)
          .in("status", ["open", "pending", "in_progress"]),
        supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .eq("company_id", userCompanyId)
          .in("status", ["open", "pending", "in_progress"])
          .lt("sla_deadline", now),
        supabase
          .from("service_orders")
          .select("*", { count: "exact", head: true })
          .eq("company_id", userCompanyId)
          .gte("event_start_date", now)
          .lte("event_start_date", next7Days),
        supabase
          .from("quotes")
          .select("*", { count: "exact", head: true })
          .eq("company_id", userCompanyId)
          .in("status", ["draft", "pending_approval"]),
        supabase
          .from("quotes")
          .select("id, title, status, final_amount, valid_until, created_at")
          .eq("company_id", userCompanyId)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("service_orders")
          .select("id, status, event_start_date, event_end_date")
          .eq("company_id", userCompanyId)
          .gte("event_start_date", now)
          .lte("event_start_date", next7Days)
          .order("event_start_date", { ascending: true })
          .limit(3),
        supabase
          .from("tickets")
          .select("id, title, status, priority, category, sla_deadline")
          .eq("company_id", userCompanyId)
          .in("status", ["open", "pending", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const error = [
        paidIncomeRes.error,
        paidExpenseRes.error,
        overdueIncomeRes.error,
        overdueExpenseRes.error,
        openTicketsRes.error,
        overdueTicketsRes.error,
        upcomingOrdersRes.error,
        pendingQuotesRes.error,
        quotesRecentRes.error,
        ordersListRes.error,
        ticketsListRes.error,
      ].find(Boolean);

      if (error) throw error;

      const sumAmount = (rows: FinancialAmountRow[] | null) =>
        (rows ?? []).reduce((acc, curr) => acc + toNumber(curr.amount), 0);

      const totalIncomePaid = sumAmount(
        (paidIncomeRes.data as FinancialAmountRow[] | null) ?? []
      );
      const totalExpensePaid = sumAmount(
        (paidExpenseRes.data as FinancialAmountRow[] | null) ?? []
      );
      const overdueIncome = sumAmount(
        (overdueIncomeRes.data as FinancialAmountRow[] | null) ?? []
      );
      const overdueExpense = sumAmount(
        (overdueExpenseRes.data as FinancialAmountRow[] | null) ?? []
      );

      setState({
        totalIncomePaid,
        totalExpensePaid,
        balance: totalIncomePaid - totalExpensePaid,
        pendingQuotes: pendingQuotesRes.count ?? 0,
        upcomingServiceOrders: upcomingOrdersRes.count ?? 0,
        openTickets: openTicketsRes.count ?? 0,
        overdueTickets: overdueTicketsRes.count ?? 0,
        overdueIncome,
        overdueExpense,
      });

      setRecentQuotes((quotesRecentRes.data as QuoteRow[] | null) ?? []);
      setUpcomingOrders((ordersListRes.data as ServiceOrderRow[] | null) ?? []);
      setPriorityTickets((ticketsListRes.data as TicketRow[] | null) ?? []);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setErrorMessage("Não foi possível carregar o painel agora.");
    }
  }, [userCompanyId]); // recarrega se a empresa ativa mudar

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

  const topCards = [
    {
      title: "Receitas pagas",
      value: formatCurrency(state.totalIncomePaid),
      href: "/financeiro",
      icon: TrendingUp,
      accent: "text-cs-green bg-cs-green/10",
    },
    {
      title: "Despesas pagas",
      value: formatCurrency(state.totalExpensePaid),
      href: "/financeiro",
      icon: TrendingDown,
      accent: "text-red-400 bg-red-500/10",
    },
    {
      title: "Saldo em caixa",
      value: formatCurrency(state.balance),
      href: "/financeiro",
      icon: Wallet,
      accent:
        state.balance >= 0
          ? "text-cs-green bg-cs-green/10"
          : "text-red-400 bg-red-500/10",
    },
    {
      title: `${labels.quotes} pendentes`,
      value: String(state.pendingQuotes),
      href: "/orcamentos",
      icon: FileText,
      accent: "text-cs-gold bg-cs-gold/10",
    },
    {
      title: `${labels.serviceOrders} próximas`,
      value: String(state.upcomingServiceOrders),
      href: "/os",
      icon: CalendarClock,
      accent: "text-blue-300 bg-blue-500/10",
    },
    {
      title: "Tickets abertos",
      value: String(state.openTickets),
      href: "/suporte",
      icon: Ticket,
      accent: "text-orange-300 bg-orange-500/10",
    },
  ].filter((card) => {
    if (card.href === "/orcamentos") return featureToggles.enable_quotes !== false;
    if (card.href === "/os") return featureToggles.enable_service_orders !== false;
    if (card.href === "/suporte") return featureToggles.enable_support !== false;
    return true;
  });

  const alerts = [
    state.overdueIncome > 0
      ? {
          title: "Receitas vencidas",
          description: `${formatCurrency(state.overdueIncome)} aguardando cobrança.`,
          href: "/financeiro",
        }
      : null,
    state.overdueExpense > 0
      ? {
          title: "Despesas vencidas",
          description: `${formatCurrency(state.overdueExpense)} aguardando pagamento.`,
          href: "/financeiro",
        }
      : null,
    state.overdueTickets > 0
      ? {
          title: "Tickets fora do SLA",
          description: `${state.overdueTickets} chamado(s) requerem ação imediata.`,
          href: "/suporte",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; description: string; href: string }>;

  const latestQuote = recentQuotes[0] ?? null;
  const nextOrder = upcomingOrders[0] ?? null;
  const topTicket = priorityTickets[0] ?? null;

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
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <section className="rounded-3xl border border-white/10 bg-surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cs-green/20 bg-cs-green/10 px-3 py-1 text-xs font-semibold text-cs-green">
              <LayoutDashboard className="h-3.5 w-3.5" />
              {labels.dashboard}
            </div>
            <h1 className="text-2xl font-semibold text-white">Painel operacional</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Visão rápida com prioridades reais, sem duplicar as abas do sistema.
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {topCards.map((card) => {
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
                <div className={`rounded-2xl p-3 ${card.accent}`}>
                  <Icon size={22} />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
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
          title="Próxima operação"
          count={upcomingOrders.length}
          open={openPanels.operations}
          onToggle={() => setOpenPanels((p) => ({ ...p, operations: !p.operations }))}
        >
          {nextOrder ? (
            <CompactRow
              href="/os"
              title={`OS ${shortId(nextOrder.id)}`}
              subtitle={`Início ${formatDate(nextOrder.event_start_date)} · Fim ${formatDate(nextOrder.event_end_date)}`}
              meta={nextOrder.status || "pending"}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-background px-4 py-5 text-sm text-text-secondary">
              Nenhuma operação próxima.
            </div>
          )}
        </SmallToggleSection>

        <SmallToggleSection
          title="Ticket prioritário"
          count={priorityTickets.length}
          open={openPanels.support}
          onToggle={() => setOpenPanels((p) => ({ ...p, support: !p.support }))}
        >
          {topTicket ? (
            <CompactRow
              href="/suporte"
              title={topTicket.title || `Ticket ${shortId(topTicket.id)}`}
              subtitle={`${topTicket.category || "Sem categoria"} · SLA ${formatDate(topTicket.sla_deadline)}`}
              meta={topTicket.priority || topTicket.status || "open"}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-background px-4 py-5 text-sm text-text-secondary">
              Nenhum ticket em aberto.
            </div>
          )}
        </SmallToggleSection>
      </section>

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
            subtitle={`Valor ${formatCurrency(toNumber(latestQuote.final_amount))} · Criado em ${formatDate(latestQuote.created_at)}`}
            meta={latestQuote.status || "draft"}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-background px-4 py-5 text-sm text-text-secondary">
            Nenhum orçamento recente.
          </div>
        )}
      </SmallToggleSection>
    </div>
  );
}