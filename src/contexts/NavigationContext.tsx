"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

type NavigationContextValue = {
  isNavigating: boolean;
  startNavigation: () => void;
};

const NavigationContext = createContext<NavigationContextValue | undefined>(
  undefined,
);

const NAVIGATION_SAFETY_TIMEOUT_MS = 12_000;
const NAVIGATION_MIN_VISIBLE_MS = 250;

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  const lastStartAtRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopNavigation = () => {
    const startedAt = lastStartAtRef.current;
    if (!startedAt) {
      setIsNavigating(false);
      return;
    }

    const elapsedMs = Date.now() - startedAt;
    const remainingMs = Math.max(0, NAVIGATION_MIN_VISIBLE_MS - elapsedMs);

    window.setTimeout(() => {
      setIsNavigating(false);
      lastStartAtRef.current = null;
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    }, remainingMs);
  };

  const startNavigation = () => {
    setIsNavigating(true);
    lastStartAtRef.current = Date.now();

    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
    }

    safetyTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
      lastStartAtRef.current = null;
      safetyTimerRef.current = null;
    }, NAVIGATION_SAFETY_TIMEOUT_MS);
  };

  // Stop loader when route actually changes.
  useEffect(() => {
    stopNavigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      isNavigating,
      startNavigation,
    }),
    [isNavigating],
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return ctx;
}
