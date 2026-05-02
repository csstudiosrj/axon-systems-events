"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useSettings } from "../../../providers/SettingsProvider";
import {
  CreditCard,
  Loader2,
  Calendar,
  Receipt,
  CircleDollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock3,
} from "lucide-react";

type FinancialTransactionRow = {
  id: string;
  description: string;
  type: string | null;
  category: string | null;
  amount: number;
  status: string | null;
  due_date: string;
  payment_date: string | null;
  created_at: string;
  notes: string | null;
  client_id: string | null;
  quote_id: string | null;
  service_order_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  payment_method: string | null;
  attachment_url: string | null;
  source: string | null;
  invoice_notes: string | null;
  document_number: string | null;
};

export default function PortalFaturasPage() {
  const { resolvedClientId, systemPreferences } = useSettings();
  const [transactions, setTransactions] = useState<FinancialTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const labels = systemPreferences?.custom_labels;
  const clientSingular = labels?.entity_client_singular || "Cliente";

  const fetchTransactions = useCallback(async () => {
    if (!resolvedClientId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("financial_transactions")
      .select(`
        id,
        description,
        type,
        category,
        amount,
        status,
        due_date,
        payment_date,
        created_at,
        notes,
        client_id,
        quote_id,
        service_order_id,
        installment_number,
        total_installments,
        payment_method,
        attachment_url,
        source,
        invoice_notes,
        document_number
      `)
      .eq("client_id", resolvedClientId)
      .order("due_date", { ascending: true });

    if (!error && data) {
      setTransactions(data as FinancialTransactionRow[]);
    } else {
      setTransactions([]);
    }

    setLoading(false);
  }, [resolvedClientId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const currency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value || 0));

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("pt-BR");
  };

  const today = new Date();

  const summary = useMemo(() => {
    const open = transactions.filter(
      (item) => item.status !== "paid" && item.status !== "received"
    );

    const paid = transactions.filter(
      (item) => item.status === "paid" || item.status === "received"
    );

    const overdue = open.filter((item) => new Date(item.due_date) < today);

    const totalOpen = open.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const totalPaid = paid.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const totalOverdue = overdue.reduce((acc, item) => acc + Number(item.amount || 0), 0);

    return {
      totalOpen,
      totalPaid,
      totalOverdue,
      countOpen: open.length,
      countPaid: paid.length,
      countOverdue: overdue.length,
    };
  }, [transactions]);

  const getStatusBadge = (item: FinancialTransactionRow) => {
    const status = item.status || "pending";
    const isPaid = status === "paid" || status === "received";
    const isOverdue = !isPaid && new Date(item.due_date) < today;

    if (isPaid) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cs-green/20 bg-cs-green/10 px-3 py-1 text-xs font-bold text-cs-green">
          <CheckCircle2 size={14} /> Pago
        </span>
      );
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
          <AlertTriangle size={14} /> Vencido
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cs-gold/20 bg-cs-gold/10 px-3 py-1 text-xs font-bold text-cs-gold">
        <Clock3 size={14} /> Em aberto
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-background text-white p-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-surface/50 bg-surface p-6 shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl">
                <CreditCard className="text-cs-gold" size={28} />
                Faturas
              </h1>
              <p className="mt-2 text-sm text-text-secondary sm:text-base">
                Acompanhe cobranças, vencimentos e pagamentos vinculados ao seu cadastro de {clientSingular.toLowerCase()}.
              </p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-surface/50 bg-surface p-5 shadow-md">
            <p className="text-xs uppercase tracking-wider text-text-secondary">Em aberto</p>
            <p className="mt-3 text-2xl font-bold text-white">{currency(summary.totalOpen)}</p>
            <p className="mt-1 text-xs text-text-secondary">{summary.countOpen} lançamento(s)</p>
          </div>

          <div className="rounded-2xl border border-surface/50 bg-surface p-5 shadow-md">
            <p className="text-xs uppercase tracking-wider text-text-secondary">Pagos</p>
            <p className="mt-3 text-2xl font-bold text-cs-green">{currency(summary.totalPaid)}</p>
            <p className="mt-1 text-xs text-text-secondary">{summary.countPaid} lançamento(s)</p>
          </div>

          <div className="rounded-2xl border border-surface/50 bg-surface p-5 shadow-md">
            <p className="text-xs uppercase tracking-wider text-text-secondary">Vencidos</p>
            <p className="mt-3 text-2xl font-bold text-red-400">{currency(summary.totalOverdue)}</p>
            <p className="mt-1 text-xs text-text-secondary">{summary.countOverdue} lançamento(s)</p>
          </div>
        </section>

        <section className="rounded-2xl border border-surface/50 bg-surface shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-cs-gold" size={36} />
            </div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Receipt className="mx-auto mb-4 text-surface" size={44} />
              <h2 className="text-xl font-bold text-white">Nenhuma fatura encontrada</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Não há lançamentos financeiros vinculados ao seu cadastro no momento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left">
                <thead className="bg-background/40">
                  <tr className="text-xs uppercase tracking-wider text-text-secondary">
                    <th className="px-6 py-4 font-medium">Descrição</th>
                    <th className="px-6 py-4 font-medium">Valor</th>
                    <th className="px-6 py-4 font-medium">Vencimento</th>
                    <th className="px-6 py-4 font-medium">Pagamento</th>
                    <th className="px-6 py-4 font-medium">Parcela</th>
                    <th className="px-6 py-4 font-medium">Documento</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface/50">
                  {transactions.map((item) => (
                    <tr key={item.id} className="hover:bg-background/20 transition-colors align-top">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white">{item.description}</p>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-text-secondary">
                          {item.category ? <span>Categoria: {item.category}</span> : null}
                          {item.payment_method ? <span>Pagamento: {item.payment_method}</span> : null}
                          {item.source ? <span>Origem: {item.source}</span> : null}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <CircleDollarSign size={16} className="text-cs-gold" />
                          {currency(item.amount)}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Calendar size={15} className="text-text-secondary" />
                          {formatDate(item.due_date)}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-white">{formatDate(item.payment_date)}</td>

                      <td className="px-6 py-4 text-sm text-white">
                        {item.installment_number && item.total_installments
                          ? `${item.installment_number}/${item.total_installments}`
                          : "-"}
                      </td>

                      <td className="px-6 py-4 text-sm text-white">
                        {item.document_number || "-"}
                      </td>

                      <td className="px-6 py-4">{getStatusBadge(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}