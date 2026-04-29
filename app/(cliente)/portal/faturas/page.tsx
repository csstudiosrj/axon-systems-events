"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/app/lib/supabase";

interface FaturaRow {
  id: string;
  description?: string | null;
  amount?: number | null;
  status?: string | null;
  due_date?: string | null;
  created_at?: string | null;
}

function formatCurrency(value: number | null | undefined) {
  const safeValue = typeof value === "number" ? value : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safeValue);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getStatusLabel(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "paid":
    case "paga":
    case "pago":
      return "Paga";
    case "pending":
    case "pendente":
      return "Pendente";
    case "overdue":
    