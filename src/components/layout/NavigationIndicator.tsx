"use client";

import { Loader } from "@/components/common/Loader";
import { useNavigation } from "@/contexts/NavigationContext";
import { usePathname } from "next/navigation";

const NO_GLOBAL_LOADER_PATHS = [
  "/admin/dashboard",
  "/admin/reports",
  "/admin/hst",
];

export function NavigationIndicator() {
  const { isNavigating } = useNavigation();
  const pathname = usePathname();

  const shouldHideGlobalLoader = NO_GLOBAL_LOADER_PATHS.some((path) =>
    pathname?.startsWith(path)
  );

  if (!isNavigating || shouldHideGlobalLoader) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/40 backdrop-blur-[1px]"
      aria-live="polite"
      aria-label="Navigation in progress"
      role="status"
    >
      <Loader size="lg" text="Loading..." className="py-0" />
    </div>
  );
}
