"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_table: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

const STORAGE_KEY = "notif_read_ids";

function getLocalReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalReadId(id: string) {
  try {
    const ids = getLocalReadIds();
    ids.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function useNotifications(userId: string | null | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);

  const recalcUnread = useCallback((list: Notification[]) => {
    const localRead = getLocalReadIds();
    setUnreadCount(list.filter(n => !n.is_read && !localRead.has(n.id)).length);
  }, []);

  // Fetch inicial
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, entity_table, entity_id, is_read, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      const list = (data ?? []) as Notification[];
      setNotifications(list);
      recalcUnread(list);
    };

    void load();
  }, [userId, recalcUnread]);

  // Realtime
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const novo = payload.new as Notification;
          setNotifications(prev => [novo, ...prev].slice(0, 30));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;

    // Atualiza banco
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);

    // Atualiza local
    unread.forEach(n => saveLocalReadId(n.id));

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [userId, notifications]);

  const markOneRead = useCallback(async (id: string) => {
    saveLocalReadId(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    recalcUnread(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
  }, [notifications, recalcUnread]);

  return { notifications, unreadCount, markAllRead, markOneRead };
}