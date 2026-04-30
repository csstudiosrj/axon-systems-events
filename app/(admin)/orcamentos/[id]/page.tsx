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

  // --- CONFIGURAÇÕES DINÂMICAS (WHITE-LABEL & VISIBILIDADE) ---
  const labels = systemPreferences?.custom_labels ?? {};
  const docsConfig = systemPreferences?.commercial_documents ?? {};
  
  const quoteSingular = labels.entity_quote_singular || "Orçamento";
  const quotePlural = labels.entity_quote_plural || "Orçamentos";
  const clientSingular = labels.entity_client_singular || "Cliente";
  
  const companyName = companyProfile?.company_name || "Sua Empresa";
  const tradeName = companyProfile?.trade_name || "";
  const primaryColor = companyProfile?.primary_color || "#138946";
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin" style={{ color: primaryColor }} size={32} />
      </div>
    );
  }

  if (!quote) {
    return <div className="text-white">{quoteSingular} não encontrado.</div>;
  }

  // Lógica de Endereço Dinâmico
  const companyAddress = docsConfig.show_company_address_on_quotes 
    ? `${companyProfile?.street || ""}, ${companyProfile?.street_number || ""} ${companyProfile?.complement || ""} - ${companyProfile?.district || ""} - ${companyProfile?.city || ""}/${companyProfile?.state || ""}`
    : null;

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
          .print-container { padding: 15mm !important; }
          .print-hidden { display: none !important; }
        }
      `}} />

      <div className="flex justify-between items-center mb-8 print-hidden">
        <button 
          onClick={() => router.push("/orcamentos")}
          className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
        >
          <ArrowLeft size={20} /> Voltar para {quotePlural.toLowerCase()}
        </button>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 text-white px-6 py-2 rounded-md font-medium hover:bg-opacity-90 transition-colors"
          style={{ backgroundColor: primaryColor }}
        >
          <Printer size={20} /> Imprimir / Salvar {quoteSingular} PDF
        </button>
      </div>

      <div className="print-container bg-white text-black p-12 rounded-lg shadow-lg print:shadow-none min-h-[297mm] relative flex flex-col">
        
        {/* HEADER DINÂMICO */}
        <div className="flex justify-between items-end border-b-4 pb-6 mb-8" style={{ borderColor: primaryColor }}>
          <div>
            {docsConfig.show_logo_on_quotes && logoUrl ? (
              <img src={logoUrl} alt={companyName} className="max-h-20 w-auto mb-2 object-contain" />
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
          </div>
        </div>

        {/* TEXTO DE INTRODUÇÃO (CONFIGURAÇÕES) */}
        {docsConfig.quote_intro_text && (
          <div className="mb-6 text-sm text-gray-700 whitespace-pre-wrap italic border-l-4 pl-4" style={{ borderColor: primaryColor }}>
            {String(docsConfig.quote_intro_text)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-10 mb-8 bg-gray-50 p-6 rounded-lg border border-gray-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primaryColor }}>
              Dados do {clientSingular.toLowerCase()}
            </h3>
            <p className="font-bold text-lg text-gray-900">{quote.clients?.company_name}</p>
            <p className="text-sm text-gray-600 mt-1">CNPJ/CPF: {quote.clients?.document}</p>
            {quote.clients?.contact_name && <p className="text-sm text-gray-600 mt-1">A/C: {quote.clients.contact_name}</p>}
            {docsConfig.show_company_contacts_on_quotes && (
              <>
                {quote.clients?.email && <p className="text-sm text-gray-600 mt-1">{quote.clients.email}</p>}
                {quote.clients?.phone && <p className="text-sm text-gray-600 mt-1">{quote.clients.phone}</p>}
              </>
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primaryColor }}>
              Dados do Evento
            </h3>
            <p className="font-bold text-lg text-gray-900">{quote.title}</p>
            <p className="text-sm text-gray-600 mt-1">Status: <span className="uppercase font-semibold">{quote.status === 'draft' ? `${quoteSingular} Inicial` : quote.status}</span></p>
            {quote.salesperson?.full_name && <p className="text-sm text-gray-600 mt-1">Responsável: <span className="font-medium">{quote.salesperson.full_name}</span></p>}
          </div>
        </div>

        {/* TABELA DE ITENS */}
        <div className="mb-8 flex-1">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="text-white" style={{ backgroundColor: primaryColor }}>
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

        {/* TOTAIS */}
        <div className="flex justify-end mb-8">
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
              <span>Total do {quoteSingular}:</span>
              <span style={{ color: primaryColor }}>{formatCurrency(quote.final_amount)}</span>
            </div>
          </div>
        </div>

        {/* CONDIÇÕES COMERCIAIS DINÂMICAS */}
        <div className="mb-12">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Condições Comerciais e Observações</h3>
          <div className="text-xs text-gray-500 space-y-2 leading-relaxed">
            {docsConfig.quote_terms_text ? (
              <div className="whitespace-pre-wrap">{String(docsConfig.quote_terms_text)}</div>
            ) : (
              <p>Termos comerciais não configurados.</p>
            )}
          </div>
        </div>

        {/* ASSINATURAS DINÂMICAS */}
        {docsConfig.show_signature_on_quotes && (
          <div className="pt-8 border-t border-gray-200 grid grid-cols-2 gap-16 text-center mb-10">
            <div>
              <div className="border-b border-gray-400 mb-3 w-full mx-auto"></div>
              <p className="font-bold text-sm text-gray-800">{companyName}</p>
              <p className="text-xs text-gray-500">{quote.salesperson?.full_name || "Responsável Comercial"}</p>
            </div>
            <div>
              <div className="border-b border-gray-400 mb-3 w-full mx-auto"></div>
              <p className="font-bold text-sm text-gray-800">{quote.clients?.company_name}</p>
              <p className="text-xs text-gray-500">De Acordo / Aprovação</p>
            </div>
          </div>
        )}

        {/* RODAPÉ DINÂMICO */}
        <div className="mt-auto text-center text-[10px] text-gray-400 border-t border-gray-100 pt-4">
          <p>
            {companyProfile?.proposal_footer || `${companyName} | Documento gerado pelo sistema Arxum`}
          </p>
          {companyAddress && <p className="mt-1">{companyAddress}</p>}
          {docsConfig.show_company_contacts_on_quotes && (
            <p className="mt-1">
              {companyProfile?.contact_email} {companyProfile?.phone_mobile && `| ${companyProfile.phone_mobile}`}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}