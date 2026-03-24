/**
 * Central grade definitions for inventory.
 * Used across filters, forms, badges, and grade guide.
 */

export const GRADES = [
  "Brand New Sealed",
  "Brand New Open Box",
  "A",
  "B",
  "C",
  "D",
] as const;

export type Grade = (typeof GRADES)[number];

export const GRADE_LABELS: Record<Grade, string> = {
  "Brand New Sealed": "Brand New Sealed",
  "Brand New Open Box": "Brand New Open Box",
  A: "Grade A",
  B: "Grade B",
  C: "Grade C",
  D: "Grade D",
};

/** Short display for badges/tight spaces */
export const GRADE_BADGE_LABELS: Record<Grade, string> = {
  "Brand New Sealed": "BNS",
  "Brand New Open Box": "BNOB",
  A: "A",
  B: "B",
  C: "C",
  D: "D",
};

export const VALID_GRADES_SET = new Set<string>(GRADES);

export function isValidGrade(value: string): value is Grade {
  return VALID_GRADES_SET.has(value);
}

/** Normalize grade from Excel/input (case-insensitive) */
export function normalizeGrade(value: string): Grade | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (upper === "A" || upper === "B" || upper === "C" || upper === "D") {
    return upper as Grade;
  }

  const lower = trimmed.toLowerCase();
  if (lower === "brand new sealed" || lower === "bns") return "Brand New Sealed";
  if (lower === "brand new open box" || lower === "bnob")
    return "Brand New Open Box";

  return null;
}
