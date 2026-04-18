"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Truck, Wallet, Megaphone, Ticket } from "lucide-react";

export default function CalendarioPage() {
  const[currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllEvents();
  },[currentDate]);

  const fetchAllEvents = async () => {
    setLoading(true);
    
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();

    try {
      const[osRes, finRes, mktRes, tktRes] = await Promise.all([
        supabase.from("service_orders").select("id, event_start_date, status, quotes(title)").gte("event_start_date", startOfMonth).lte("event_start_date", endOfMonth),
        supabase.from("financial_transactions").select("id, due_date, description, type, status").gte("due_date", startOfMonth).lte("due_date", endOfMonth),
        supabase.from("marketing_posts").select("id, scheduled_for, title, status").gte("scheduled_for", startOfMonth).lte("scheduled_for", endOfMonth),
        supabase.from("tickets").select("id, sla_deadline, title, status").gte("sla_deadline", startOfMonth).lte("sla_deadline", endOfMonth)
      ]);

      const normalizedEvents: any[] =[];

      // 1. Normaliza Ordens de Serviço (Adicionado ': any' para blindar o TypeScript)
      if (osRes.data) {
        osRes.data.forEach((os: any) => {
          // Tratamento extra caso o Supabase retorne como array
          const quoteTitle = Array.isArray(os.quotes) ? os.quotes[0]?.title : os.quotes?.title;
          
          normalizedEvents.push({
            id: `os-${os.id}`,
            date: new Date(os.event_start_date).toISOString().split('T')[0],
            title: `OS: ${quoteTitle || 'Sem título'}`,
            type: 'os',
            icon: Truck,
            color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
          });
        });
      }

      // 2. Normaliza Financeiro
      if (finRes.data) {
        finRes.data.forEach((fin: any) => {
          normalizedEvents.push({
            id: `fin-${fin.id}`,
            date: new Date(fin.due_date).toISOString().split('T')[0],
            title: `${fin.type === 'income' ? 'Receber' : 'Pagar'}: ${fin.description}`,
            type: 'finance',
            icon: Wallet,
            color: fin.type === 'income' ? 'bg-cs-green/20 text-cs-green border-cs-green/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
          });
        });
      }

      // 3. Normaliza Marketing
      if (mktRes.data) {
        mktRes.data.forEach((mkt: any) => {
          normalizedEvents.push({
            id: `mkt-${mkt.id}`,
            date: new Date(mkt.scheduled_for).toISOString().split('T')[0],
            title: `Post: ${mkt.title}`,
            type: 'marketing',
            icon: Megaphone,
            color: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
          });
        });
      }

      // 4. Normaliza Tickets (SLA)
      if (tktRes.data) {
        tktRes.data.forEach((tkt: any) => {
          if (tkt.status !== 'resolved') {
            normalizedEvents.push({
              id: `tkt-${tkt.id}`,
              date: new Date(tkt.sla_deadline).toISOString().split('T')[0],
              title: `SLA: ${tkt.title}`,
              type: 'ticket',
              icon: Ticket,
              color: 'bg-cs-gold/20 text-cs-gold border-cs-gold/30'
            });
          }
        });
      }

      setEvents(normalizedEvents);
    } catch (error) {
      console.error("Erro ao buscar calendário:", error);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthNames =["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays =["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-6 h-full flex flex-col">
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
          <button onClick={goToToday} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors">
            Hoje
          </button>
          <div className="flex items-center gap-1 bg-background border border-surface/50 rounded-md p-1">
            <button onClick={prevMonth} className="p-1.5 text-text-secondary hover:text-white hover:bg-surface rounded transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextMonth} className="p-1.5 text-text-secondary hover:text-white hover:bg-surface rounded transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 px-2 shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><span className="w-3 h-3 rounded-full bg-blue-500/50 border border-blue-500"></span> Ordens de Serviço</div>
        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><span className="w-3 h-3 rounded-full bg-cs-green/50 border border-cs-green"></span> Receitas</div>
        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><span className="w-3 h-3 rounded-full bg-red-500/50 border border-red-500"></span> Despesas</div>
        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><span className="w-3 h-3 rounded-full bg-purple-500/50 border border-purple-500"></span> Marketing</div>
        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><span className="w-3 h-3 rounded-full bg-cs-gold/50 border border-cs-gold"></span> Tickets (SLA)</div>
      </div>

      <div className="flex-1 bg-surface border border-surface/50 rounded-lg overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 border-b border-surface/50 bg-background/50 shrink-0">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-text-secondary uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-cs-green" size={32} />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto custom-scrollbar">
            {blanks.map(blank => (
              <div key={`blank-${blank}`} className="border-b border-r border-surface/50 bg-background/20 p-2 min-h-[120px]"></div>
            ))}
            
            {days.map(day => {
              const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const cellDateString = new Date(cellDate.getTime() - cellDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
              
              const dayEvents = events.filter(e => e.date === cellDateString);
              const isToday = cellDateString === new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

              return (
                <div key={day} className={`border-b border-r border-surface/50 p-2 min-h-[120px] transition-colors hover:bg-background/30 ${isToday ? 'bg-cs-green/5' : ''}`}>
                  <div className={`text-sm font-bold mb-2 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-cs-green text-white' : 'text-text-secondary'}`}>
                    {day}
                  </div>
                  
                  <div className="space-y-1.5">
                    {dayEvents.map(event => {
                      const Icon = event.icon;
                      return (
                        <div 
                          key={event.id} 
                          title={event.title}
                          className={`px-2 py-1.5 rounded border text-[10px] font-medium truncate flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity ${event.color}`}
                        >
                          <Icon size={10} className="shrink-0" />
                          <span className="truncate">{event.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}