"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { LayoutDashboard, FileText, Truck, Ticket, LogOut, Users } from "lucide-react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>("");

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

  // Definição dinâmica do menu
  const navItems =[
    { name: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Orçamentos", href: "/orcamentos", icon: FileText },
    { name: "Ordens de Serviço", href: "/os", icon: Truck },
    { name: "Suporte Técnico", href: "/suporte", icon: Ticket },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary flex">
      {/* Sidebar Fixa */}
      <aside className="w-64 bg-surface border-r border-surface/50 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-surface/50">
          <h1 className="text-xl font-bold text-white">
            AXON <span className="text-cs-green">systems</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                  isActive 
                    ? "bg-cs-green/10 text-cs-green font-medium" 
                    : "text-text-secondary hover:bg-surface hover:text-white font-medium"
                }`}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
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

      {/* Área de Conteúdo Dinâmico */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-surface border-b border-surface/50 flex items-center px-8 justify-between shrink-0">
          <h2 className="text-lg font-medium text-white capitalize">
            {pathname.replace('/', '') || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-cs-green flex items-center justify-center text-sm font-bold text-white">
              CS
            </div>
          </div>
        </header>
        
        {/* Aqui é onde as páginas (Dashboard, Clientes) serão injetadas */}
        <div className="p-8 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}