"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  AlertCircle,
  Clock,
} from "lucide-react";
import { useSettings } from "../../providers/SettingsProvider";

// --- TIPAGENS ---
type CalendarEventType = "os" | "finance" | "marketing" | "ticket";

interface CalendarEvent {
  id: string;
  rawId: string;
  date: string;
  time: string;
  title: string;
  description: string;
  type: CalendarEventType;
  moduleName: string;
  route: string;
  icon: React.ElementType;
  color: string;
  status: string;
  amount?: number;
  sortDate: number;
}

const MAX_VISIBLE_EVENTS_PER_DAY = 3;

export default function CalendarioPage() {
  const router = useRouter();
  const { systemPreferences } = useSettings();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // --- CONFIGURAÇÕES (apenas dados, labels ficam fora do fetch) ---
  const labels = systemPreferences?.custom_labels || {};
  const toggles = systemPreferences?.feature_toggles || {};
  const currencyCode = systemPreferences?.currency_code || "BRL";

  // Labels de apresentação — usados apenas no render, não no fetch
  const osSingular     = labels.entity_service_order_singular || "OS";
  const osPlural       = labels.entity_service_order_plural   || "Ordens de Serviço";
  const financeLabel   = labels.menu_financial                || "Financeiro";
  const marketingLabel = labels.menu_marketing                || "Marketing";
  const supportLabel   = labels.menu_support                  || "Suporte";

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: currencyCode }).format(value);

  const normalizeDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
  };

  const formatTime = (isoString: string) =>
    new Date(isoString).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // --- FETCH: depende apenas de dados, não de labels ---
  const fetchAllEvents = useCallback(async () => {
    setLoading(true);

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
    const endOfMonth   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const rawEvents: Array<{ source: string; item: any }> = [];
    const promises: Promise<any>[] = [];

    if (toggles.enable_service_orders) {
      promises.push(
        supabase.from("service_orders")
          .select("id, event_start_date, status, quotes(title)")
          .gte("event_start_date", startOfMonth)
          .lte("event_start_date", endOfMonth)
          .then((r) => r.data?.forEach((item: any) => rawEvents.push({ source: "os", item })))
      );
    }
    if (toggles.enable_financial) {
      promises.push(
        supabase.from("financial_transactions")
          .select("id, due_date, description, type, status, amount")
          .gte("due_date", startOfMonth)
          .lte("due_date", endOfMonth)
          .then((r) => r.data?.forEach((item: any) => rawEvents.push({ source: "finance", item })))
      );
    }
    if (toggles.enable_marketing) {
      promises.push(
        supabase.from("marketing_posts")
          .select("id, scheduled_for, title, status")
          .gte("scheduled_for", startOfMonth)
          .lte("scheduled_for", endOfMonth)
          .then((r) => r.data?.forEach((item: any) => rawEvents.push({ source: "marketing", item })))
      );
    }
    if (toggles.enable_support) {
      promises.push(
        supabase.from("tickets")
          .select("id, sla_deadline, title, status")
          .gte("sla_deadline", startOfMonth)
          .lte("sla_deadline", endOfMonth)
          .then((r) => r.data?.forEach((item: any) => rawEvents.push({ source: "ticket", item })))
      );
    }

    await Promise.allSettled(promises);

    // Mapeamento feito depois do fetch — labels são capturadas no closure do render,
    // mas o fetch não as tem como dependência
    const normalized: CalendarEvent[] = rawEvents.flatMap(({ source, item }) => {
      if (source === "os" && item.event_start_date) {
        return [{
          id: `os-${item.id}`, rawId: item.id,
          date: normalizeDate(item.event_start_date),
          time: formatTime(item.event_start_date),
          title: item.quotes?.title || "OS",
          description: "Status operacional da OS",
          type: "os" as CalendarEventType,
          moduleName: "Ordens de Serviço",
          route: "/os", status: item.status,
          icon: Truck,
          color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
          sortDate: new Date(item.event_start_date).getTime(),
        }];
      }
      if (source === "finance" && item.due_date) {
        return [{
          id: `fin-${item.id}`, rawId: item.id,
          date: normalizeDate(item.due_date),
          time: "Vencimento",
          title: item.description,
          description: item.type === "income" ? "Receita Prevista" : "Despesa Lançada",
          type: "finance" as CalendarEventType,
          moduleName: "Financeiro",
          route: "/financeiro", status: item.status,
          amount: item.amount,
          icon: Wallet,
          color: item.type === "income"
            ? "bg-cs-green/20 text-cs-green border-cs-green/30"
            : "bg-red-500/20 text-red-400 border-red-500/30",
          sortDate: new Date(item.due_date).getTime(),
        }];
      }
      if (source === "marketing" && item.scheduled_for) {
        return [{
          id: `mkt-${item.id}`, rawId: item.id,
          date: normalizeDate(item.scheduled_for),
          time: formatTime(item.scheduled_for),
          title: item.title,
          description: "Agendamento de Marketing",
          type: "marketing" as CalendarEventType,
          moduleName: "Marketing",
          route: "/marketing", status: item.status,
          icon: Megaphone,
          color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
          sortDate: new Date(item.scheduled_for).getTime(),
        }];
      }
      if (source === "ticket" && item.sla_deadline) {
        return [{
          id: `tkt-${item.id}`, rawId: item.id,
          date: normalizeDate(item.sla_deadline),
          time: formatTime(item.sla_deadline),
          title: item.title,
          description: "Prazo de SLA do Ticket",
          type: "ticket" as CalendarEventType,
          moduleName: "Suporte",
          route: "/suporte", status: item.status,
          icon: Ticket,
          color: "bg-cs-gold/20 text-cs-gold border-cs-gold/30",
          sortDate: new Date(item.sla_deadline).getTime(),
        }];
      }
      return [];
    });

    setEvents(normalized.sort((a, b) => a.sortDate - b.sortDate));
    setLoading(false);
  }, [currentDate, toggles]); // ← apenas o que realmente afeta os dados

  useEffect(() => { fetchAllEvents(); }, [fetchAllEvents]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelectedEvent(null); setExpandedDate(null); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- NAVEGAÇÃO ---
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToToday  = () => setCurrentDate(new Date());

  const year            = currentDate.getFullYear();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const daysInMonth     = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const monthName       = currentDate.toLocaleString("pt-BR", { month: "long" });

  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface p-5 border border-surface/50 rounded-xl gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-cs-green/10 rounded-lg border border-cs-green/20">
            <CalendarDays className="text-cs-green" size={26} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
              {monthName} <span className="text-cs-green">{year}</span>
            </h3>
            <p className="text-[10px] text-text-secondary uppercase font-black tracking-widest">
              Cronograma Unificado ARXUM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-background p-1.5 rounded-lg border border-surface/50">
          <button onClick={goToToday} className="px-4 py-1.5 text-[10px] font-black uppercase text-text-secondary hover:text-white transition-all">
            Hoje
          </button>
          <div className="w-px h-4 bg-surface/50" />
          <button onClick={prevMonth} className="p-1.5 text-text-secondary hover:text-cs-green transition-all">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="p-1.5 text-text-secondary hover:text-cs-green transition-all">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* LEGENDA DINÂMICA */}
      <div className="flex flex-wrap gap-4 px-1">
        {toggles.enable_service_orders && (
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            {osPlural}
          </div>
        )}
        {toggles.enable_financial && (
          <>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary">
              <div className="w-2 h-2 rounded-full bg-cs-green shadow-[0_0_8px_rgba(19,137,70,0.5)]" /> Receitas
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary">
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> Despesas
            </div>
          </>
        )}
        {toggles.enable_marketing && (
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary">
            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
            {marketingLabel}
          </div>
        )}
        {toggles.enable_support && (
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary">
            <div className="w-2 h-2 rounded-full bg-cs-gold shadow-[0_0_8px_rgba(197,160,89,0.5)]" />
            {supportLabel}
          </div>
        )}
      </div>

      {/* GRADE DO CALENDÁRIO */}
      <div className="bg-surface border border-surface/50 rounded-xl overflow-hidden shadow-2xl">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b border-surface/50 bg-background/50">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
            <div key={day} className="py-3 text-center text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="animate-spin text-cs-green" size={40} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cs-green animate-pulse">
              Sincronizando ARXUM Cloud...
            </p>
          </div>
        ) : (
          /*
           * FIX PRINCIPAL:
           * - Removido `flex-1 auto-rows-fr overflow-y-auto` que comprimia os dias.
           * - Cada célula agora tem `min-h-[130px]` garantido, crescendo conforme o conteúdo.
           * - O scroll fica no container pai (página), não dentro do grid.
           */
          <div className="grid grid-cols-7">
            {/* Células em branco antes do dia 1 */}
            {blanks.map((b) => (
              <div
                key={`blank-${b}`}
                className="border-b border-r border-surface/30 bg-background/10 min-h-[130px]"
              />
            ))}

            {/* Células dos dias */}
            {days.map((day) => {
              const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents  = events.filter((e) => e.date === dateStr);
              const isToday    = dateStr === todayStr;
              const isExpanded = expandedDate === dateStr;

              const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE_EVENTS_PER_DAY);
              const hiddenCount   = dayEvents.length - MAX_VISIBLE_EVENTS_PER_DAY;

              return (
                <div
                  key={day}
                  className={`border-b border-r border-surface/30 p-2.5 min-h-[130px] transition-colors hover:bg-white/[0.02] flex flex-col gap-1.5 ${
                    isToday ? "bg-cs-green/[0.04]" : ""
                  }`}
                >
                  {/* Número do dia */}
                  <div
                    className={`text-xs font-black w-7 h-7 flex items-center justify-center rounded-full shrink-0 ${
                      isToday
                        ? "bg-cs-green text-white shadow-[0_0_15px_rgba(19,137,70,0.4)]"
                        : "text-text-secondary/50"
                    }`}
                  >
                    {day}
                  </div>

                  {/* Eventos */}
                  <div className="flex flex-col gap-1 flex-1">
                    {visibleEvents.map((event) => {
                      const Icon = event.icon;
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full px-2 py-1.5 rounded border text-[9px] font-bold flex items-center gap-1.5 transition-all hover:brightness-125 text-left uppercase tracking-tighter ${event.color}`}
                        >
                          <Icon size={10} className="shrink-0" />
                          <span className="truncate">
                            {event.type === "finance"
                              ? formatCurrency(event.amount || 0)
                              : event.title}
                          </span>
                        </button>
                      );
                    })}

                    {hiddenCount > 0 && !isExpanded && (
                      <button
                        onClick={() => setExpandedDate(dateStr)}
                        className="w-full py-0.5 text-[8px] font-black text-cs-gold uppercase hover:text-white transition-colors text-left px-1"
                      >
                        + {hiddenCount} mais
                      </button>
                    )}

                    {isExpanded && dayEvents.length > MAX_VISIBLE_EVENTS_PER_DAY && (
                      <button
                        onClick={() => setExpandedDate(null)}
                        className="w-full py-0.5 text-[8px] font-black text-text-secondary uppercase hover:text-white transition-colors text-left px-1"
                      >
                        Recolher
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Estado vazio */}
        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle size={36} className="text-white/5" />
            <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">
              Nenhum registro para este período
            </p>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-[#1a1413] border border-surface/50 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-surface/50 flex justify-between items-start bg-background/50">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl border ${selectedEvent.color}`}>
                  <selectedEvent.icon size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-tighter leading-tight">
                    {selectedEvent.title}
                  </h2>
                  <p className="text-[10px] text-cs-gold font-black uppercase tracking-widest">
                    {selectedEvent.moduleName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-text-secondary hover:text-white transition-colors bg-surface p-2 rounded-full border border-surface/50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background p-4 rounded-xl border border-surface/50">
                  <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Data / Prazo</p>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock size={13} className="text-cs-gold" />
                    {new Date(`${selectedEvent.date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="bg-background p-4 rounded-xl border border-surface/50">
                  <p className="text-[9px] font-black text-text-secondary uppercase mb-1">Horário / Ref</p>
                  <p className="text-sm font-bold text-white uppercase">{selectedEvent.time}</p>
                </div>
              </div>

              <div className="bg-background p-4 rounded-xl border border-surface/50">
                <p className="text-[9px] font-black text-text-secondary uppercase mb-2">Informações Adicionais</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white/90">{selectedEvent.description}</p>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-surface border border-surface/50 text-[9px] font-black text-text-secondary uppercase">
                    {selectedEvent.status}
                  </span>
                </div>
              </div>

              {selectedEvent.amount !== undefined && (
                <div className="bg-cs-green/5 p-4 rounded-xl border border-cs-green/20 text-center">
                  <p className="text-[10px] font-black text-cs-green uppercase mb-1">Valor do Lançamento</p>
                  <p className="text-3xl font-black text-white">{formatCurrency(selectedEvent.amount)}</p>
                </div>
              )}
            </div>

            <div className="p-5 bg-background/80 border-t border-surface/50">
              <button
                onClick={() => router.push(selectedEvent.route)}
                className="w-full flex items-center justify-center gap-3 bg-cs-green text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-opacity-90 transition-all"
              >
                Gerenciar no Módulo <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}