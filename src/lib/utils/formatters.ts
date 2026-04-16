import { ONTARIO_TIMEZONE } from "../constants";

export function formatDateInOntario(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ONTARIO_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return formatter.format(dateObj);
}

export function formatDateTimeInOntario(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ONTARIO_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return formatter.format(dateObj);
}

/**
 * Format price as currency string
 * @param price - Price value to format
 * @returns Formatted price string (e.g., "$1,234.56 CAD")
 */
export function formatPrice(price: number): string {
  return `$${price.toLocaleString()} CAD`;
}

/**
 * Return a human-readable relative time string (e.g. "5m ago", "2h ago", "3d ago").
 */
export function timeAgo(date: Date | string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
