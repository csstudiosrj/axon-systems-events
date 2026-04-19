"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { LayoutDashboard, FileText, Truck, Ticket, LogOut, Users, Package, Target, Wallet, Megaphone, CalendarDays, PlaySquare, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      // Busca o perfil real no banco de dados
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      // Se der erro ou não achar o perfil, expulsa por segurança (NUNCA dar acesso admin por padrão)
      if (error || !profile) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      // Se for cliente, aluno ou assinante, expulsa pro portal
      if (['client', 'student', 'subscriber'].includes(profile.role)) {
        router.push("/portal");
        return;
      }

      // Se passou por todas as travas, autoriza o acesso
      setUserProfile(profile);
      setAuthorized(true);
      setLoading(false);
    };

    checkUser();
  },[router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const allNavItems =[
    { name: "Visão Geral", href: "/dashboard", icon: LayoutDashboard, roles:['super_admin', 'admin', 'commercial', 'financial', 'logistics', 'marketing', 'training', 'support'] },
    { name: "Calendário Geral", href: "/calendario", icon: CalendarDays, roles:['super_admin', 'admin', 'commercial', 'logistics'] },
    { name: "CRM / Vendas", href: "/crm", icon: Target, roles:['super_admin', 'admin', 'commercial', 'financial'] },
    { name: "Financeiro", href: "/financeiro", icon: Wallet, roles:['super_admin', 'admin', 'financial'] },
    { name: "Marketing", href: "/marketing", icon: Megaphone, roles:['super_admin', 'admin', 'marketing'] },
    { name: "Treinamentos", href: "/treinamentos", icon: PlaySquare, roles: ['super_admin', 'admin', 'training'] },
    { name: "Clientes", href: "/clientes", icon: Users, roles:['super_admin', 'admin', 'commercial', 'financial'] },
    { name: "Inventário", href: "/inventario", icon: Package, roles:['super_admin', 'admin', 'logistics', 'commercial'] },
    { name: "Orçamentos", href: "/orcamentos", icon: FileText, roles:['super_admin', 'admin', 'commercial', 'financial'] },
    { name: "Ordens de Serviço", href: "/os", icon: Truck, roles:['super_admin', 'admin', 'logistics', 'commercial', 'support'] },
    { name: "Suporte Técnico", href: "/suporte", icon: Ticket, roles:['super_admin', 'admin', 'support'] },
  ];

  // Tela de carregamento enquanto verifica a segurança
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-cs-green" size={48} />
      </div>
    );
  }

  // Se não estiver autorizado, não renderiza absolutamente nada (evita piscar a tela)
  if (!authorized) return null;

  const allowedNavItems = allNavItems.filter(item => 
    userProfile ? item.roles.includes(userProfile.role) : false
  );

  return (
    <div className="min-h-screen bg-background text-text-primary flex print:bg-white">
      <aside className="w-64 bg-surface border-r border-surface/50 flex flex-col print:hidden">
        <div className="h-16 flex items-center px-6 border-b border-surface/50">
          <h1 className="text-xl font-bold text-white">
            AXON <span className="text-cs-green">systems</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {allowedNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                  isActive ? "bg-cs-green/10 text-cs-green font-medium" : "text-text-secondary hover:bg-surface hover:text-white font-medium"
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
            {userProfile?.email}
            <span className="block text-[10px] text-cs-gold uppercase mt-0.5">{userProfile?.role.replace('_', ' ')}</span>
          </div>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-2 text-text-secondary hover:text-cs-gold transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Sair do sistema</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible print:bg-white">
        <header className="h-16 bg-surface border-b border-surface/50 flex items-center px-8 justify-between shrink-0 print:hidden">
          <h2 className="text-lg font-medium text-white capitalize">{pathname.replace('/', '') || 'Dashboard'}</h2>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-cs-green flex items-center justify-center text-sm font-bold text-white uppercase">
              {userProfile?.email?.substring(0, 2)}
            </div>
          </div>
        </header>
        <div className="p-8 flex-1 overflow-y-auto print:p-0 print:overflow-visible print:bg-white">
          {children}
        </div>
      </main>
    </div>
  );
}