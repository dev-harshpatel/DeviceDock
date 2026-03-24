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
