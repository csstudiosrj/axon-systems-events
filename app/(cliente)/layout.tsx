"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { PlaySquare, Ticket, LogOut, User, Home, CreditCard } from "lucide-react";
import Link from "next/link";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const[userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Busca o perfil do usuário logado
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
      } else {
        // Fallback caso o perfil ainda não exista
        setUserProfile({ email: session.user.email, role: 'client' });
      }
    };
    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems =[
    { name: "Início", href: "/portal", icon: Home },
    { name: "Treinamentos", href: "/portal/treinamentos", icon: PlaySquare },
    { name: "Suporte", href: "/portal/suporte", icon: Ticket },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">
      {/* Topbar (Menu Superior Estilo Netflix/Portal) */}
      <header className="h-20 bg-surface/80 backdrop-blur-md border-b border-surface/50 sticky top-0 z-50 flex items-center justify-between px-8">
        <div className="flex items-center gap-12">
          <h1 className="text-2xl font-extrabold text-white tracking-tighter">
            CS <span className="text-cs-green">com</span>
          </h1>
          
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-text-secondary hover:text-cs-green"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-cs-green" : ""} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-bold text-white">{userProfile?.full_name || 'Usuário'}</span>
            <span className="text-[10px] text-cs-gold uppercase tracking-wider">{userProfile?.role === 'student' ? 'Aluno / Operador' : 'Cliente Parceiro'}</span>
          </div>
          
          <div className="h-10 w-10 rounded-full bg-cs-green/20 border border-cs-green/50 flex items-center justify-center text-cs-green">
            <User size={20} />
          </div>

          <button 
            onClick={handleLogout}
            className="text-text-secondary hover:text-red-400 transition-colors"
            title="Sair do sistema"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Área de Conteúdo do Cliente */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}