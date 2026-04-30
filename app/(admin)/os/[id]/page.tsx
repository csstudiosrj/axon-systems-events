"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

export default function OSPDFPage() {
  const params = useParams();
  const router = useRouter();
  const { companyProfile, systemPreferences } = useSettings();
  
  const [os, setOs] = useState<any>(null);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [extraItems, setExtraItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const labels = systemPreferences?.custom_labels ?? {};
  const osSingular = labels.entity_service_order_singular || "OS";
  const quoteSingular = labels.entity_quote_singular || "Orçamento";
  const primaryColor = companyProfile?.primary_color || "#138946";

  useEffect(() => {
    if (params.id) fetchOSData(params.id as string);
  }, [params.id]);

  const fetchOSData = async (id: string) => {
    const { data: osData } = await supabase
      .from("service_orders")
      .select("*, producer:profiles(full_name), quotes(*, clients(*))")
      .eq("id", id)
      .single();

    if (osData) {
      const { data: qItems } = await supabase.from("quote_items").select("*").eq("quote_id", osData.quote_id).eq("category", "equipment");
      const { data: eItems } = await supabase.from("os_extra_items").select("*").eq("service_order_id", id);
      setOs(osData);
      if (qItems) setQuoteItems(qItems);
      if (eItems) setExtraItems(eItems);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-cs-green" size={32} /></div>;
  if (!os) return <div className="p-8 text-white">Ordem de Serviço não encontrada.</div>;

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
        <button onClick={() => router.back()} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"><ArrowLeft size={20} /> Voltar</button>
        <button onClick={() => window.print()} className="bg-cs-green text-white px-6 py-2 rounded-md font-bold flex items-center gap-2"><Printer size={20} /> Imprimir OS</button>
      </div>

      <div className="bg-white text-black p-10 rounded-lg shadow-xl min-h-[297mm]">
        <div className="flex justify-between items-center border-b-2 pb-6 mb-8" style={{ borderColor: primaryColor }}>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">{companyProfile?.company_name || "ARXUM"}</h1>
            <p className="text-sm font-bold text-gray-500 uppercase">Logística e Operação</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase">{osSingular} #{os.id.split('-')[0]}</h2>
            <p className="text-sm text-gray-600">Data: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 bg-gray-50 p-6 rounded-md border border-gray-200">
          <div>
            <h3 className="text-xs font-bold uppercase mb-2" style={{ color: primaryColor }}>Evento / Cliente</h3>
            <p className="font-bold text-lg">{os.quotes?.title}</p>
            <p className="text-sm text-gray-600">{os.quotes?.clients?.company_name}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase mb-2" style={{ color: primaryColor }}>Cronograma</h3>
            <p className="text-sm"><b>Início:</b> {new Date(os.event_start_date).toLocaleString('pt-BR')}</p>
            <p className="text-sm"><b>Fim:</b> {new Date(os.event_end_date).toLocaleString('pt-BR')}</p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-bold border-b mb-4 pb-1 uppercase">Lista de Equipamentos (Carga)</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Item</th>
                <th className="p-2 text-center w-20">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {quoteItems.map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 font-medium">{item.description}</td>
                  <td className="p-2 text-center">{item.quantity}</td>
                </tr>
              ))}
              {extraItems.map((item, i) => (
                <tr key={i} className="border-b italic text-blue-700">
                  <td className="p-2 font-medium">[EXTRA] {item.item_name}</td>
                  <td className="p-2 text-center">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-bold border-b mb-4 pb-1 uppercase">Briefing Logístico</h3>
          <div className="p-4 bg-gray-50 rounded border border-gray-200 text-sm whitespace-pre-wrap min-h-[100px]">
            {os.logistics_notes || "Nenhuma observação cadastrada."}
          </div>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-20 text-center">
          <div className="border-t border-black pt-2">
            <p className="text-xs font-bold uppercase">Responsável: {os.producer?.full_name || "Pendente"}</p>
            <p className="text-[10px] text-gray-500">Sistema ARXUM</p>
          </div>
          <div className="border-t border-black pt-2">
            <p className="text-xs font-bold uppercase">Conferência Galpão</p>
            <p className="text-[10px] text-gray-500">Assinatura / Data</p>
          </div>
        </div>
      </div>
    </div>
  );
}