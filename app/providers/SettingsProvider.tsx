"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// --- BLINDAGEM TYPESCRIPT ---
interface CustomLabels {
  client_singular: string;
  client_plural: string;
  quote_singular: string;
  quote_plural: string;
  academy_name: string;[key: string]: string; // Permite escalabilidade futura sem quebrar a tipagem
}

interface SystemSettings {
  company_name: string;
  cnpj: string;
  logo_url: string;
  primary_color: string;
  default_contract_terms: string;
  custom_labels: CustomLabels;
}

// Valores de fallback caso o banco falhe ou esteja carregando
const defaultSettings: SystemSettings = {
  company_name: "CS com",
  cnpj: "",
  logo_url: "",
  primary_color: "#138946",
  default_contract_terms: "",
  custom_labels: {
    client_singular: "Cliente",
    client_plural: "Clientes",
    quote_singular: "Orçamento",
    quote_plural: "Orçamentos",
    academy_name: "Academy"
  }
};

const SettingsContext = createContext<{ settings: SystemSettings; loading: boolean }>({
  settings: defaultSettings,
  loading: true,
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("*")
          .limit(1)
          .single();

        if (data && !error) {
          setSettings({
            company_name: data.company_name || defaultSettings.company_name,
            cnpj: data.cnpj || defaultSettings.cnpj,
            logo_url: data.logo_url || defaultSettings.logo_url,
            primary_color: data.primary_color || defaultSettings.primary_color,
            default_contract_terms: data.default_contract_terms || defaultSettings.default_contract_terms,
            // Mescla os labels do banco com os defaults para evitar undefined caso falte alguma chave
            custom_labels: { ...defaultSettings.custom_labels, ...(data.custom_labels || {}) }
          });
        }
      } catch (error) {
        console.error("Erro ao carregar configurações white-label do sistema:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  },