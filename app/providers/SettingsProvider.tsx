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
  enable_dashboard?: boolean;
  enable_crm?: boolean;
  enable_clients?: boolean;
  enable_quotes?: boolean;
  enable_financial?: boolean;
  enable_inventory?: boolean;
  enable_service_orders?: boolean;
  enable_marketing?: boolean;
  enable_calendar?: boolean;
  enable_team?: boolean;
  enable_support?: boolean;
  enable_training?: boolean;
  enable_client_portal?: boolean;
  [key: string]: JsonValue | undefined;
}

export interface CustomLabels {
  menu_dashboard: string;
  menu_calendar: string;
  menu_crm: string;
  menu_financial: string;
  menu_marketing: string;
  menu_training: string;
  menu_patients: string;
  menu_inventory: string;
  menu_quotes: string;
  menu_service_orders: string;
  menu_support: string;
  menu_team: string;
  entity_client_singular: string;
  entity_client_plural: string;
  entity_lead_singular: string;
  entity_lead_plural: string;
  entity_quote_singular: string;
  entity_quote_plural: string;
  entity_proposal_singular: string;
  entity_proposal_plural: string;
  entity_contract_singular: string;
  entity_contract_plural: string;
  entity_invoice_singular: string;
  entity_invoice_plural: string;
  entity_service_order_singular: string;
  entity_service_order_plural: string;
  entity_equipment_singular: string;
  entity_equipment_plural: string;
  entity_course_singular: string;
  entity_course_plural: string;
  entity_lesson_singular: string;
  entity_lesson_plural: string;
  entity_salesperson_singular: string;
  entity_salesperson_plural: string;
  [key: string]: string;
}

export interface CommercialDocuments extends JsonObject {
  show_logo_on_quotes?: boolean;
  show_company_address_on_quotes?: boolean;
  show_company_contacts_on_quotes?: boolean;
  show_signature_on_quotes?: boolean;
  quote_intro_text?: string;
  quote_terms_text?: string;
  default_contract_template?: string;
  default_proposal_template?: string;
  default_operational_notes?: string;
  [key: string]: JsonValue | undefined;
}

export interface CompanyProfile {
  id?: string;
  company_name: string;
  cnpj: string;
  logo_url: string;
  primary_color: string;
  contract_terms: string;
  legal_name: string;
  trade_name: string;
  website: string;
  contact_email: string;
  phone_landline: string;
  phone_mobile: string;
  whatsapp_number: string;
  zipcode: string;
  street: string;
  street_number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  country: string;
  proposal_footer: string;
  invoice_footer: string;
}

export interface SystemPreferences {
  id?: string;
  feature_toggles: FeatureToggles;
  custom_labels: CustomLabels;
  commercial_documents: CommercialDocuments;
}

interface CompanyProfileRow {
  id: string;
  company_name: string | null;
  cnpj: string | null;
  logo_url: string | null;
  primary_color: string | null;
  contract_terms: string | null;
  legal_name: string | null;
  trade_name: string | null;
  website: string | null;
  contact_email: string | null;
  phone_landline: string | null;
  phone_mobile: string | null;
  whatsapp_number: string | null;
  zipcode: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  proposal_footer: string | null;
  invoice_footer: string | null;
}

interface SystemPreferencesRow {
  id: string;
  feature_toggles: FeatureToggles | null;
  custom_labels: Partial<CustomLabels> | null;
  commercial_documents: CommercialDocuments | null;
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
  legal_name: "",
  trade_name: "",
  website: "",
  contact_email: "",
  phone_landline: "",
  phone_mobile: "",
  whatsapp_number: "",
  zipcode: "",
  street: "",
  street_number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  country: "Brasil",
  proposal_footer: "",
  invoice_footer: "",
};

const defaultFeatureToggles: FeatureToggles = {
  enable_dashboard: true,
  enable_crm: true,
  enable_clients: true,
  enable_quotes: true,
  enable_financial: true,
  enable_inventory: true,
  enable_service_orders: true,
  enable_marketing: true,
  enable_calendar: true,
  enable_team: true,
  enable_support: true,
  enable_training: true,
  enable_client_portal: true,
};

const defaultCustomLabels: CustomLabels = {
  menu_dashboard: "Visão Geral",
  menu_calendar: "Calendário",
  menu_crm: "CRM / Vendas",
  menu_financial: "Financeiro",
  menu_marketing: "Marketing",
  menu_training: "Treinamentos",
  menu_patients: "Pacientes",
  menu_inventory: "Inventário",
  menu_quotes: "Orçamentos",
  menu_service_orders: "Ordens de Serviço",
  menu_support: "Suporte Técnico",
  menu_team: "Equipe",
  entity_client_singular: "Cliente",
  entity_client_plural: "Clientes",
  entity_lead_singular: "Lead",
  entity_lead_plural: "Leads",
  entity_quote_singular: "Orçamento",
  entity_quote_plural: "Orçamentos",
  entity_proposal_singular: "Proposta",
  entity_proposal_plural: "Propostas",
  entity_contract_singular: "Contrato",
  entity_contract_plural: "Contratos",
  entity_invoice_singular: "Fatura",
  entity_invoice_plural: "Faturas",
  entity_service_order_singular: "Ordem de Serviço",
  entity_service_order_plural: "Ordens de Serviço",
  entity_equipment_singular: "Equipamento",
  entity_equipment_plural: "Equipamentos",
  entity_course_singular: "Curso",
  entity_course_plural: "Cursos",
  entity_lesson_singular: "Aula",
  entity_lesson_plural: "Aulas",
  entity_salesperson_singular: "Responsável Comercial",
  entity_salesperson_plural: "Responsáveis Comerciais",
};

const defaultCommercialDocuments: CommercialDocuments = {
  show_logo_on_quotes: true,
  show_company_address_on_quotes: true,
  show_company_contacts_on_quotes: true,
  show_signature_on_quotes: false,
  quote_intro_text: "",
  quote_terms_text: "",
  default_contract_template: "",
  default_proposal_template: "",
  default_operational_notes: "",
};

const defaultSystemPreferences: SystemPreferences = {
  feature_toggles: defaultFeatureToggles,
  custom_labels: defaultCustomLabels,
  commercial_documents: defaultCommercialDocuments,
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
  return typeof value === "string" ? value : fallback;
}

function mergeCustomLabels(input: Partial<CustomLabels> | null | undefined): CustomLabels {
  const source = isPlainObject(input) ? input : {};
  return {
    ...defaultCustomLabels,
    ...Object.fromEntries(
      Object.entries(source).filter(([, value]) => typeof value === "string")
    ),
  } as CustomLabels;
}

function mergeFeatureToggles(input: FeatureToggles | null | undefined): FeatureToggles {
  if (!isPlainObject(input)) {
    return { ...defaultFeatureToggles };
  }

  return {
    ...defaultFeatureToggles,
    ...Object.fromEntries(
      Object.entries(input).filter(([, value]) => typeof value === "boolean")
    ),
  };
}

function mergeCommercialDocuments(
  input: CommercialDocuments | null | undefined
): CommercialDocuments {
  if (!isPlainObject(input)) {
    return { ...defaultCommercialDocuments };
  }

  return {
    ...defaultCommercialDocuments,
    ...input,
  };
}

function normalizeCompanyProfile(row: CompanyProfileRow | null): CompanyProfile {
  if (!row) {
    return { ...defaultCompanyProfile };
  }

  return {
    id: row.id,
    company_name: safeString(row.company_name, defaultCompanyProfile.company_name),
    cnpj: safeString(row.cnpj, defaultCompanyProfile.cnpj),
    logo_url: safeString(row.logo_url, defaultCompanyProfile.logo_url),
    primary_color: safeString(row.primary_color, defaultCompanyProfile.primary_color),
    contract_terms: safeString(row.contract_terms, defaultCompanyProfile.contract_terms),
    legal_name: safeString(row.legal_name, defaultCompanyProfile.legal_name),
    trade_name: safeString(row.trade_name, defaultCompanyProfile.trade_name),
    website: safeString(row.website, defaultCompanyProfile.website),
    contact_email: safeString(row.contact_email, defaultCompanyProfile.contact_email),
    phone_landline: safeString(row.phone_landline, defaultCompanyProfile.phone_landline),
    phone_mobile: safeString(row.phone_mobile, defaultCompanyProfile.phone_mobile),
    whatsapp_number: safeString(row.whatsapp_number, defaultCompanyProfile.whatsapp_number),
    zipcode: safeString(row.zipcode, defaultCompanyProfile.zipcode),
    street: safeString(row.street, defaultCompanyProfile.street),
    street_number: safeString(row.street_number, defaultCompanyProfile.street_number),
    complement: safeString(row.complement, defaultCompanyProfile.complement),
    district: safeString(row.district, defaultCompanyProfile.district),
    city: safeString(row.city, defaultCompanyProfile.city),
    state: safeString(row.state, defaultCompanyProfile.state),
    country: safeString(row.country, defaultCompanyProfile.country),
    proposal_footer: safeString(row.proposal_footer, defaultCompanyProfile.proposal_footer),
    invoice_footer: safeString(row.invoice_footer, defaultCompanyProfile.invoice_footer),
  };
}

function normalizeSystemPreferences(row: SystemPreferencesRow | null): SystemPreferences {
  if (!row) {
    return {
      feature_toggles: { ...defaultFeatureToggles },
      custom_labels: { ...defaultCustomLabels },
      commercial_documents: { ...defaultCommercialDocuments },
    };
  }

  return {
    id: row.id,
    feature_toggles: mergeFeatureToggles(row.feature_toggles),
    custom_labels: mergeCustomLabels(row.custom_labels),
    commercial_documents: mergeCommercialDocuments(row.commercial_documents),
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
            feature_toggles: { ...defaultFeatureToggles },
            custom_labels: { ...defaultCustomLabels },
            commercial_documents: { ...defaultCommercialDocuments },
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

        if (profileResponse.error) throw profileResponse.error;

        const profile = profileResponse.data ?? null;
        setResolvedClientId(profile?.client_id ?? null);

        const [companyResult, preferencesResult] = await Promise.all([
          supabase
            .from("company_profile")
            .select(
              `
              id,
              company_name,
              cnpj,
              logo_url,
              primary_color,
              contract_terms,
              legal_name,
              trade_name,
              website,
              contact_email,
              phone_landline,
              phone_mobile,
              whatsapp_number,
              zipcode,
              street,
              street_number,
              complement,
              district,
              city,
              state,
              country,
              proposal_footer,
              invoice_footer
            `
            )
            .limit(1)
            .maybeSingle<CompanyProfileRow>(),
          supabase
            .from("system_preferences")
            .select("id, feature_toggles, custom_labels, commercial_documents")
            .limit(1)
            .maybeSingle<SystemPreferencesRow>(),
        ]);

        if (!isMounted || activeRequestRef.current !== requestId) return;

        if (companyResult.error) throw companyResult.error;
        if (preferencesResult.error) throw preferencesResult.error;

        setCompanyProfile(normalizeCompanyProfile(companyResult.data ?? null));
        setSystemPreferences(normalizeSystemPreferences(preferencesResult.data ?? null));
      } catch (error) {
        console.error("Erro ao carregar configurações do sistema:", error);

        if (!isMounted || activeRequestRef.current !== requestId) return;

        setCompanyProfile({ ...defaultCompanyProfile });
        setSystemPreferences({
          feature_toggles: { ...defaultFeatureToggles },
          custom_labels: { ...defaultCustomLabels },
          commercial_documents: { ...defaultCommercialDocuments },
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