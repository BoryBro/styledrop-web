"use client";

import { useCallback, useEffect, useState } from "react";

const LAB_NOTIFICATION_STORAGE_PREFIX = "styledrop:lab-notification-seen:";

type Balance100HistoryItem = {
  sessionId?: string;
  predictionCount?: number;
};

type NaboHistoryItem = {
  roomCode?: string;
  responseCount?: number;
};

type NaboPredictHistoryItem = {
  sessionId?: string;
  role?: "owner" | "respondent";
  status?: "waiting" | "completed";
};

type TravelHistoryItem = {
  roomId?: string;
};

type HistoryResponse<T> = {
  history?: T[];
};

function readSeenLabNotifications() {
  const seen: Record<string, number> = {};

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(LAB_NOTIFICATION_STORAGE_PREFIX)) continue;

      const key = storageKey.slice(LAB_NOTIFICATION_STORAGE_PREFIX.length);
      const count = Number(localStorage.getItem(storageKey) ?? 0);
      if (key && Number.isFinite(count)) seen[key] = count;
    }
  } catch {}

  return seen;
}

function unreadCount(seen: Record<string, number>, key: string, totalCount: number) {
  return Math.max(0, totalCount - (seen[key] ?? 0));
}

async function fetchHistory<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return [];

  const data = (await response.json().catch(() => null)) as HistoryResponse<T> | null;
  return Array.isArray(data?.history) ? data.history : [];
}

export function useLabNotificationSummary(enabled: boolean) {
  const [unreadTotal, setUnreadTotal] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadTotal(0);
      return;
    }

    const seen = readSeenLabNotifications();
    const [balanceHistory, naboHistory, naboPredictHistory, travelHistory] = await Promise.all([
      fetchHistory<Balance100HistoryItem>("/api/balance-100/history"),
      fetchHistory<NaboHistoryItem>("/api/nabo/history"),
      fetchHistory<NaboPredictHistoryItem>("/api/nabo-predict/history"),
      fetchHistory<TravelHistoryItem>("/api/travel-together/history"),
    ]);

    const balanceUnread = balanceHistory.reduce((sum, item) => {
      if (!item.sessionId) return sum;
      return sum + unreadCount(seen, `balance-100:${item.sessionId}`, item.predictionCount ?? 0);
    }, 0);

    const naboUnread = naboHistory.reduce((sum, item) => {
      if (!item.roomCode) return sum;
      return sum + unreadCount(seen, `nabo:${item.roomCode}`, item.responseCount ?? 0);
    }, 0);

    const naboPredictUnread = naboPredictHistory.reduce((sum, item) => {
      if (!item.sessionId || item.role !== "owner" || item.status !== "completed") return sum;
      return sum + unreadCount(seen, `nabo-predict:${item.sessionId}`, 1);
    }, 0);

    const travelUnread = travelHistory.reduce((sum, item) => {
      if (!item.roomId) return sum;
      return sum + unreadCount(seen, `travel-together:${item.roomId}`, 1);
    }, 0);

    setUnreadTotal(balanceUnread + naboUnread + naboPredictUnread + travelUnread);
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;

    const refreshOnFocus = () => void refresh();
    const refreshOnStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith(LAB_NOTIFICATION_STORAGE_PREFIX)) return;
      void refresh();
    };

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("storage", refreshOnStorage);
    const timer = window.setInterval(() => void refresh(), 60000);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("storage", refreshOnStorage);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  return { unreadTotal, refresh };
}
