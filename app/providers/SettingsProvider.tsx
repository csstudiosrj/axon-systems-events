"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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

interface SettingsContextValue {
  companyProfile: CompanyProfile;
  systemPreferences: SystemPreferences;
  loading: boolean;
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
  hasPermission: () => false,
});

function normalizeCompanyProfile(row: CompanyProfileRow | null): CompanyProfile {
  if (!row) return defaultCompanyProfile;

  return {
    company_name: row.company_name ?? defaultCompanyProfile.company_name,
    cnpj: row.cnpj ?? defaultCompanyProfile.cnpj,
    logo_url: row.logo_url ?? defaultCompanyProfile.logo_url,
    primary_color: row.primary_color ?? defaultCompanyProfile.primary_color,
    contract_terms: row.contract_terms ?? defaultCompanyProfile.contract_terms,
  };
}

function normalizeCustomLabels(input: Partial<CustomLabels> | null | undefined): CustomLabels {
  return {
    client_singular: input?.client_singular ?? defaultCustomLabels.client_singular,
    client_plural: input?.client_plural ?? defaultCustomLabels.client_plural,
    quote_singular: input?.quote_singular ?? defaultCustomLabels.quote_singular,
    quote_plural: input?.quote_plural ?? defaultCustomLabels.quote_plural,
    academy_name: input?.academy_name ?? defaultCustomLabels.academy_name,
  };
}

function normalizeSystemPreferences(row: SystemPreferencesRow | null): SystemPreferences {
  if (!row) return defaultSystemPreferences;

  return {
    feature_toggles:
      row.feature_toggles && typeof row.feature_toggles === "object"
        ? row.feature_toggles
        : defaultSystemPreferences.feature_toggles,
    custom_labels: normalizeCustomLabels(row.custom_labels),
  };
}

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultCompanyProfile);
  const [systemPreferences, setSystemPreferences] = useState<SystemPreferences>(
    defaultSystemPreferences
  );
  const [loading, setLoading] = useState<boolean>(true);

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
    };

    return permissionMatrix[normalizedRole]?.includes(normalizedModule) ?? false;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchSettings = async () => {
      try {
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

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (preferencesResult.error) {
          throw preferencesResult.error;
        }

        if (!isMounted) return;

        setCompanyProfile(normalizeCompanyProfile(companyResult.data ?? null));
        setSystemPreferences(normalizeSystemPreferences(preferencesResult.data ?? null));
      } catch (error) {
        console.error("Erro ao carregar configurações do sistema:", error);
        if (!isMounted) return;
        setCompanyProfile(defaultCompanyProfile);
        setSystemPreferences(defaultSystemPreferences);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      companyProfile,
      systemPreferences,
      loading,
      hasPermission,
    }),
    [companyProfile, systemPreferences, loading, hasPermission]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}