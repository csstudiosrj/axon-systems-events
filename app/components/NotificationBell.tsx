"use client";

import React, { useRef, useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications, type Notification } from "../hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  quote:              "Orçamento",
  financial:          "Financeiro",
  ticket:             "Suporte",
  hr_occurrence:      "RH — Ocorrência",
  hr_payroll:         "RH — Holerite",
  hr_reimbursement:   "RH — Reembolso",
  service_order:      "Ordem de Serviço",
};

const TYPE_COLORS: Record<string, string> = {
  quote:            "text-cs-gold",
  financial:        "text-cs-green",
  ticket:           "text-blue-400",
  hr_occurrence:    "text-red-400",
  hr_payroll:       "text-purple-400",
  hr_reimbursement: "text-orange-400",
  service_order:    "text-cyan-400",
};

type Props = {
  userId: string | null | undefined;
};

export default function NotificationBell({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications(userId);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen(prev => !prev);
    if (!open && unreadCount > 0) {
      void markAllRead();
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Botão sininho */}
      <button
        onClick={handleOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-white focus:outline-none"
        aria-label="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-14 z-50 w-80 animate-in rounded-lg border border-surface/50 bg-surface shadow-2xl fade-in slide-in-from-top-2">
          {/* Header do dropdown */}
          <div className="flex items-center justify-between border-b border-surface/50 px-4 py-3">
            <span className="text-sm font-bold text-white">Notificações</span>
            {notifications.some(n => !n.is_read) && (
              <button
                onClick={() => void markAllRead()}
                className="text-xs text-text-secondary transition-colors hover:text-cs-green"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-secondary">
                Nenhuma notificação
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={markOneRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification: n,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const isUnread = !n.is_read;
  const color = TYPE_COLORS[n.type] ?? "text-text-secondary";
  const label = TYPE_LABELS[n.type] ?? n.type;

  return (
    <button
      onClick={() => onRead(n.id)}
      className={`w-full border-b border-surface/30 px-4 py-3 text-left transition-colors last:border-0 hover:bg-background ${
        isUnread ? "bg-cs-green/5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isUnread && (
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-cs-green" />
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>
              {label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-white">{n.title}</p>
          {n.body && (
            <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{n.body}</p>
          )}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-text-secondary">
        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
      </p>
    </button>
  );
}