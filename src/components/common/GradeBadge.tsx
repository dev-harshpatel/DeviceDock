import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  GRADE_BADGE_LABELS,
  type Grade,
} from "@/lib/constants/grades";

interface GradeBadgeProps {
  grade: Grade;
  className?: string;
}

const gradeStyles: Record<Grade, string> = {
  "Brand New Sealed":
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  "Brand New Open Box":
    "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700",
  A: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  B: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  C: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  D: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

export const GradeBadge = memo(function GradeBadge({
  grade,
  className,
}: GradeBadgeProps) {
  const label = GRADE_BADGE_LABELS[grade];
  const style = gradeStyles[grade] ?? gradeStyles.A;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md text-xs font-semibold border px-2 py-0.5 min-w-[2.5rem]",
        style,
        className
      )}
    >
      {label}
    </span>
  );
});
