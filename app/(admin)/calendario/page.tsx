"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Truck,
  Wallet,
  Megaphone,
  Ticket,
  X,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useSettings } from "../../providers/SettingsProvider";

type CalendarEvent = {
  id: string;
  rawId: string;
  date: string;
  time: string;
  title: string;
  description: string;
  type: "os" | "finance" | "marketing" | "ticket";
  moduleName: string;
  route: string;
  icon: any;
  color: string;
  sortDate: number;
};

const MAX_VISIBLE_EVENTS_PER_DAY = 2;

export default function CalendarioPage() {
  const router = useRouter();
  const { systemPreferences, companyProfile } = useSettings();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const customLabels = systemPreferences?.custom_labels || {};
  const featureToggles = systemPreferences?.feature_toggles || {};
  const currencyCode = systemPreferences?.currency_code || "BRL";

  const serviceOrderSingular =
    customLabels?.entity_service_order_singular || "Ordem de Serviço";
  const serviceOrderPlural =
    customLabels?.entity_service_order_plural || "Ordens de Serviço";
  const supportLabel = customLabels?.menu_support || "Suporte Técnico";
  const financeLabel = customLabels?.menu_financial || "Financeiro";
  const marketingLabel = customLabels?.menu_marketing || "Marketing";
  const calendarLabel = customLabels?.menu_calendar || "Calendário";

  const isCrmEnabled = featureToggles?.enable_crm !== false;
  const isFinancialEnabled = featureToggles?.enable_financial !== false;
  const isMarketingEnabled = featureToggles?.enable_marketing !== false;
  const isSupportEnabled = featureToggles?.enable_support !== false;
  const isServiceOrdersEnabled = featureToggles?.enable_service_orders !== false;

  useEffect(() => {
    fetchAllEvents();
  }, [currentDate, systemPreferences]);

  const formatCurrency = (value: number) => {
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currencyCode,
      }).format(Number(value || 0));
    } catch {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(value || 0));
    }
  };

  const normalizeDateOnly = (value: string | Date) => {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
  };

  const formatTime = (value: string | Date) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--:--";

    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchAllEvents = async () => {
    setLoading(true);

    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1,
      0,
      0,
      0
    ).toISOString();

    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 2,
      0,
      23,
      59,
      59
    ).toISOString();

    try {
      const requests: Promise<any>[] = [];

      if (isServiceOrdersEnabled) {
        requests.push(
          supabase
            .from("service_orders")
            .select("id, event_start_date, status, quotes(title)")
            .gte("event_start_date", startOfMonth)
            .lte("event_start_date", endOfMonth)
        );
      } else {
        requests.push(Promise.resolve({ data: [], error: null }));
      }

      if (isFinancialEnabled) {
        requests.push(
          supabase
            .from("financial_transactions")
            .select("id, due_date, description, type, status, amount")
            .gte("due_date", startOfMonth)
            .lte("due_date", endOfMonth)
        );
      } else {
        requests.push(Promise.resolve({ data: [], error: null }));
      }

      if (isMarketingEnabled) {
        requests.push(
          supabase
            .from("marketing_posts")
            .select("id, scheduled_for, title, status")
            .gte("scheduled_for", startOfMonth)
            .lte("scheduled_for", endOfMonth)
        );
      } else {
        requests.push(Promise.resolve({ data: [], error: null }));
      }

      if (isSupportEnabled) {
        requests.push(
          supabase
            .from("tickets")
            .select("id, sla_deadline, title, status, priority")
            .gte("sla_deadline", startOfMonth)
            .lte("sla_deadline", endOfMonth)
        );
      } else {
        requests.push(Promise.resolve({ data: [], error: null }));
      }

      const [osRes, finRes, mktRes, tktRes] = await Promise.all(requests);
      const normalizedEvents: CalendarEvent[] = [];

      if (osRes?.data?.length) {
        osRes.data.forEach((os: any) => {
          if (!os?.event_start_date) return;

          const quoteTitle = Array.isArray(os.quotes)
            ? os.quotes[0]?.title
            : os.quotes?.title;

          normalizedEvents.push({
            id: `os-${os.id}`,
            rawId: os.id,
            date: normalizeDateOnly(os.event_start_date),
            time: formatTime(os.event_start_date),
            title: `${serviceOrderSingular}: ${quoteTitle || "Sem título"}`,
            description: `Status: ${String(os.status || "não informado").replace(/_/g, " ")}`,
            type: "os",
            moduleName: serviceOrderPlural,
            route: `/os?id=${os.id}`,
            icon: Truck,
            color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
            sortDate: new Date(os.event_start_date).getTime(),
          });
        });
      }

      if (finRes?.data?.length) {
        finRes.data.forEach((fin: any) => {
          if (!fin?.due_date) return;

          const transactionType =
            fin.type === "income" ? "Receber" : "Pagar";
          const transactionStatus = String(fin.status || "não informado").replace(/_/g, " ");

          normalizedEvents.push({
            id: `fin-${fin.id}`,
            rawId: fin.id,
            date: normalizeDateOnly(fin.due_date),
            time: "Vencimento",
            title: `${transactionType}: ${fin.description || "Sem descrição"}`,
            description: `Valor: ${formatCurrency(fin.amount)} | Status: ${transactionStatus}`,
            type: "finance",
            moduleName: financeLabel,
            route: `/financeiro?transaction=${fin.id}`,
            icon: Wallet,
            color:
              fin.type === "income"
                ? "bg-cs-green/20 text-cs-green border-cs-green/30"
                : "bg-red-500/20 text-red-400 border-red-500/30",
            sortDate: new Date(fin.due_date).getTime(),
          });
        });
      }

      if (mktRes?.data?.length) {
        mktRes.data.forEach((mkt: any) => {
          if (!mkt?.scheduled_for) return;

          normalizedEvents.push({
            id: `mkt-${mkt.id}`,
            rawId: mkt.id,
            date: normalizeDateOnly(mkt.scheduled_for),
            time: formatTime(mkt.scheduled_for),
            title: `Post: ${mkt.title || "Sem título"}`,
            description: `Status: ${String(mkt.status || "não informado").replace(/_/g, " ")}`,
            type: "marketing",
            moduleName: marketingLabel,
            route: `/marketing?post=${mkt.id}`,
            icon: Megaphone,
            color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
            sortDate: new Date(mkt.scheduled_for).getTime(),
          });
        });
      }

      if (tktRes?.data?.length) {
        tktRes.data.forEach((tkt: any) => {
          if (!tkt?.sla_deadline || tkt?.status === "resolved") return;

          normalizedEvents.push({
            id: `tkt-${tkt.id}`,
            rawId: tkt.id,
            date: normalizeDateOnly(tkt.sla_deadline),
            time: formatTime(tkt.sla_deadline),
            title: `SLA: ${tkt.title || "Sem título"}`,
            description: `Prioridade: ${String(tkt.priority || "não informada").replace(/_/g, " ")} | Status: ${String(tkt.status || "não informado").replace(/_/g, " ")}`,
            type: "ticket",
            moduleName: supportLabel,
            route: `/suporte?ticket=${tkt.id}`,
            icon: Ticket,
            color: "bg-cs-gold/20 text-cs-gold border-cs-gold/30",
            sortDate: new Date(tkt.sla_deadline).getTime(),
          });
        });
      }

      normalizedEvents.sort((a, b) => a.sortDate - b.sortDate);
      setEvents(normalizedEvents);
    } catch (error) {
      console.error("Erro ao buscar calendário:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const prevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const goToToday = () => setCurrentDate(new Date());

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedEvent) setSelectedEvent(null);
        if (expandedDate) setExpandedDate(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedEvent, expandedDate]);

  const todayString = useMemo(() => normalizeDateOnly(new Date()), []);

  const toggleExpandedDate = (date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  return (
    <div className="space-y-6 h-full flex flex-col relative">
      <div className="flex justify-between items-center bg-surface p-4 border border-surface/50 rounded-lg shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-cs-green/10 rounded-md text-cs-green">
            <CalendarDays size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white capitalize">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <p className="text-xs text-text-secondary">Visão unificada da operação</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors"
          >
            Hoje
          </button>
          <div className="flex items-center gap-1 bg-background border border-surface/50 rounded-md p-1">
            <button
              onClick={prevMonth}
              className="p-1.5 text-text-secondary hover:text-white hover:bg-surface rounded transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 text-text-secondary hover:text-white hover:bg-surface rounded transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 px-2 shrink-0">
        {isServiceOrdersEnabled && (
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <span className="w-3 h-3 rounded-full bg-blue-500/50 border border-blue-500"></span>
            {serviceOrderPlural}
          </div>
        )}
        {isFinancialEnabled && (
          <>
            <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <span className="w-3 h-3 rounded-full bg-cs-green/50 border border-cs-green"></span>
              Receitas
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <span className="w-3 h-3 rounded-full bg-red-500/50 border border-red-500"></span>
              Despesas
            </div>
          </>
        )}
        {isMarketingEnabled && (
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <span className="w-3 h-3 rounded-full bg-purple-500/50 border border-purple-500"></span>
            {marketingLabel}
          </div>
        )}
        {isSupportEnabled && (
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <span className="w-3 h-3 rounded-full bg-cs-gold/50 border border-cs-gold"></span>
            Tickets (SLA)
          </div>
        )}
      </div>

      <div className="flex-1 bg-surface border border-surface/50 rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="grid grid-cols-7 border-b border-surface/50 bg-background/50 shrink-0">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-xs font-bold text-text-secondary uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-cs-green" size={32} />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto custom-scrollbar min-h-0">
            {blanks.map((blank) => (
              <div
                key={`blank-${blank}`}
                className="border-b border-r border-surface/50 bg-background/20 p-2 min-h-[140px]"
              ></div>
            ))}

            {days.map((day) => {
              const cellDate = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                day
              );
              const cellDateString = normalizeDateOnly(cellDate);
              const dayEvents = events.filter((e) => e.date === cellDateString);
              const isToday = cellDateString === todayString;
              const isExpanded = expandedDate === cellDateString;
              const visibleEvents = isExpanded
                ? dayEvents
                : dayEvents.slice(0, MAX_VISIBLE_EVENTS_PER_DAY);
              const hiddenCount =
                dayEvents.length > MAX_VISIBLE_EVENTS_PER_DAY
                  ? dayEvents.length - MAX_VISIBLE_EVENTS_PER_DAY
                  : 0;

              return (
                <div
                  key={day}
                  className={`border-b border-r border-surface/50 p-2 min-h-[140px] transition-colors hover:bg-background/30 align-top overflow-hidden ${
                    isToday ? "bg-cs-green/5" : ""
                  }`}
                >
                  <div
                    className={`text-sm font-bold mb-2 w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday ? "bg-cs-green text-white" : "text-text-secondary"
                    }`}
                  >
                    {day}
                  </div>

                  <div className="space-y-1.5 relative z-10 overflow-hidden">
                    {visibleEvents.map((event) => {
                      const Icon = event.icon;

                      return (
                        <button
                          key={event.id}
                          title={event.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                          }}
                          className={`w-full px-2 py-1.5 rounded border text-[10px] font-medium flex items-center gap-1.5 hover:opacity-80 transition-opacity relative z-20 overflow-hidden ${event.color}`}
                        >
                          <Icon size={10} className="shrink-0" />
                          <span className="truncate text-left flex-1">{event.title}</span>
                        </button>
                      );
                    })}

                    {!isExpanded && hiddenCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpandedDate(cellDateString);
                        }}
                        className="w-full px-2 py-1.5 rounded border border-surface/50 bg-background/40 text-[10px] font-semibold text-text-secondary hover:text-white hover:bg-background/60 transition-colors flex items-center justify-between gap-2"
                      >
                        <span>+{hiddenCount} itens</span>
                        <ChevronDown size={12} />
                      </button>
                    )}

                    {isExpanded && dayEvents.length > MAX_VISIBLE_EVENTS_PER_DAY && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpandedDate(cellDateString);
                        }}
                        className="w-full px-2 py-1.5 rounded border border-surface/50 bg-background/40 text-[10px] font-semibold text-text-secondary hover:text-white hover:bg-background/60 transition-colors flex items-center justify-between gap-2"
                      >
                        <span>Recolher</span>
                        <ChevronUp size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="p-8 text-center text-text-secondary">
            Nenhum evento encontrado neste período.
          </div>
        )}
      </div>

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-surface border border-surface/50 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-surface/50 bg-background/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md border ${selectedEvent.color}`}>
                  <selectedEvent.icon size={20} />
                </div>
                <h2 className="text-lg font-bold text-white">Detalhes do Agendamento</h2>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-text-secondary hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">
                  Módulo
                </p>
                <p className="font-medium text-white">{selectedEvent.moduleName}</p>
              </div>

              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">
                  Título / Descrição
                </p>
                <p className="font-medium text-white">{selectedEvent.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">
                    Data
                  </p>
                  <p className="font-medium text-white">
                    {new Date(`${selectedEvent.date}T00:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">
                    Horário
                  </p>
                  <p className="font-medium text-white">{selectedEvent.time}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">
                  Informações Adicionais
                </p>
                <p className="font-medium text-white capitalize">
                  {selectedEvent.description.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-surface/50 bg-background/50 flex justify-end">
              <button
                onClick={() => router.push(selectedEvent.route)}
                className="flex items-center gap-2 rounded-md bg-cs-green py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-all"
              >
                Ir para {selectedEvent.moduleName} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}