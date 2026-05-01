"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Loader2, Printer, ArrowLeft, Receipt } from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

export default function FaturaPDFPage() {
  const params = useParams();
  const router = useRouter();
  const { companyProfile, systemPreferences } = useSettings();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currency = systemPreferences?.currency_code || "BRL";
  const primaryColor = companyProfile?.primary_color || "#138946";

  useEffect(() => {
    if (params.id) fetchFatura(params.id as string);
  }, [params.id]);

  const fetchFatura = async (id: string) => {
    const { data } = await supabase.from("financial_transactions").select("*, clients(*), service_orders(id, quotes(title))").eq("id", id).single();
    if (data) setTransaction(data);
    setLoading(false);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-cs-green" size={32} /></div>;
  if (!transaction) return <div className="p-8 text-white text-center">Fatura não localizada.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 10mm; size: A4; }
          body { background-color: white !important; color: black !important; }
          .print-hidden { display: none !important; }
        }
      `}} />

      <div className="flex justify-between items-center mb-8 print-hidden">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors uppercase text-xs font-black"><ArrowLeft size={16} /> Voltar</button>
        <button onClick={() => window.print()} className="bg-cs-green text-white px-8 py-2 rounded-md font-black uppercase text-xs flex items-center gap-2 shadow-lg"><Printer size={16} /> Imprimir Fatura</button>
      </div>

      <div className="bg-white text-black p-12 rounded-lg shadow-2xl min-h-[297mm] flex flex-col border border-gray-100">
        <div className="flex justify-between items-start border-b-2 pb-8 mb-10" style={{ borderColor: primaryColor }}>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">{companyProfile?.company_name || "ARXUM"}</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{companyProfile?.trade_name}</p>
            <p className="text-[