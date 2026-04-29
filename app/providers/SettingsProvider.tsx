"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export type UserRole =
  | "super_admin"
  | "admin"
  | "commercial"
  | "financial"
  | "logistics"
  | "training"
  | "support"
  | "client"
  | "student"
  | "subscriber"
  | string;

export interface FeatureToggles extends JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface CustomLabels {
  client_singular: string;
  client_plural: string;
  quote_singular: string;
  quote_plural: string;
  academy_name: string;
  [key: string]: string;
}

export interface CompanyProfile {
  company_name: string;
  cnpj: string;
  logo_url: string;
  primary_color: string;
  contract_terms: string;
}

export interface SystemPreferences {
  feature_toggles: FeatureToggles;
  custom_labels: CustomLabels;
}

interface CompanyProfileRow {
  company_name: string | null;
  cnpj: string | null;
  logo_url: string | null;
  primary_color: string | null;
  contract_terms: string | null;
}

interface SystemPreferencesRow {
  feature_toggles: FeatureToggles | null;
  custom_labels: Partial<CustomLabels> | null;
}

interface ProfileIdentityRow {
  id: string;
  client_id: string | null;
  role: string | null;
}

interface SettingsContextValue {
  companyProfile: CompanyProfile;
  systemPreferences: SystemPreferences;
  loading: boolean;
  resolvedUserId: string | null;
  resolvedClientId: string | null;
  refreshSettings: () => Promise<void>;
  hasPermission: (module: string, userRole: UserRole) => boolean;
}

const defaultCompanyProfile: CompanyProfile = {
  company_name: "AXON Systems",
  cnpj: "",
  logo_url: "",
  primary_color: "#138946",
  contract_terms: "",
};

const defaultCustomLabels: CustomLabels = {
  client_singular: "Cliente",
  client_plural: "Clientes",
  quote_singular: "Orçamento",
  quote_plural: "Orçamentos",
  academy_name: "Treinamentos",
};

const defaultSystemPreferences: SystemPreferences = {
  feature_toggles: {},
  custom_labels: defaultCustomLabels,
};

const SettingsContext = createContext<SettingsContextValue>({
  companyProfile: defaultCompanyProfile,
  systemPreferences: defaultSystemPreferences,
  loading: true,
  resolvedUserId: null,
  resolvedClientId: null,
  refreshSettings: async () => undefined,
  hasPermission: () => false,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function mergeCustomLabels(input: Partial<CustomLabels> | null | undefined): CustomLabels {
  const source = isPlainObject(input) ? input : {};

  return {
    client_singular: safeString(source.client_singular, defaultCustomLabels.client_singular),
    client_plural: safeString(source.client_plural, defaultCustomLabels.client_plural),
    quote_singular: safeString(source.quote_singular, defaultCustomLabels.quote_singular),
    quote_plural: safeString(source.quote_plural, defaultCustomLabels.quote_plural),
    academy_name: safeString(source.academy_name, defaultCustomLabels.academy_name),
  };
}

function mergeFeatureToggles(input: FeatureToggles | null | undefined): FeatureToggles {
  if (!isPlainObject(input)) {
    return { ...defaultSystemPreferences.feature_toggles };
  }

  return { ...input };
}

function normalizeCompanyProfile(row: CompanyProfileRow | null): CompanyProfile {
  if (!row) {
    return { ...defaultCompanyProfile };
  }

  return {
    company_name: row.company_name ?? defaultCompanyProfile.company_name,
    cnpj: row.cnpj ?? defaultCompanyProfile.cnpj,
    logo_url: row.logo_url ?? defaultCompanyProfile.logo_url,
    primary_color: row.primary_color ?? defaultCompanyProfile.primary_color,
    contract_terms: row.contract_terms ?? defaultCompanyProfile.contract_terms,
  };
}

function normalizeSystemPreferences(row: SystemPreferencesRow | null): SystemPreferences {
  if (!row) {
    return {
      feature_toggles: { ...defaultSystemPreferences.feature_toggles },
      custom_labels: { ...defaultCustomLabels },
    };
  }

  return {
    feature_toggles: mergeFeatureToggles(row.feature_toggles),
    custom_labels: mergeCustomLabels(row.custom_labels),
  };
}

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultCompanyProfile);
  const [systemPreferences, setSystemPreferences] =
    useState<SystemPreferences>(defaultSystemPreferences);
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  const activeRequestRef = useRef<number>(0);

  const hasPermission = useCallback((module: string, userRole: UserRole): boolean => {
    const normalizedModule = module.trim().toLowerCase();
    const normalizedRole = userRole.trim().toLowerCase();

    if (!normalizedModule || !normalizedRole) return false;
    if (normalizedRole === "super_admin") return true;

    if (normalizedRole === "admin") {
      return normalizedModule !== "settings";
    }

    const permissionMatrix: Record<string, string[]> = {
      commercial: ["crm", "clients", "quotes"],
      financial: ["financial", "quotes"],
      logistics: ["inventory", "service_orders"],
      training: ["academy", "trainings", "courses"],
      support: ["support", "tickets"],
      client: ["portal"],
      student: ["academy"],
      subscriber: ["academy"],
    };

    return permissionMatrix[normalizedRole]?.includes(normalizedModule) ?? false;
  }, []);

  const refreshSettings = useCallback(async () => {
    setRefreshNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    const run = async () => {
      setLoading(true);

      try {
        const userResponse = await supabase.auth.getUser();
        const authUser = userResponse.data.user;

        if (userResponse.error || !authUser) {
          if (!isMounted || activeRequestRef.current !== requestId) return;

          setResolvedUserId(null);
          setResolvedClientId(null);
          setCompanyProfile({ ...defaultCompanyProfile });
          setSystemPreferences({
            feature_toggles: { ...defaultSystemPreferences.feature_toggles },
            custom_labels: { ...defaultCustomLabels },
          });
          return;
        }

        if (!isMounted || activeRequestRef.current !== requestId) return;

        setResolvedUserId(authUser.id);

        const profileResponse = await supabase
          .from("profiles")
          .select("id, client_id, role")
          .eq("id", authUser.id)
          .maybeSingle<ProfileIdentityRow>();

        if (!isMounted || activeRequestRef.current !== requestId) return;

        if (profileResponse.error) {
          throw profileResponse.error;
        }

        const profile = profileResponse.data ?? null;
        const clientId = profile?.client_id ?? null;
        setResolvedClientId(clientId);

        const [companyResult, preferencesResult] = await Promise.all([
          supabase
            .from("company_profile")
            .select("company_name, cnpj, logo_url, primary_color, contract_terms")
            .limit(1)
            .maybeSingle<CompanyProfileRow>(),
          supabase
            .from("system_preferences")
            .select("feature_toggles, custom_labels")
            .limit(1)
            .maybeSingle<SystemPreferencesRow>(),
        ]);

        if (!isMounted || activeRequestRef.current !== requestId) return;

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (preferencesResult.error) {
          throw preferencesResult.error;
        }

        setCompanyProfile(normalizeCompanyProfile(companyResult.data ?? null));
        setSystemPreferences(normalizeSystemPreferences(preferencesResult.data ?? null));
      } catch (error) {
        console.error("Erro ao carregar configurações do sistema:", error);

        if (!isMounted || activeRequestRef.current !== requestId) return;

        setCompanyProfile({ ...defaultCompanyProfile });
        setSystemPreferences({
          feature_toggles: { ...defaultSystemPreferences.feature_toggles },
          custom_labels: { ...defaultCustomLabels },
        });
      } finally {
        if (isMounted && activeRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [refreshNonce]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      companyProfile,
      systemPreferences,
      loading,
      resolvedUserId,
      resolvedClientId,
      refreshSettings,
      hasPermission,
    }),
    [
      companyProfile,
      systemPreferences,
      loading,
      resolvedUserId,
      resolvedClientId,
      refreshSettings,
      hasPermission,
    ]
  );

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white">
          <Loader2 className="h-5 w-5 animate-spin text-[#138946]" />
          Carregando configurações do sistema...
        </div>
      </div>
    );
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}