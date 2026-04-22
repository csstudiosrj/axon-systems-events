"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { CreditCard, FileText, Loader2, Clock, CheckCircle, AlertTriangle, Download, ArrowRight } from "lucide-react";
import Link from "next/link";

// --- BLINDAGEM TYPESCRIPT ---
interface Quote {
  id: string;
  title: string;
  status: string;
  final_amount: number;
  created_at: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  due_date: string;
  payment_date?: string;
  installment_number?: number;
  total_installments?: number;
  payment_method?: string;
  quotes?: { title: string };
}

export default function ClientFaturasPage() {
  const [loading, setLoading] = useState(true);
  const[activeTab, setActiveTab] = useState<"pendentes" | "historico" | "contratos">("pendentes");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const[quotes, setQuotes] = useState<Quote[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetchClientData();
  },[]);

  const fetchClientData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", session.user.id)
        .single();

      if (profile?.client_id) {
        setClientId(profile.client_id);
        
        // Busca Transações Financeiras do Cliente (Apenas Entradas/Receitas da visão da CS com)
        const { data: transData } = await supabase
          .from("financial_transactions")
          .select(`
            id, description, amount, status, due_date, payment_date, 
            installment_number, total_installments, payment_method,
            quotes ( title )
          `)
          .eq("client_id", profile.client_id)
          .eq("type", "income")
          .order("due_date", { ascending: true });

        if (transData) setTransactions(transData as unknown as Transaction[]);

        // Busca Orçamentos Aprovados do Cliente
        const { data: quotesData } = await supabase
          .from("quotes")
          .select("id, title, status, final_amount, created_at")
          .eq("client_id", profile.client_id)
          .in("status",["approved", "pending_approval"])
          .order("created_at", { ascending: false });

        if (quotesData) setQuotes(quotesData as Quote[]);
      }
    } catch (error) {
      console.error("Erro ao buscar dados financeiros:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const isOverdue = (dateStr: string, status: string) => {
    return new Date(dateStr) < new Date(new Date().setHours(0,0,0,0)) && status === 'pending';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-cs-green" size={48} />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-surface border border-surface/50 p-8 rounded-xl text-center max-w-md">
          <AlertTriangle size={48} className="text-cs-gold mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Conta não vinculada</h2>
          <p className="text-text-secondary text-sm">Seu usuário não está vinculado a uma empresa. Entre em contato com o suporte para regularizar seu acesso financeiro.</p>
        </div>
      </div>
    );
  }

  const pendingTransactions = transactions.filter(t => t.status === 'pending');
  const paidTransactions = transactions.filter(t => t.status === 'paid');
  const totalPending = pendingTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const totalOverdue = pendingTransactions.filter(t => isOverdue(t.due_date, t.status)).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="flex-1 bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <CreditCard className="text-blue-500" size={32} />
            Faturas e Contratos
          </h1>
          <p className="text-text-secondary mt-2">Acompanhe seus pagamentos, baixe boletos e visualize propostas aprovadas.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-surface/50 p-6 rounded-xl">
            <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Total em Aberto</p>
            <p className="text-3xl font-extrabold text-white">{formatCurrency(totalPending)}</p>
            <p className="text-xs text-text-secondary mt-2">{pendingTransactions.length} fatura(s) pendente(s)</p>
          </div>
          
          <div className={`bg-surface border p-6 rounded-xl ${totalOverdue > 0 ? 'border-red-500/50 bg-red-500/5' : 'border-surface/50'}`}>
            <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${totalOverdue > 0 ? 'text-red-500' : 'text-text-secondary'}`}>Faturas Vencidas</p>
            <p className={`text-3xl font-extrabold ${totalOverdue > 0 ? 'text-red-500' : 'text-white'}`}>{formatCurrency(totalOverdue)}</p>
            {totalOverdue > 0 && <p className="text-xs text-red-400 mt-2">Sujeito a juros e multas. Regularize agora.</p>}
          </div>

          <div className="bg-surface border border-surface/50 p-6 rounded-xl">
            <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Próximo Vencimento</p>
            {pendingTransactions.length > 0 ? (
              <>
                <p className="text-xl font-bold text-white mb-1">
                  {new Date(pendingTransactions[0].due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                </p>
                <p className="text-sm text-blue-400 font-medium">{formatCurrency(pendingTransactions[0].amount)}</p>
              </>
            ) : (
              <p className="text-lg font-medium text-text-secondary mt-2">Nenhuma fatura futura</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-surface/50 pb-px">
          <button 
            onClick={() => setActiveTab("pendentes")} 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pendentes' ? 'border-blue-500 text-blue-500' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            Faturas em Aberto
          </button>
          <button 
            onClick={() => setActiveTab("historico")} 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'historico' ? 'border-cs-green text-cs-green' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            Histórico de Pagamentos
          </button>
          <button 
            onClick={() => setActiveTab("contratos")} 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'contratos' ? 'border-cs-gold text-cs-gold' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            Propostas e Contratos
          </button>
        </div>

        {/* Tab Content: Pendentes */}
        {activeTab === "pendentes" && (
          <div className="bg-surface border border-surface/50 rounded-xl overflow-hidden">
            {pendingTransactions.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle size={48} className="text-cs-green mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium text-white">Tudo em dia!</p>
                <p className="text-text-secondary text-sm mt-1">Você não possui faturas em aberto no momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-surface/50">
                {pendingTransactions.map(t => (
                  <div key={t.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-background/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${isOverdue(t.due_date, t.status) ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-400'}`}>
                          {isOverdue(t.due_date, t.status) ? 'Vencida' : 'A Vencer'}
                        </span>
                        {t.total_installments && t.total_installments > 1 && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-surface border border-surface/50 text-text-secondary uppercase">
                            Parcela {t.installment_number}/{t.total_installments}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white">{t.description}</h3>
                      <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                        <FileText size={12}/> Ref: {t.quotes?.title || 'Lançamento Avulso'}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-8 w-full md:w-auto border-t border-surface/50 md:border-0 pt-4 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Vencimento</p>
                        <p className={`font-bold ${isOverdue(t.due_date, t.status) ? 'text-red-500' : 'text-white'}`}>
                          {new Date(t.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Valor</p>
                        <p className="text-xl font-extrabold text-white">{formatCurrency(t.amount)}</p>
                      </div>
                      <button className="hidden md:flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold transition-colors shadow-lg">
                        Pagar <ArrowRight size={16} />
                      </button>
                    </div>
                    {/* Mobile Button */}
                    <button className="md:hidden w-full flex justify-center items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-md text-sm font-bold transition-colors shadow-lg mt-2">
                      Pagar Agora
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Histórico */}
        {activeTab === "historico" && (
          <div className="bg-surface border border-surface/50 rounded-xl overflow-hidden">
            {paidTransactions.length === 0 ? (
              <div className="p-12 text-center text-text-secondary">
                Nenhum histórico de pagamento encontrado.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-text-secondary">
                <thead className="bg-background/50 text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-6 py-4 font-medium">Descrição</th>
                    <th className="px-6 py-4 font-medium">Data do Pagamento</th>
                    <th className="px-6 py-4 font-medium">Método</th>
                    <th className="px-6 py-4 font-medium">Valor</th>
                    <th className="px-6 py-4 font-medium text-right">Comprovante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface/50">
                  {paidTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-white">{t.description}</p>
                        <p className="text-xs mt-0.5">{t.quotes?.title}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-white font-medium">
                          <CheckCircle size={14} className="text-cs-green" />
                          {t.payment_date ? new Date(t.payment_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 uppercase text-xs font-bold">{t.payment_method || 'N/A'}</td>
                      <td className="px-6 py-4 font-bold text-cs-green">{formatCurrency(t.amount)}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="inline-flex items-center gap-1 text-text-secondary hover:text-white transition-colors text-xs font-medium bg-background border border-surface/50 px-3 py-1.5 rounded">
                          <Download size={14} /> Recibo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab Content: Contratos e Orçamentos */}
        {activeTab === "contratos" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quotes.length === 0 ? (
              <div className="col-span-2 p-12 text-center text-text-secondary bg-surface border border-surface/50 rounded-xl">
                Nenhum contrato ou proposta aprovada no momento.
              </div>
            ) : (
              quotes.map(quote => (
                <div key={quote.id} className="bg-surface border border-surface/50 rounded-xl p-6 hover:border-cs-gold/50 transition-colors group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-cs-gold/10 text-cs-gold mb-2 inline-block">
                        {quote.status === 'approved' ? 'Aprovado' : 'Aguardando Assinatura'}
                      </span>
                      <h3 className="text-lg font-bold text-white">{quote.title}</h3>
                      <p className="text-xs text-text-secondary mt-1">
                        Gerado em {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded-lg border border-surface/50 group-hover:border-cs-gold/30 transition-colors">
                      <FileText size={20} className="text-cs-gold" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-surface/50">
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Valor Total</p>
                      <p className="text-lg font-extrabold text-white">{formatCurrency(quote.final_amount)}</p>
                    </div>
                    <Link href={`/orcamentos/${quote.id}`} target="_blank" className="flex items-center gap-2 text-sm font-bold text-cs-gold hover:text-white transition-colors">
                      Baixar PDF <Download size={16} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}