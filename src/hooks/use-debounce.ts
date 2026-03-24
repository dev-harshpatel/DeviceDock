import { useState, useEffect } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

export function useDebounce<T>(
  value: T,
  delay: number = SEARCH_DEBOUNCE_MS
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
