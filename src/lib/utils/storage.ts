/**
 * Normalise a user-supplied storage string.
 * - "128"   → "128GB"
 * - "128gb" → "128GB"
 * - "256GB" → "256GB"  (already correct, uppercased)
 * - "1TB"   → "1TB"    (non-GB units kept as-is, uppercased)
 * - ""      → ""
 */
export function normalizeStorage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Already has a unit suffix (GB / TB / MB) — normalise casing and strip spaces
  if (/^[\d.]+\s*(GB|TB|MB)$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, "").toUpperCase();
  }
  // Pure number — append GB
  return `${trimmed}GB`;
}

/**
 * Strip the "GB" suffix for display inside the storage input.
 * Non-GB units (TB, MB) are returned as-is so the user can see and edit them.
 */
export function storageInputDisplay(stored: string): string {
  return stored.replace(/GB$/i, "");
}
