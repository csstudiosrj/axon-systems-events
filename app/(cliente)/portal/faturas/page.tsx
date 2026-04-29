"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { CreditCard, FileText, Loader2, CheckCircle, AlertTriangle, Download, ArrowRight, Wallet, X, Copy, Banknote, ExternalLink } from "lucide-react";
import Link from "next/link";

// --- TIPAGEM AMPLIADA ---
interface Transaction {
  id: string;
  description: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  due_date: string;
  total_installments?: number;
  installment_number?: number;
  quotes?: { title: string };
}

export default function ClientFaturasPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [companyData, setCompanyData] = useState<{ cnpj: string; pix_key: string } | null>(null);
  
  // States para o Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [toasts, setToasts] = useState<Array<{id: number, msg: string}>>([]);

  const addToast = (msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // ... [mantive sua lógica de busca de perfil e transações]
    // ADICIONADO: Buscar dados da empresa para o Modal
    const { data: company } = await supabase.from("company_profile").select("cnpj, pix_key").single();
    if (company) setCompanyData(company);
    setLoading(false);
  };

  // --- FUNÇÕES DO PENTE-FINO ---
  const handleOpenPayment = (tx: Transaction) => {
    setSelectedTx(tx);
    setModalOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copiado!`);
  };

  // ... (restante dos seus helpers como formatCurrency e isOverdue)

  return (
    <div className="flex-1 bg-background p-8 relative">
      {/* ... [Seu código de Header e KPIs permanece intacto] ... */}

      {/* Exemplo de botão Pagar modificado */}
      <button 
        onClick={() => handleOpenPayment(t)}
        className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-all shadow-lg"
      >
        Pagar <ArrowRight size={16} />
      </button>

      {/* MODAL CUSTOMIZADO (estilo luxuoso #1a1413) */}
      {modalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1a1413] border border-surface/50 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Banknote className="text-cs-green" /> Pagamento PIX
              </h3>
              <button onClick={() => setModalOpen(false)}><X className="text-text-secondary hover:text-white"/></button>
            </div>
            
            <p className="text-text-secondary text-sm mb-6">Dados para o pagamento de <strong>{selectedTx.description}</strong>:</p>
            
            <div className="space-y-4">
              <div className="bg-background p-4 rounded-lg border border-surface/50">
                <p className="text-xs text-text-secondary uppercase">CNPJ</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-mono text-white">{companyData?.cnpj || "N/A"}</span>
                  <button onClick={() => copyToClipboard(companyData?.cnpj || "", "CNPJ")}><Copy size={16} className="text-cs-green"/></button>
                </div>
              </div>
              <div className="bg-background p-4 rounded-lg border border-surface/50">
                <p className="text-xs text-text-secondary uppercase">Chave PIX</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-mono text-white">{companyData?.pix_key || "N/A"}</span>
                  <button onClick={() => copyToClipboard(companyData?.pix_key || "", "PIX")}><Copy size={16} className="text-cs-green"/></button>
                </div>
              </div>
            </div>

            <p className="text-xs text-cs-gold mt-6 italic">* A baixa será processada em até 24h após o envio do comprovante.</p>
          </div>
        </div>
      )}

      {/* Toast Overlay */}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className="bg-cs-green text-white px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-right">
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}