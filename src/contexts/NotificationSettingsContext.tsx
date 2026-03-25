"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client/browser";
import { useCompany } from "@/contexts/CompanyContext";

function readIdsKey(companyId: string) {
  return `alerts-read-${companyId}`;
}

function loadReadIds(companyId: string): Set<string> {
  // localStorage is only available in the browser
  if (typeof window === "undefined" || !companyId) return new Set();
  try {
    const raw = localStorage.getItem(readIdsKey(companyId));
    if (raw) return new Set<string>(JSON.parse(raw));
  } catch {
    // ignore parse / quota errors
  }
  return new Set<string>();
}

function saveReadIds(companyId: string, ids: Set<string>) {
  if (typeof window === "undefined" || !companyId) return;
  try {
    localStorage.setItem(readIdsKey(companyId), JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}

interface NotificationSettingsState {
  pushNotificationsEnabled: boolean;
  lowStockThreshold: number;
  criticalStockThreshold: number;
  isLoaded: boolean;
  readIds: Set<string>;
}

interface NotificationSettingsContextType extends NotificationSettingsState {
  updateSettings: (
    partial: Partial<
      Pick<
        NotificationSettingsState,
        "pushNotificationsEnabled" | "lowStockThreshold" | "criticalStockThreshold"
      >
    >,
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (ids: string[]) => void;
}

const NotificationSettingsContext = createContext<NotificationSettingsContextType | undefined>(
  undefined,
);

export function NotificationSettingsProvider({ children }: { children: ReactNode }) {
  const { companyId } = useCompany();

  // Lazy initializer runs synchronously on first render (client-side only).
  // This ensures readIds are populated before the very first paint —
  // no async gap, no flash of the wrong badge count.
  const [state, setState] = useState<NotificationSettingsState>(() => ({
    pushNotificationsEnabled: true,
    lowStockThreshold: 5,
    criticalStockThreshold: 2,
    isLoaded: false,
    readIds: loadReadIds(companyId),
  }));

  // Load notification settings from DB (thresholds, push toggle).
  // readIds are already loaded synchronously above — don't touch them here.
  useEffect(() => {
    if (!companyId) return;

    supabase
      .from("company_settings")
      .select("push_notifications_enabled, low_stock_threshold, critical_stock_threshold")
      .eq("company_id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as {
          push_notifications_enabled: boolean | null;
          low_stock_threshold: number | null;
          critical_stock_threshold: number | null;
        } | null;

        setState((prev) => ({
          ...prev,
          pushNotificationsEnabled: row?.push_notifications_enabled ?? true,
          lowStockThreshold: row?.low_stock_threshold ?? 5,
          criticalStockThreshold: row?.critical_stock_threshold ?? 2,
          isLoaded: true,
          // readIds intentionally NOT overwritten — already loaded from localStorage
        }));
      });
  }, [companyId]);

  const updateSettings = useCallback(
    (
      partial: Partial<
        Pick<
          NotificationSettingsState,
          "pushNotificationsEnabled" | "lowStockThreshold" | "criticalStockThreshold"
        >
      >,
    ) => {
      setState((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const markAsRead = useCallback(
    (id: string) => {
      setState((prev) => {
        const next = new Set(prev.readIds);
        next.add(id);
        saveReadIds(companyId, next);
        return { ...prev, readIds: next };
      });
    },
    [companyId],
  );

  const markAllAsRead = useCallback(
    (ids: string[]) => {
      setState((prev) => {
        const next = new Set(prev.readIds);
        ids.forEach((id) => next.add(id));
        saveReadIds(companyId, next);
        return { ...prev, readIds: next };
      });
    },
    [companyId],
  );

  return (
    <NotificationSettingsContext.Provider
      value={{ ...state, updateSettings, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationSettingsContext.Provider>
  );
}

export function useNotificationSettings() {
  const context = useContext(NotificationSettingsContext);
  if (!context) {
    throw new Error("useNotificationSettings must be used within NotificationSettingsProvider");
  }
  return context;
}
