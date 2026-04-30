"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

export default function OrcamentoPDFPage() {
  const params = useParams();
  const router = useRouter();
  const { companyProfile, systemPreferences } = useSettings();
  
  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- CONFIGURAÇÕES DINÂMICAS (WHITE-LABEL) ---
  const labels = systemPreferences?.custom_labels ?? {};
  const quoteSingular = labels.entity_quote_singular || "Orçamento";
  const quotePlural = labels.entity_quote_plural || "Orçamentos";
  const clientSingular = labels.entity_client_singular || "Cliente";
  
  const companyName = companyProfile?.company_name || "CS com Eventos";
  const tradeName = companyProfile?.trade_name || "Excelência em Produção Técnica";
  const companyEmail = companyProfile?.contact_email || "contato@cscomeventos.com.br";
  const logoUrl = companyProfile?.logo_url || null;

  useEffect(() => {
    if (params.id) {
      fetchQuoteData(params.id as string);
    }
  }, [params.id]);

  const fetchQuoteData = async (id: string) => {
    const { data: quoteData } = await supabase
      .from("quotes")
      .select("*, clients(*), salesperson:profiles(full_name)")
      .eq("id", id)
      .single();

    const { data: itemsData } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: true });

    if (quoteData) setQuote(quoteData);
    if (itemsData) setItems(itemsData);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-cs-green" size={32} />
      </div>
    );
  }

  if (!quote) {
    return <div className="text-white">{quoteSingular} não encontrado.</div>;
  }

  const companyAddress = companyProfile 
    ? `${companyProfile.street || ""}, ${companyProfile.street_number || ""} ${companyProfile.complement || ""} - ${companyProfile.district || ""} - ${companyProfile.city || ""}/${companyProfile.state || ""}`
    : "";

  return (
    <div className="max-w-4xl mx-auto">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; size: A4; }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background-color: white !important;
          }
          .print-container { padding: 20mm !important; }
        }
      `}} />

      <div className="flex justify-between items-center mb-8 print:hidden">
        <button 
          onClick={() => router.push("/orcamentos")}
          className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
        >
          <ArrowLeft size={20} /> Voltar para {quotePlural.toLowerCase()}
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-cs-green text-white px-6 py-2 rounded-md font-medium hover:bg-opacity-90 transition-colors"
        >
          <Printer size={20} /> Imprimir / Salvar {quoteSingular} PDF
        </button>
      </div>

      <div className="print-container bg-white text-black p-12 rounded-lg shadow-lg print:shadow-none min-h-[297mm] relative">
        
        <div className="flex justify-between items-end border-b-4 border-cs-green pb-6 mb-10">
          <div>
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="max-h-16 w-auto mb-2 object-contain" />
            ) : (
              <h1 className="text-4xl font-extrabold text-black tracking-tighter">
                {companyName}
              </h1>
            )}
            <p className="text-sm text-gray-500 font-medium mt-1 tracking-wide uppercase">{tradeName}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wider mb-1">{quoteSingular} Comercial</h2>
            <p className="text-sm text-gray-600">Ref: <span className="font-semibold text-black">#{quote.id.split('-')[0].toUpperCase()}</span></p>
            <p className="text-sm text-gray-600">Data: <span className="font-semibold text-black">{new Date(quote.created_at).toLocaleDateString('pt-BR')}</span></p>
            <p className="text-sm text-gray-600">Validade: <span className="font-semibold text-black">15 dias</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 mb-10 bg-gray-50 p-6 rounded-lg border border-gray-100">
          <div>
            <h3 className="text-xs font-bold text-cs-green uppercase tracking-widest mb-3">Dados do {clientSingular.toLowerCase()}</h3>
            <p className="font-bold text-lg text-gray-900">{quote.clients?.company_name}</p>
            <p className="text-sm text-gray-600 mt-1">CNPJ/CPF: {quote.clients?.document}</p>
            {quote.clients?.contact_name && <p className="text-sm text-gray-600 mt-1">A/C: {quote.clients.contact_name}</p>}
            {quote.clients?.email && <p className="text-sm text-gray-600 mt-1">{quote.clients.email}</p>}
            {quote.clients?.phone && <p className="text-sm text-gray-600 mt-1">{quote.clients.phone}</p>}
          </div>
          <div>
            <h3 className="text-xs font-bold text-cs-green uppercase tracking-widest mb-3">Dados do Evento</h3>
            <p className="font-bold text-lg text-gray-900">{quote.title}</p>
            <p className="text-sm text-gray-600 mt-1">Status: <span className="uppercase font-semibold">{quote.status === 'draft' ? `${quoteSingular} Inicial` : quote.status}</span></p>
            {quote.salesperson?.full_name && <p className="text-sm text-gray-600 mt-1">Responsável: <span className="font-medium">{quote.salesperson.full_name}</span></p>}
          </div>
        </div>

        <div className="mb-10">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Detalhamento de Investimento</h3>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-cs-green text-white">
                <th className="p-3 font-semibold w-20 rounded-tl-md">Tipo</th>
                <th className="p-3 font-semibold">Descrição</th>
                <th className="p-3 font-semibold text-center w-16">Qtd</th>
                <th className="p-3 font-semibold text-center w-16">Dias</th>
                <th className="p-3 font-semibold text-right w-28">Diária</th>
                <th className="p-3 font-semibold text-right w-32 rounded-tr-md">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {item.category === 'equipment' ? 'Equip' : item.category === 'labor' ? 'Equipe' : 'Log'}
                  </td>
                  <td className="p-3 font-medium text-gray-800">{item.description}</td>
                  <td className="p-3 text-center text-gray-600">{item.quantity}</td>
                  <td className="p-3 text-center text-gray-600">{item.days}</td>
                  <td className="p-3 text-right text-gray-600">{formatCurrency(item.daily_rate)}</td>
                  <td className="p-3 text-right font-bold text-gray-900">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mb-12">
          <div className="w-96 bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal Equipamentos:</span>
              <span className="font-medium">{formatCurrency(quote.total_equipment_cost)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal Equipe Técnica:</span>
              <span className="font-medium">{formatCurrency(quote.total_labor_cost)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 border-b border-gray-200 pb-3">
              <span>Subtotal Logística:</span>
              <span className="font-medium">{formatCurrency(quote.total_logistics_cost)}</span>
            </div>
            <div className="flex justify-between text-2xl font-extrabold text-black pt-2">
              <span>Valor Total do {quoteSingular.toLowerCase()}:</span>
              <span className="text-cs-green">{formatCurrency(quote.final_amount)}</span>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Condições Comerciais e Observações</h3>
          <div className="text-xs text-gray-500 space-y-2 leading-relaxed">
            {systemPreferences?.commercial_documents?.quote_terms_text ? (
              <div className="whitespace-pre-wrap">{String(systemPreferences.commercial_documents.quote_terms_text)}</div>
            ) : (
              <>
                <p>1. Os valores apresentados nesta proposta são válidos por 15 dias a partir da data de emissão.</p>
                <p>2. Condições de pagamento: 50% na aprovação para reserva de data e equipamentos, e 50% até 3 dias antes do evento.</p>
                <p>3. Em caso de cancelamento com menos de 7 dias do evento, o sinal de 50% não será reembolsado.</p>
                <p>4. Custos extras de alimentação da equipe técnica e taxas de ECAD não estão inclusos neste orçamento, salvo especificação contrária.</p>
              </>
            )}
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 grid grid-cols-2 gap-16 text-center">
          <div>
            <div className="border-b border-gray-400 mb-3 w-full mx-auto"></div>
            <p className="font-bold text-sm text-gray-800">{companyName}</p>
            <p className="text-xs text-gray-500">{quote.salesperson?.full_name || "Departamento Comercial"}</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-3 w-full mx-auto"></div>
            <p className="font-bold text-sm text-gray-800">{quote.clients?.company_name}</p>
            <p className="text-xs text-gray-500">De Acordo / Aprovação</p>
          </div>
        </div>

        <div className="absolute bottom-10 left-0 right-0 text-center text-[10px] text-gray-400 border-t border-gray-100 pt-4 mx-12">
          {companyProfile?.proposal_footer || `${companyName} - ${tradeName} | ${companyEmail} | Documento gerado pelo sistema Arxum`}
          {companyAddress && <p className="mt-1">{companyAddress}</p>}
        </div>

      </div>
    </div>
  );
}