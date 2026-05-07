"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useSettings } from "../providers/SettingsProvider";
import {
  PlaySquare,
  Ticket,
  LogOut,
  Home,
  CreditCard,
  Users,
  User,
  Loader2,
} from "lucide-react";
import NotificationBell from "../components/NotificationBell";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  client_id: string | null;
  avatar_url: string | null;
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { systemPreferences, companyProfile, resolvedClientId } = useSettings();

  const [userProfile, setUserProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const labels = systemPreferences?.custom_labels;
  const trainingsLabel = labels?.menu_trainings || "Treinamentos";
  const supportLabel = labels?.menu_support || "Suporte";
  const teamLabel = labels?.menu_team || "Equipe";
  const profileLabel = labels?.menu_profile || "Perfil";
  const invoicesLabel = "Faturas";
  const homeLabel = "Início";

  const companyName =
    companyProfile?.trade_name ||
    companyProfile?.company_name ||
    companyProfile?.legal_name ||
    "Portal do Cliente";

  const supportEnabled = systemPreferences?.feature_toggles?.enable_support ?? true;
  const trainingsEnabled = systemPreferences?.feature_toggles?.enable_trainings ?? true;
  const teamEnabled = systemPreferences?.feature_toggles?.enable_team ?? true;
  const financialEnabled = systemPreferences?.feature_toggles?.enable_financial ?? true;

  useEffect(() => {
    const checkUser = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/acesso");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, client_id, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (!profile || !["client", "student", "subscriber"].includes(profile.role || "")) {
        await supabase.auth.signOut();
        router.replace("/acesso");
        return;
      }

      if (profile.role === "client" && !profile.client_id && !resolvedClientId) {
        router.replace("/acesso");
        return;
      }

      setUserProfile(profile as ProfileRow);
      setLoading(false);
    };

    checkUser();
  }, [router, resolvedClientId]);

  const handleLogout = async () => {
    const role = userProfile?.role;
    await supabase.auth.signOut();

    if (role === "student" || role === "subscriber") {
      router.replace("/academy");
      return;
    }

    router.replace("/acesso");
  };

  const initials = useMemo(() => {
    const name = userProfile?.full_name?.trim();
    if (!name) return "U";
    const parts = name.split(" ").filter(Boolean);
    return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  }, [userProfile?.full_name]);

  const navItems = useMemo(() => {
    if (userProfile?.role !== "client") {
      return trainingsEnabled
        ? [{ name: trainingsLabel, href: "/portal/treinamentos", icon: PlaySquare }]
        : [];
    }

    return [
      { name: homeLabel, href: "/portal", icon: Home, enabled: true },
      { name: invoicesLabel, href: "/portal/faturas", icon: CreditCard, enabled: financialEnabled },
      { name: teamLabel, href: "/portal/equipe", icon: Users, enabled: teamEnabled },
      { name: trainingsLabel, href: "/portal/treinamentos", icon: PlaySquare, enabled: trainingsEnabled },
      { name: supportLabel, href: "/portal/suporte", icon: Ticket, enabled: supportEnabled },
      { name: profileLabel, href: "/portal/perfil", icon: User, enabled: true },
    ].filter((item) => item.enabled);
  }, [
    userProfile?.role,
    trainingsEnabled,
    trainingsLabel,
    homeLabel,
    invoicesLabel,
    financialEnabled,
    teamLabel,
    teamEnabled,
    supportLabel,
    supportEnabled,
    profileLabel,
  ]);

  if (loading) {
    return (
      <div className="h-screen bg-background text-text-primary flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-cs-green" />
      </div>
    );
  }

  if (!userProfile) return null;

  return (
    <div className="h-screen bg-background text-text-primary flex flex-col overflow-hidden">
      <header className="h-20 shrink-0 bg-surface/80 backdrop-blur-md border-b border-surface/50 flex items-center justify-between px-4 md:px-8 z-50">
        <div className="flex items-center gap-6 md:gap-12 min-w-0">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tighter truncate">
              {companyName}
            </h1>
            {userProfile.role === "client" && (
              <p className="text-[10px] md:text-xs text-cs-gold uppercase tracking-wider mt-1">
                Portal do Cliente
              </p>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (pathname.startsWith(item.href + "/") && item.href !== "/portal");
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

        <div className="flex items-center gap-4 md:gap-6 shrink-0">
          <NotificationBell userId={userProfile.id} />

          <Link
            href={userProfile.role === "client" ? "/portal/perfil" : "/portal/treinamentos"}
            className="flex items-center gap-3 min-w-0"
          >
            {userProfile.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt={userProfile.full_name || "Usuário"}
                className="w-10 h-10 rounded-full object-cover border border-surface/50"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-cs-green/15 border border-cs-green/20 text-cs-green flex items-center justify-center text-sm font-bold uppercase">
                {initials}
              </div>
            )}

            <div className="hidden md:flex flex-col items-end min-w-0">
              <span className="text-sm font-bold text-white truncate max-w-[180px]">
                {userProfile.full_name || "Usuário"}
              </span>
              <span className="text-[10px] text-cs-gold uppercase tracking-wider">
                {userProfile.role === "student"
                  ? "Aluno"
                  : userProfile.role === "subscriber"
                  ? "Assinante"
                  : "Cliente"}
              </span>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="text-text-secondary hover:text-red-400 transition-colors"
            title="Sair do sistema"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {children}
      </main>
    </div>
  );
}