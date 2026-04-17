"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { FileText, Truck, Ticket, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const[loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    pendingQuotes: 0,
    weeklyEvents: 0,
    openTickets: 0
  });

  useEffect(() => {
    fetchDashboardData();
  },[]);

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      // 1. Busca Orçamentos Pendentes (Rascunho ou Aguardando Aprovação)
      const { count: quotesCount } = await supabase
        .from("quotes")
        .select("*", { count: 'exact', head: true })
        .in("status", ["draft", "pending_approval"]);

      // 2. Busca Eventos (OS) da Semana Atual
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      
      const { count: osCount } = await supabase
        .from("service_orders")
        .select("*", { count: 'exact', head: true })
        .gte("event_start_date", today.toISOString())
        .lte("event_start_date", nextWeek.toISOString());

      // 3. Busca Chamados de Suporte Abertos
      const { count: ticketsCount } = await supabase
        .from("tickets")
        .select("*", { count: 'exact', head: true })
        .eq("status", "open");

      setMetrics({
        pendingQuotes: quotesCount || 0,
        weeklyEvents: osCount || 0,
        openTickets: ticketsCount || 0
      });

    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-cs-green" size={32} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: Orçamentos */}
      <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-cs-green/10 rounded-md text-cs-green">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-text-secondary">Orçamentos Pendentes</p>
            <p className="text-3xl font-bold text-white">{metrics.pendingQuotes}</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary border-t border-surface/50 pt-3">
          Aguardando aprovação do cliente
        </div>
      </div>

      {/* Card 2: Logística */}
      <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-cs-gold/10 rounded-md text-cs-gold">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-sm text-text-secondary">Eventos (Próx. 7 dias)</p>
            <p className="text-3xl font-bold text-white">{metrics.weeklyEvents}</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary border-t border-surface/50 pt-3">
          Ordens de serviço programadas
        </div>
      </div>

      {/* Card 3: Suporte */}
      <div className="bg-surface border border-surface/50 p-6 rounded-lg shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-red-500/10 rounded-md text-red-500">
            <Ticket size={24} />
          </div>
          <div>
            <p className="text-sm text-text-secondary">Chamados Abertos</p>
            <p className="text-3xl font-bold text-white">{metrics.openTickets}</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary border-t border-surface/50 pt-3">
          Tickets aguardando atendimento
        </div>
      </div>
    </div>
  );
}