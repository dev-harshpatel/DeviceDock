"use client";

import {
  createContext,
  ReactNode,
  Suspense,
  useCallback,
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

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

const NAVIGATION_SAFETY_TIMEOUT_MS = 12_000;
const NAVIGATION_MIN_VISIBLE_MS = 250;

// Inner component that watches route changes — must be Suspense-wrapped because
// useSearchParams() requires it in Next.js 14 App Router.
function RouteChangeWatcher({ onRouteChange }: { onRouteChange: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onRouteChange();
  }, [pathname, searchParams?.toString(), onRouteChange]);

  return null;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);

  const lastStartAtRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopNavigation = useCallback(() => {
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
  }, []);

  const startNavigation = useCallback(() => {
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
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      isNavigating,
      startNavigation,
    }),
    [isNavigating, startNavigation],
  );

  return (
    <NavigationContext.Provider value={value}>
      <Suspense fallback={null}>
        <RouteChangeWatcher onRouteChange={stopNavigation} />
      </Suspense>
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
