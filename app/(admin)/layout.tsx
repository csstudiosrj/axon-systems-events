"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import {
  LayoutDashboard,
  FileText,
  Truck,
  Ticket,
  LogOut,
  Users,
  Package,
  Target,
  Wallet,
  Megaphone,
  CalendarDays,
  PlaySquare,
  Loader2,
  ShieldCheck,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useSettings } from "../providers/SettingsProvider";

type UserProfile = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
};

type NavItem = {
  key: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: string[];
  featureKey?: string;
};

function buildUserInitials(profile: UserProfile | null): string {
  const fullName = profile?.full_name?.trim() || "";
  const email = profile?.email?.trim() || "";

  if (fullName) {
    return fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  if (email) {
    return email.substring(0, 2).toUpperCase();
  }

  return "AX";
}

function normalizeRoleLabel(role?: string | null): string {
  const roleMap: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Administrador",
    commercial: "Comercial",
    financial: "Financeiro",
    logistics: "Logística",
    marketing: "Marketing",
    training: "Treinamentos",
    support: "Suporte",
    client: "Cliente",
    student: "Aluno",
    subscriber: "Assinante",
  };

  const normalized = (role || "admin").trim().toLowerCase();
  return roleMap[normalized] || "Administrador";
}

function getFeatureLabel(key: string, customLabels: { academy_name: string }): string {
  const labels: Record<string, string> = {
    enable_calendar: "Calendário",
    enable_crm: "CRM / Vendas",
    enable_financial: "Financeiro",
    enable_inventory: "Inventário",
    enable_service_orders: "Ordens de Serviço",
    enable_training: customLabels.academy_name || "Treinamentos",
    enable_marketing: "Marketing",
  };

  return labels[key] || key.replace(/^enable_/, "").replace(/_/g, " ");
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const { companyProfile, systemPreferences, loading: settingsLoading } = useSettings();

  const customLabels = systemPreferences?.custom_labels || {
    client_singular: "Cliente",
    client_plural: "Clientes",
    quote_singular: "Orçamento",
    quote_plural: "Orçamentos",
    academy_name: "Treinamentos",
  };

  const featureToggles = systemPreferences?.feature_toggles || {};

  const isFeatureEnabled = useMemo(() => {
    return (featureKey?: string) => {
      if (!featureKey) return true;
      const value = featureToggles[featureKey];
      return typeof value === "boolean" ? value : true;
    };
  }, [featureToggles]);

  const allNavItems = useMemo<NavItem[]>(
    () => [
      {
        key: "dashboard",
        name: "Visão Geral",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["super_admin", "admin", "commercial", "financial", "logistics", "marketing", "training", "support"],
      },
      {
        key: "calendario",
        name: "Calendário",
        href: "/calendario",
        icon: CalendarDays,
        roles: ["super_admin", "admin", "commercial", "logistics"],
        featureKey: "enable_calendar",
      },
      {
        key: "crm",
        name: "CRM / Vendas",
        href: "/crm",
        icon: Target,
        roles: ["super_admin", "admin", "commercial", "financial"],
        featureKey: "enable_crm",
      },
      {
        key: "financeiro",
        name: "Financeiro",
        href: "/financeiro",
        icon: Wallet,
        roles: ["super_admin", "admin", "financial"],
        featureKey: "enable_financial",
      },
      {
        key: "marketing",
        name: "Marketing",
        href: "/marketing",
        icon: Megaphone,
        roles: ["super_admin", "admin", "marketing"],
        featureKey: "enable_marketing",
      },
      {
        key: "treinamentos",
        name: customLabels.academy_name || "Treinamentos",
        href: "/treinamentos",
        icon: PlaySquare,
        roles: ["super_admin", "admin", "training"],
        featureKey: "enable_training",
      },
      {
        key: "clientes",
        name: customLabels.client_plural || "Clientes",
        href: "/clientes",
        icon: Users,
        roles: ["super_admin", "admin", "commercial", "financial"],
      },
      {
        key: "inventario",
        name: "Inventário",
        href: "/inventario",
        icon: Package,
        roles: ["super_admin", "admin", "logistics", "commercial"],
        featureKey: "enable_inventory",
      },
      {
        key: "orcamentos",
        name: customLabels.quote_plural || "Orçamentos",
        href: "/orcamentos",
        icon: FileText,
        roles: ["super_admin", "admin", "commercial", "financial"],
      },
      {
        key: "os",
        name: "Ordens de Serviço",
        href: "/os",
        icon: Truck,
        roles: ["super_admin", "admin", "logistics", "commercial", "support"],
        featureKey: "enable_service_orders",
      },
      {
        key: "suporte",
        name: "Suporte Técnico",
        href: "/suporte",
        icon: Ticket,
        roles: ["super_admin", "admin", "support"],
      },
    ],
    [customLabels.academy_name, customLabels.client_plural, customLabels.quote_plural]
  );

  const headerTitle = useMemo(() => {
    const firstSegment = pathname.replace(/^\/+/, "").split("/")[0] || "dashboard";

    const labels: Record<string, string> = {
      dashboard: "Dashboard",
      calendario: "Calendário",
      crm: "CRM / Vendas",
      financeiro: "Financeiro",
      marketing: "Marketing",
      treinamentos: customLabels.academy_name || "Treinamentos",
      clientes: customLabels.client_plural || "Clientes",
      inventario: "Inventário",
      orcamentos: customLabels.quote_plural || "Orçamentos",
      os: "Ordens de Serviço",
      suporte: "Suporte Técnico",
      equipe: "Equipe e Acessos",
      perfil: "Meu Perfil",
      configuracoes: "Personalização",
    };

    return labels[firstSegment] || firstSegment.replace(/-/g, " ");
  }, [pathname, customLabels.academy_name, customLabels.client_plural, customLabels.quote_plural]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const sessionResponse = await supabase.auth.getSession();
        const session = sessionResponse.data.session;

        if (!session) {
          router.push("/login");
          return;
        }

        const profileResponse = await supabase
          .from("profiles")
          .select("id, email, full_name, role")
          .eq("id", session.user.id)
          .single();

        if (profileResponse.error || !profileResponse.data) {
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }

        const profile = profileResponse.data as UserProfile;

        if (["client", "student", "subscriber"].includes(profile.role || "")) {
          router.push("/portal");
          return;
        }

        setUserProfile(profile);
        setAuthorized(true);
      } finally {
        setLoading(false);
      }
    };

    void checkUser();
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allowedNavItems = useMemo(() => {
    return allNavItems.filter((item) => {
      const hasRole = userProfile ? item.roles.includes(userProfile.role || "") : false;
      return hasRole && isFeatureEnabled(item.featureKey);
    });
  }, [allNavItems, isFeatureEnabled, userProfile]);

  useEffect(() => {
    if (loading || settingsLoading || !authorized) return;

    const currentItem = allNavItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );

    if (currentItem?.featureKey && !isFeatureEnabled(currentItem.featureKey)) {
      router.push("/dashboard");
    }
  }, [allNavItems, authorized, isFeatureEnabled, loading, pathname, router, settingsLoading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleDropdownNavigate = () => {
    setIsDropdownOpen(false);
  };

  const userInitials = useMemo(() => buildUserInitials(userProfile), [userProfile]);

  if (loading || settingsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="animate-spin text-cs-green" size={48} />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-text-primary print:bg-white">
      <aside
        className={`${isSidebarCollapsed ? "w-20" : "w-64"} relative flex shrink-0 flex-col border-r border-surface/50 bg-surface transition-all duration-300 ease-in-out print:hidden`}
      >
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-6 z-50 rounded-full bg-cs-green p-1 text-white shadow-lg transition-transform hover:scale-110"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="flex h-16 shrink-0 items-center justify-center overflow-hidden border-b border-surface/50 px-3">
          {!isSidebarCollapsed && companyProfile.logo_url ? (
            <img
              src={companyProfile.logo_url}
              alt={`${companyProfile.company_name || "Empresa"} logo`}
              className="max-h-[40px] w-auto object-contain"
            />
          ) : (
            <span
              className={`whitespace-nowrap font-bold text-white transition-all duration-300 ${
                isSidebarCollapsed ? "text-sm" : "text-xl"
              }`}
            >
              {isSidebarCollapsed
                ? companyProfile.company_name?.slice(0, 2).toUpperCase() || "AX"
                : companyProfile.company_name || "AXON Systems"}
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden py-4">
          {allowedNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                title={isSidebarCollapsed ? item.name : ""}
                className={`mx-3 flex items-center gap-3 rounded-md px-3 py-3 transition-colors ${
                  isActive
                    ? "bg-cs-green/10 font-medium text-cs-green"
                    : "font-medium text-text-secondary hover:bg-surface hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : ""}`}
              >
                <Icon size={20} className="shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex h-screen flex-1 flex-col overflow-hidden print:h-auto print:overflow-visible print:bg-white">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-surface/50 bg-surface px-8 print:hidden">
          <h2 className="text-lg font-medium capitalize text-white">{headerTitle}</h2>

          <div className="relative flex items-center gap-4" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-cs-green/50 bg-cs-green/20 text-sm font-bold uppercase text-cs-green transition-colors hover:bg-cs-green hover:text-white focus:outline-none"
            >
              {userInitials}
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-14 z-50 w-64 animate-in rounded-lg border border-surface/50 bg-surface py-2 shadow-2xl fade-in slide-in-from-top-2">
                <div className="mb-2 border-b border-surface/50 px-4 py-3">
                  <p className="truncate text-sm font-bold text-white">
                    {userProfile?.full_name || "Usuário AXON"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">{userProfile?.email}</p>
                  <span className="mt-2 inline-block rounded border border-cs-gold/20 bg-cs-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase text-cs-gold">
                    {normalizeRoleLabel(userProfile?.role)}
                  </span>
                </div>

                <div className="space-y-1 px-2">
                  <Link
                    href="/perfil"
                    onClick={handleDropdownNavigate}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-background hover:text-white"
                  >
                    <User size={16} /> Meu Perfil
                  </Link>

                  <Link
                    href="/configuracoes"
                    onClick={handleDropdownNavigate}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-background hover:text-white"
                  >
                    <Settings size={16} /> Personalização
                  </Link>

                  {["super_admin", "admin"].includes(userProfile?.role || "") && (
                    <Link
                      href="/equipe"
                      onClick={handleDropdownNavigate}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-background hover:text-white"
                    >
                      <ShieldCheck size={16} /> Equipe e Acessos
                    </Link>
                  )}
                </div>

                <div className="mt-2 border-t border-surface/50 px-2 pt-2">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  >
                    <LogOut size={16} /> Sair do Sistema
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 print:overflow-visible print:bg-white print:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}