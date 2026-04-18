"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { PlaySquare, Ticket, Calendar, ArrowRight, Loader2, CreditCard, Clock } from "lucide-react";
import Link from "next/link";

export default function PortalHomePage() {
  const[loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const[recentTickets, setRecentTickets] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserName(session.user.email?.split('@')[0] || "Cliente");
        
        // Busca os últimos 3 chamados abertos pelo cliente (Simulação por enquanto)
        const { data } = await supabase
          .from("tickets")
          .select("id, title, status, created_at")
          .order("created_at", { ascending: false })
          .limit(3);
          
        if (data) setRecentTickets(data);
      }
      setLoading(false);
    };
    fetchUserData();
  },[]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-cs-green" size={48} />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background">
      {/* Hero Section (Boas-vindas) */}
      <div className="relative overflow-hidden bg-surface border-b border-surface/50">
        <div className="absolute inset-0 bg-gradient-to-r from-cs-green/20 to-transparent opacity-50"></div>
        <div className="max-w-7xl mx-auto px-8 py-16 relative z-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 capitalize">
            Olá, {userName}.
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl">
            Bem-vindo ao seu portal exclusivo da CS com. Acesse seus treinamentos, acompanhe seus eventos e fale com nosso suporte técnico.
          </p>
        </div>
      </div>

      {/* Cards de Acesso Rápido */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1: Treinamentos (Netflix) */}
          <Link href="/portal/treinamentos" className="group relative bg-surface border border-surface/50 rounded-2xl p-8 hover:border-cs-green/50 transition-all hover:shadow-[0_0_30px_rgba(19,137,70,0.15)] overflow-hidden flex flex-col h-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cs-green/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="h-14 w-14 bg-cs-green/20 rounded-xl flex items-center justify-center text-cs-green mb-6 relative z-10">
              <PlaySquare size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 relative z-10">Academia AXON</h2>
            <p className="text-text-secondary mb-8 flex-1 relative z-10">
              Acesse a plataforma de treinamentos em vídeo para capacitar sua equipe na operação dos sistemas.
            </p>
            <div className="flex items-center text-cs-green font-medium text-sm relative z-10 group-hover:translate-x-2 transition-transform">
              Acessar Cursos <ArrowRight size={16} className="ml-2" />
            </div>
          </Link>

          {/* Card 2: Suporte Técnico */}
          <Link href="/portal/suporte" className="group relative bg-surface border border-surface/50 rounded-2xl p-8 hover:border-cs-gold/50 transition-all hover:shadow-[0_0_30px_rgba(197,160,89,0.15)] overflow-hidden flex flex-col h-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cs-gold/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="h-14 w-14 bg-cs-gold/20 rounded-xl flex items-center justify-center text-cs-gold mb-6 relative z-10">
              <Ticket size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 relative z-10">Suporte Técnico</h2>
            <p className="text-text-secondary mb-8 flex-1 relative z-10">
              Abra chamados, relate problemas nos equipamentos e acompanhe o status de resolução em tempo real.
            </p>
            <div className="flex items-center text-cs-gold font-medium text-sm relative z-10 group-hover:translate-x-2 transition-transform">
              Abrir Chamado <ArrowRight size={16} className="ml-2" />
            </div>
          </Link>

          {/* Card 3: Faturas / Eventos */}
          <div className="group relative bg-surface border border-surface/50 rounded-2xl p-8 hover:border-blue-500/50 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] overflow-hidden flex flex-col h-full opacity-70 cursor-not-allowed">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="h-14 w-14 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-6 relative z-10">
              <CreditCard size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 relative z-10">Faturas e Contratos</h2>
            <p className="text-text-secondary mb-8 flex-1 relative z-10">
              Visualize seus contratos ativos, propostas comerciais e histórico de faturas.
            </p>
            <div className="flex items-center text-text-secondary font-medium text-sm relative z-10">
              Em breve <Clock size={14} className="ml-2" />
            </div>
          </div>

        </div>

        {/* Seção de Atividades Recentes */}
        <div className="mt-16">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <Clock className="text-cs-green" size={24} />
            Atividades Recentes
          </h3>
          
          <div className="bg-surface border border-surface/50 rounded-xl overflow-hidden">
            {recentTickets.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                Nenhuma atividade recente encontrada.
              </div>
            ) : (
              <div className="divide-y divide-surface/50">
                {recentTickets.map(ticket => (
                  <div key={ticket.id} className="p-4 hover:bg-background/50 transition-colors flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{ticket.title}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        Aberto em {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      ticket.status === 'resolved' ? 'bg-cs-green/10 text-cs-green border-cs-green/20' : 
                      ticket.status === 'in_progress' ? 'bg-cs-gold/10 text-cs-gold border-cs-gold/20' : 
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {ticket.status === 'resolved' ? 'Resolvido' : ticket.status === 'in_progress' ? 'Em Andamento' : 'Aberto'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}