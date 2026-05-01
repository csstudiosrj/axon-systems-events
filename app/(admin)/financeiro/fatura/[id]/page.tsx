"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { 
  Loader2, Printer, ArrowLeft, Receipt, Globe, 
  Mail, Phone, MapPin, CreditCard, AlertCircle, XCircle,
  CheckCircle, Download, ExternalLink
} from "lucide-react";
import { useSettings } from "@/app/providers/SettingsProvider";

// --- TIPAGENS (BLINDAGEM TYPESCRIPT) ---
interface FaturaData {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  due_date: string;
  payment_date: string | null;
  status: string;
  payment_method: string;
  document_number: string | null;
  clients: {
    company_name: string;
    document: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipcode: string;
  } | null;
  service_orders?: {
    id: string;
    quotes: {
      title: string;
    };
  } | null;
}

export default function FaturaPDFPage() {
  const params = useParams();
  const router = useRouter();
  const { companyProfile, systemPreferences } = useSettings();
  
  const [transaction, setTransaction] = useState<FaturaData | null>(null);
  const [loading, setLoading] = useState(true);

  const currency = systemPreferences?.currency_code || "BRL";
  const primaryColor = companyProfile?.primary_color || "#138946";

  const fetchFatura = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select(`
        *,
        clients (*),
        service_orders ( id, quotes ( title ) )
      `)
      .eq("id", id)
      .single();

    if (!error && data) {
      setTransaction(data as unknown as FaturaData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (params.id) fetchFatura(params.id as string);
  }, [params.id, fetchFatura]);

  const formatCurrency = (v: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0807]">
        <Loader2 className="animate-spin text-[#138946]" size={48} />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white space-y-4 bg-[#0d0807]">
        <AlertCircle size={48} className="text-red-500" />
        <p className="text-lg font-bold uppercase tracking-widest">Lançamento não localizado.</p>
        <button onClick={() => router.back()} className="text-[#138946] hover:underline">Voltar ao Financeiro</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 pt-8">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; size: A4; }
          body { background-color: white !important; color: black !important; }
          .print-hidden { display: none !important; }
          .print-container { padding: 20mm !important; }
        }
      `}} />

      {/* BARRA DE AÇÕES */}
      <div className="flex justify-between items-center mb-8 print-hidden px-4">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-[#a19d9c] hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest"
        >
          <ArrowLeft size={16} /> Voltar ao Hub Financeiro
        </button>
        <button 
          onClick={() => window.print()} 
          className="bg-[#138946] text-white px-8 py-2.5 rounded-md font-black uppercase text-xs flex items-center gap-2 shadow-lg hover:bg-opacity-90 transition-all"
        >
          <Printer size={18} /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* DOCUMENTO A4 */}
      <div className="print-container bg-white text-black p-12 rounded-lg shadow-2xl min-h-[297mm] flex flex-col border border-gray-100 mx-4 sm:mx-0">
        
        {/* HEADER CORPORATIVO */}
        <div className="flex justify-between items-start border-b-2 pb-8 mb-10" style={{ borderColor: primaryColor }}>
          <div>
            {companyProfile.logo_url ? (
              <img src={companyProfile.logo_url} alt={companyProfile.company_name} className="max-h-16 w-auto mb-4 object-contain" />
            ) : (
              <h1 className="text-3xl font-black uppercase tracking-tighter">{companyProfile.company_name}</h1>
            )}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{companyProfile.trade_name}</p>
            <p className="text-[10px] text-gray-500 mt-1">CNPJ: {companyProfile.cnpj}</p>
          </div>
          <div className="text-right">
            <div className="inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor, border: `1px solid ${primaryColor}30` }}>
              {transaction.type === 'income' ? 'Fatura Comercial' : 'Comprovante de Despesa'}
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tighter">REF: #{transaction.id.split('-')[0].toUpperCase()}</h2>
            <p className="text-sm text-gray-600 font-medium">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* DADOS DO CLIENTE E RESUMO */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b pb-1">Destinatário</h3>
            <div>
              <p className="text-lg font-black text-gray-900 uppercase tracking-tight">{transaction.clients?.company_name || 'Consumidor Final'}</p>
              <p className="text-sm text-gray-600 font-bold">Doc: {transaction.clients?.document || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 flex items-center gap-2"><Mail size={12} /> {transaction.clients?.email || 'N/A'}</p>
              <p className="text-xs text-gray-500 flex items-center gap-2"><Phone size={12} /> {transaction.clients?.phone || 'N/A'}</p>
              <p className="text-xs text-gray-500 flex items-center gap-2"><MapPin size={12} /> {transaction.clients?.address || 'Endereço não informado'}</p>
            </div>
          </div>
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase text-gray-400">Vencimento</span>
              <span className="text-sm font-bold text-gray-900">{new Date(transaction.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase text-gray-400">Método</span>
              <span className="text-sm font-bold text-gray-900 uppercase">{transaction.payment_method}</span>
            </div>
            <div className="border-t pt-4">
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Total do Lançamento</p>
              <p className="text-3xl font-black" style={{ color: primaryColor }}>{formatCurrency(transaction.amount)}</p>
            </div>
          </div>
        </div>

        {/* TABELA DE DETALHAMENTO */}
        <div className="mb-12 flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest rounded-tl-lg">Descrição</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Categoria</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right rounded-tr-lg">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="p-4">
                  <p className="font-bold text-gray-900">{transaction.description}</p>
                  {transaction.service_orders && (
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Vínculo: {transaction.service_orders.quotes.title}</p>
                  )}
                </td>
                <td className="p-4 text-sm text-gray-600 font-medium uppercase">{transaction.category}</td>
                <td className="p-4 text-right font-bold text-gray-900">{formatCurrency(transaction.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* INSTRUÇÕES E TOTAIS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
              <CreditCard size={14} /> Instruções de Pagamento
            </h4>
            <div className="text-xs text-gray-700 space-y-2 font-medium">
              <p><b>Favorecido:</b> {companyProfile.company_name}</p>
              <p><b>Chave PIX:</b> {companyProfile.contact_email}</p>
              <p className="text-[10px] text-gray-400 mt-4 leading-relaxed italic">
                Este documento serve como registro comercial da transação. Para validade fiscal, consulte a Nota Fiscal eletrônica correspondente.
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-end text-right space-y-2">
            <div className="flex justify-between text-sm text-gray-500 font-bold uppercase">
              <span>Subtotal:</span>
              <span>{formatCurrency(transaction.amount)}</span>
            </div>
            <div className="flex justify-between text-2xl font-black border-t-2 pt-4" style={{ borderColor: primaryColor }}>
              <span className="uppercase tracking-tighter">Total Geral:</span>
              <span style={{ color: primaryColor }}>{formatCurrency(transaction.amount)}</span>
            </div>
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="mt-auto pt-10 border-t border-gray-100 text-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">
            {companyProfile.invoice_footer || `Documento Gerado pelo Ecossistema ARXUM`}
          </p>
          <div className="flex justify-center gap-8 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Globe size={10} /> {companyProfile.website || 'arxum.com'}</span>
            <span className="flex items-center gap-1"><Mail size={10} /> {companyProfile.contact_email}</span>
            <span className="flex items-center gap-1"><Phone size={10} /> {companyProfile.phone_mobile}</span>
          </div>
        </div>

      </div>
    </div>
  );
}