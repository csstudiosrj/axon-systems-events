"use client";

import React, { useRef, useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications, type Notification } from "../hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  quote:            "Orçamento",
  financial:        "Financeiro",
  ticket:           "Suporte",
  hr_occurrence:    "RH — Ocorrência",
  hr_payroll:       "RH — Holerite",
  hr_reimbursement: "RH — Reembolso",
  service_order:    "Ordem de Serviço",
};

const TYPE_DOT: Record<string, string> = {
  quote:            "bg-cs-gold",
  financial:        "bg-cs-green",
  ticket:           "bg-blue-400",
  hr_occurrence:    "bg-red-400",
  hr_payroll:       "bg-purple-400",
  hr_reimbursement: "bg-orange-400",
  service_order:    "bg-cyan-400",
};

const TYPE_TEXT: Record<string, string> = {
  quote:            "text-cs-gold",
  financial:        "text-cs-green",
  ticket:           "text-blue-400",
  hr_occurrence:    "text-red-400",
  hr_payroll:       "text-purple-400",
  hr_reimbursement: "text-orange-400",
  service_order:    "text-cyan-400",
};

type Props = { userId: string | null | undefined };

export default function NotificationBell({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications(userId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) void markAllRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-background hover:text-white focus:outline-none"
        aria-label="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-80 animate-in rounded-lg border border-surface/50 bg-surface shadow-2xl fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-surface/50 px-4 py-3">
            <span className="text-sm font-bold text-white">Notificações</span>
            {notifications.some((n) => !n.is_read) && (
              <button onClick={() => void markAllRead()} className="text-xs text-text-secondary hover:text-cs-green transition-colors">
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={28} className="mx-auto mb-3 text-text-secondary opacity-40" />
                <p className="text-sm text-text-secondary">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifItem key={n.id} n={n} onRead={markOneRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  return (
    <button
      onClick={() => onRead(n.id)}
      className={`w-full border-b border-surface/30 px-4 py-3 text-left transition-colors last:border-0 hover:bg-background ${!n.is_read ? "bg-cs-green/5" : ""}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[n.type] ?? "bg-text-secondary"} ${!n.is_read ? "opacity-100" : "opacity-0"}`} />
        <div className="min-w-0 flex-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${TYPE_TEXT[n.type] ?? "text-text-secondary"}`}>
            {TYPE_LABELS[n.type] ?? n.type}
          </span>
          <p className="mt-0.5 truncate text-sm font-medium text-white">{n.title}</p>
          {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{n.body}</p>}
          <p className="mt-1 text-[10px] text-text-secondary">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </div>
    </button>
  );
}