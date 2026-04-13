"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ManualSaleStep = 1 | 2 | 3 | 4;

export const MANUAL_SALE_STEPS = [
  { n: 1, label: "Select Items" },
  { n: 2, label: "Assign IMEIs" },
  { n: 3, label: "Selling Price" },
  { n: 4, label: "Customer & Payment" },
] as const;

interface ManualSaleStepIndicatorProps {
  step: ManualSaleStep;
}

export const ManualSaleStepIndicator = ({ step }: ManualSaleStepIndicatorProps) => {
  return (
    <div className="mt-3 flex items-center overflow-x-auto px-0.5 py-1.5">
      {MANUAL_SALE_STEPS.map((s, i) => {
        const isDone = step > s.n;
        const isActive = step === s.n;
        return (
          <div key={s.n} className="flex flex-1 flex-shrink-0 items-center">
            <div
              className={cn(
                "flex items-center gap-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : isDone
                    ? "text-muted-foreground"
                    : "text-muted-foreground/40",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground ring-primary/30"
                    : isDone
                      ? "bg-muted text-muted-foreground ring-border"
                      : "bg-transparent text-muted-foreground/40 ring-border/50",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className="hidden whitespace-nowrap sm:inline">{s.label}</span>
            </div>
            {i < MANUAL_SALE_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-px min-w-[2rem] flex-1 transition-colors",
                  step > s.n ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
