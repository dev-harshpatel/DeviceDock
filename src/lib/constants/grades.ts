/**
 * Central grade definitions for inventory.
 * Used across filters, forms, badges, and grade guide.
 */

export const GRADES = ["Brand New Sealed", "Brand New Open Box", "A", "B", "C", "D"] as const;

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

/** Inline badge styles per grade — for compact grade badges in dropdowns and comboboxes */
export const GRADE_STYLES: Record<string, string> = {
  "Brand New Sealed": "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  "Brand New Open Box": "bg-teal-500/10 text-teal-700 border-teal-500/30",
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  D: "bg-red-500/10 text-red-700 border-red-500/30",
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
  if (lower === "brand new open box" || lower === "bnob") return "Brand New Open Box";

  return null;
}
