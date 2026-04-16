"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth/context";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { NavigationIndicator } from "@/components/layout/NavigationIndicator";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useRealtimeInvalidation } from "@/hooks/use-realtime-invalidation";
import { useState } from "react";

// Note: InventoryProvider and OrdersProvider are NOT here.
// They live inside CompanyShell (app/[companySlug]/layout.tsx) so they
// are company-scoped and can read companyId from CompanyContext.

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        // Longer GC time reduces re-fetches when navigating back to cached pages
        gcTime: 10 * 60 * 1000,
        // Admin tool — avoid burst of requests on every alt-tab back to the window
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
}

function RealtimeInvalidationBridge() {
  useRealtimeInvalidation();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <RealtimeProvider>
              <RealtimeInvalidationBridge />
              <NavigationProvider>
                {children}
                <NavigationIndicator />
                <Sonner />
              </NavigationProvider>
            </RealtimeProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
