"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { LayoutDashboard, FileText, Truck, Ticket, LogOut, Users, Package, Target, Wallet, Megaphone, CalendarDays, PlaySquare, Loader2, ShieldCheck, Settings, User, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSettings } from "../providers/SettingsProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Context White-Label
  const { settings: settingsContext, loading: settingsLoading } = useSettings();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();

      if (error || !profile) { await supabase.auth.signOut(); router.push("/login"); return; }
      if (['client', 'student', 'subscriber'].includes(profile.role)) { router.push("/portal"); return; }

      setUserProfile(profile);
      setAuthorized(true);
      setLoading(false);
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const allNavItems = [
    { name: "Visão Geral", href: "/dashboard", icon: LayoutDashboard, roles: ['super_admin', 'admin', 'commercial', 'financial', 'logistics', 'marketing', 'training', 'support'] },
    { name: "Calendário Geral", href: "/calendario", icon: CalendarDays, roles: ['super_admin', 'admin', 'commercial', 'logistics'] },
    { name: "CRM / Vendas", href: "/crm", icon: Target, roles: ['super_admin', 'admin', 'commercial', 'financial'] },
    { name: "Financeiro", href: "/financeiro", icon: Wallet, roles: ['super_admin', 'admin', 'financial'] },
    { name: "Marketing", href: "/marketing", icon: Megaphone, roles: ['super_admin', 'admin', 'marketing'] },
    { name: settingsContext.custom_labels.academy_name, href: "/treinamentos", icon: PlaySquare, roles: ['super_admin', 'admin', 'training'] },
    { name: settingsContext.custom_labels.client_plural, href: "/clientes", icon: Users, roles: ['super_admin', 'admin', 'commercial', 'financial'] },
    { name: "Inventário", href: "/inventario", icon: Package, roles: ['super_admin', 'admin', 'logistics', 'commercial'] },
    { name: settingsContext.custom_labels.quote_plural, href: "/orcamentos", icon: FileText, roles: ['super_admin', 'admin', 'commercial', 'financial'] },
    { name: "Ordens de Serviço", href: "/os", icon: Truck, roles: ['super_admin', 'admin', 'logistics', 'commercial', 'support'] },
    { name: "Suporte Técnico", href: "/suporte", icon: Ticket, roles: ['super_admin', 'admin', 'support'] },
  ];

  if (loading || settingsLoading) return <div className="h-screen w-full bg-background flex items-center justify-center"><Loader2 className="animate-spin text-cs-green" size={48} /></div>;
  if (!authorized) return null;

  const allowedNavItems = allNavItems.filter(item => userProfile ? item.roles.includes(userProfile.role) : false);

  return (
    <div className="h-screen w-full bg-background text-text-primary flex overflow-hidden print:bg-white">
      
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-surface border-r border-surface/50 flex flex-col transition-all duration-300 ease-in-out shrink-0 print:hidden relative`}>
        
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-6 bg-cs-green text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform z-50"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="h-16 flex items-center justify-center border-b border-surface/50 shrink-0 overflow-hidden">
          <div className={`w-full px-3 transition-all duration-300 flex items-center justify-center ${isSidebarCollapsed ? '' : 'gap-2'}`}>
            {settingsContext.logo_url ? (
              <img
                src={settingsContext.logo_url}
                alt={`${settingsContext.company_name} logo`}
                className={`max-h-[40px] w-auto object-contain transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}
              />
            ) : null}
            <span className={`font-bold text-white whitespace-nowrap transition-all duration-300 ${isSidebarCollapsed ? 'text-sm opacity-100' : 'text-xl opacity-100 px-0'}`}>
              {settingsContext.company_name}
            </span>
          </div>
        </div>
        
        <nav className="flex-1 py-4 space-y-2 overflow-y-auto overflow-x-hidden">
          {allowedNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                title={isSidebarCollapsed ? item.name : ""}
                className={`flex items-center gap-3 mx-3 px-3 py-3 rounded-md transition-colors ${
                  isActive ? "bg-cs-green/10 text-cs-green font-medium" : "text-text-secondary hover:bg-surface hover:text-white font-medium"
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              >
                <Icon size={20} className="shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible print:bg-white">
        <header className="h-16 bg-surface border-b border-surface/50 flex items-center px-8 justify-between shrink-0 print:hidden">
          <h2 className="text-lg font-medium text-white capitalize">{pathname.replace('/', '') || 'Dashboard'}</h2>
          
          <div className="flex items-center gap-4" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="h-9 w-9 rounded-full bg-cs-green/20 border border-cs-green/50 flex items-center justify-center text-sm font-bold text-cs-green uppercase hover:bg-cs-green hover:text-white transition-colors focus:outline-none"
            >
              {userProfile?.email?.substring(0, 2)}
            </button>

            {isDropdownOpen && (
              <div className="absolute top-14 right-8 w-64 bg-surface border border-surface/50 rounded-lg shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 border-b border-surface/50 mb-2">
                  <p className="text-sm font-bold text-white truncate">{userProfile?.full_name || 'Usuário AXON'}</p>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{userProfile?.email}</p>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-cs-gold/10 border border-cs-gold/20 text-cs-gold text-[10px] font-bold uppercase rounded">
                    {userProfile?.role.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="px-2 space-y-1">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-background hover:text-white rounded-md transition-colors"><User size={16} /> Meu Perfil</button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-background hover:text-white rounded-md transition-colors"><Settings size={16} /> Configurações</button>
                  {['super_admin', 'admin'].includes(userProfile?.role) && (
                    <Link href="/equipe" onClick={() => setIsDropdownOpen(false)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-background hover:text-white rounded-md transition-colors">
                      <ShieldCheck size={16} /> Equipe e Acessos
                    </Link>
                  )}
                </div>

                <div className="px-2 mt-2 pt-2 border-t border-surface/50">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md transition-colors">
                    <LogOut size={16} /> Sair do Sistema
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        
        <div className="p-8 flex-1 overflow-y-auto print:p-0 print:overflow-visible print:bg-white">
          {children}
        </div>
      </main>
    </div>
  );
}