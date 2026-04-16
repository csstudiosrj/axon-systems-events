"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { LayoutDashboard, FileText, Truck, Ticket, LogOut } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const[userEmail, setUserEmail] = useState<string | null>("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setUserEmail(session.user.email || "");
      }
    };
    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-surface border-r border-surface/50 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-surface/50">
          <h1 className="text-xl font-bold text-white">
            AXON <span className="text-cs-green">systems</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-cs-green/10 text-cs-green rounded-md transition-colors">
            <LayoutDashboard size={20} />
            <span className="font-medium">Visão Geral</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:bg-surface hover:text-white rounded-md transition-colors">
            <FileText size={20} />
            <span className="font-medium">Orçamentos</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:bg-surface hover:text-white rounded-md transition-colors">
            <Truck size={20} />
            <span className="font-medium">Ordens de Serviço</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:bg-surface hover:text-white rounded-md transition-colors">
            <Ticket size={20} />
            <span className="font-medium">Suporte Técnico</span>
          </a>
        </nav>

        <div className="p-4 border-t border-surface/50">
          <div className="px-4 py-2 mb-2 text-xs text-text-secondary truncate">
            {userEmail}
          </div>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2 text-text-secondary hover:text-cs-gold transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-surface border-b border-surface/50 flex items-center px-8 justify-between">
          <h2 className="text-lg font-medium text-white">Visão Geral</h2>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-cs-green flex items-center justify-center text-sm font-bold text-white">
              CS
            </div>
          </div>
        </header>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-surface border border-surface/50 p-6 rounded-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-cs-green/10 rounded-md text-cs-green">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Orçamentos Pendentes</p>
                  <p className="text-2xl font-bold text-white">12</p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-surface border border-surface/50 p-6 rounded-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-cs-gold/10 rounded-md text-cs-gold">
                  <Truck size={24} />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Eventos na Semana</p>
                  <p className="text-2xl font-bold text-white">4</p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-surface border border-surface/50 p-6 rounded-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-500/10 rounded-md text-red-500">
                  <Ticket size={24} />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Chamados Abertos</p>
                  <p className="text-2xl font-bold text-white">3</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}