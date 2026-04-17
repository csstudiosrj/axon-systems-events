"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { Loader2, Printer, ArrowLeft } from "lucide-react";

export default function OrcamentoPDFPage() {
  const params = useParams();
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const[loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchQuoteData(params.id as string);
    }
  }, [params.id]);

  const fetchQuoteData = async (id: string) => {
    // Busca o cabeçalho do orçamento e os dados do cliente
    const { data: quoteData } = await supabase
      .from("quotes")
      .select("*, clients(*)")
      .eq("id", id)
      .single();

    // Busca os itens do orçamento
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
    return <div className="text-white">Orçamento não encontrado.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Botões de Ação (Escondidos na Impressão) */}
      <div className="flex justify-between items-center mb-8 print:hidden">
        <button 
          onClick={() => router.push("/orcamentos")}
          className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
        >
          <ArrowLeft size={20} /> Voltar
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-cs-green text-white px-6 py-2 rounded-md font-medium hover:bg-opacity-90 transition-colors"
        >
          <Printer size={20} /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* Documento A4 (Fundo branco para impressão) */}
      <div className="bg-white text-black p-10 rounded-lg shadow-lg print:shadow-none print:p-0 min-h-[297mm]">
        
        {/* Cabeçalho da Empresa */}
        <div className="flex justify-between items-start border-b-2 border-cs-green pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black tracking-tight">
              CS <span className="text-cs-green">com</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">Excelência em Produção Técnica</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-bold text-black">Proposta Comercial</p>
            <p>Data: {new Date(quote.created_at).toLocaleDateString('pt-BR')}</p>
            <p>Validade: 15 dias</p>
          </div>
        </div>

        {/* Dados do Cliente e Evento */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Dados do Cliente</h3>
            <p className="font-bold text-lg">{quote.clients?.company_name}</p>
            <p className="text-sm text-gray-600">CNPJ/CPF: {quote.clients?.document}</p>
            {quote.clients?.contact_name && <p className="text-sm text-gray-600">A/C: {quote.clients.contact_name}</p>}
            {quote.clients?.email && <p className="text-sm text-gray-600">{quote.clients.email}</p>}
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Dados do Evento</h3>
            <p className="font-bold text-lg">{quote.title}</p>
            <p className="text-sm text-gray-600">Ref: #{quote.id.split('-')[0].toUpperCase()}</p>
          </div>
        </div>

        {/* Tabela de Custos */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Detalhamento de Custos</h3>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="p-3 border border-gray-200 w-16">Tipo</th>
                <th className="p-3 border border-gray-200">Descrição</th>
                <th className="p-3 border border-gray-200 text-center w-16">Qtd</th>
                <th className="p-3 border border-gray-200 text-center w-16">Dias</th>
                <th className="p-3 border border-gray-200 text-right w-28">Diária</th>
                <th className="p-3 border border-gray-200 text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="p-3 border border-gray-200 text-xs text-gray-500 uppercase">
                    {item.category === 'equipment' ? 'Equip' : item.category === 'labor' ? 'Equipe' : 'Log'}
                  </td>
                  <td className="p-3 border border-gray-200 font-medium">{item.description}</td>
                  <td className="p-3 border border-gray-200 text-center">{item.quantity}</td>
                  <td className="p-3 border border-gray-200 text-center">{item.days}</td>
                  <td className="p-3 border border-gray-200 text-right">{formatCurrency(item.daily_rate)}</td>
                  <td className="p-3 border border-gray-200 text-right font-medium">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Resumo Financeiro */}
        <div className="flex justify-end mb-12">
          <div className="w-80 bg-gray-50 p-6 rounded border border-gray-200 space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Equipamentos:</span>
              <span>{formatCurrency(quote.total_equipment_cost)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Equipe Técnica:</span>
              <span>{formatCurrency(quote.total_labor_cost)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 border-b border-gray-200 pb-3">
              <span>Logística:</span>
              <span>{formatCurrency(quote.total_logistics_cost)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-black pt-2">
              <span>Total:</span>
              <span className="text-cs-green">{formatCurrency(quote.final_amount)}</span>
            </div>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="mt-24 pt-8 border-t border-gray-200 grid grid-cols-2 gap-12 text-center">
          <div>
            <div className="border-b border-gray-400 mb-2 w-3/4 mx-auto"></div>
            <p className="font-bold text-sm">CS com Eventos</p>
            <p className="text-xs text-gray-500">Departamento Comercial</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-2 w-3/4 mx-auto"></div>
            <p className="font-bold text-sm">{quote.clients?.company_name}</p>
            <p className="text-xs text-gray-500">De Acordo / Aprovação</p>
          </div>
        </div>

      </div>
    </div>
  );
}