"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/app/lib/supabase";

interface FaturaRow {
  id: string;
  description: string | null;
  amount: number | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
}

function formatCurrency(value: number | null | undefined): string {
  const safeValue = typeof value === "number" ? value : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safeValue);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getStatusLabel(status: string | null | undefined): string {
  switch ((status || "").toLowerCase()) {
    case "paid":
    case "paga":
    case "pago":
      return "Paga";
    case "pending":
    case "pendente":
      return "Pendente";
    case "overdue":
    case "vencida":
      return "Vencida";
    default:
      return "Em aberto";
  }
}

function getStatusClasses(status: string | null | undefined): string {
  switch ((status || "").toLowerCase()) {
    case "paid":
    case "paga":
    case "pago":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
    case "pending":
    case "pendente":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
    case "overdue":
    case "vencida":
      return "bg-rose-500/15 text-rose-300 border border-rose-500/30";
    default:
      return "bg-blue-500/15 text-blue-300 border border-blue-500/30";
  }
}

export default function PortalFaturasPage() {
  const [loading, setLoading] = useState(true);
