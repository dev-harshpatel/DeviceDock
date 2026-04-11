"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Paintbrush } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface IdentifierEntry {
  /** Display label — the raw IMEI or serial value */
  label: string;
  imei: string | null;
  serialNumber: string | null;
}

export interface ColorBudget {
  color: string;
  quantity: number;
}

export interface ImeiColorMapping {
  label: string;
  imei: string | null;
  serialNumber: string | null;
  color: string;
}

interface ImeiColorMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  /** The identifiers to assign colors to */
  identifiers: IdentifierEntry[];
  /** Available colors with their budgets from the colour breakdown */
  colorBudgets: ColorBudget[];
  /** Called with the final mapping when the user confirms */
  onConfirm: (mappings: ImeiColorMapping[]) => void | Promise<void>;
  isSaving?: boolean;
  confirmLabel?: string;
}

const UNASSIGNED = "__unassigned__";

export function ImeiColorMappingDialog({
  open,
  onOpenChange,
  productName,
  identifiers,
  colorBudgets,
  onConfirm,
  isSaving = false,
  confirmLabel = "Confirm & Save",
}: ImeiColorMappingDialogProps) {
  // color assignment per identifier index
  const [assignments, setAssignments] = useState<string[]>([]);

  // Reset assignments when dialog opens or identifiers change
  useEffect(() => {
    if (!open) return;
    // Auto-assign sequentially as a starting point for manual override
    const initial: string[] = [];
    let colorIdx = 0;
    let remaining = colorBudgets[0]?.quantity ?? 0;

    for (let i = 0; i < identifiers.length; i++) {
      if (colorIdx < colorBudgets.length && remaining > 0) {
        initial.push(colorBudgets[colorIdx].color);
        remaining--;
        if (remaining === 0) {
          colorIdx++;
          remaining = colorBudgets[colorIdx]?.quantity ?? 0;
        }
      } else {
        initial.push(UNASSIGNED);
      }
    }
    setAssignments(initial);
  }, [open, identifiers, colorBudgets]);

  const handleAssign = (index: number, color: string) => {
    setAssignments((prev) => {
      const next = [...prev];
      next[index] = color;
      return next;
    });
  };

  // Count how many of each color are currently assigned
  const assignedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const color of assignments) {
      if (color && color !== UNASSIGNED) {
        counts[color] = (counts[color] ?? 0) + 1;
      }
    }
    return counts;
  }, [assignments]);

  // Check if all are assigned and counts match budgets exactly
  const allAssigned =
    assignments.length === identifiers.length && assignments.every((c) => c && c !== UNASSIGNED);

  const countsMatch = colorBudgets.every((b) => (assignedCounts[b.color] ?? 0) === b.quantity);

  const isValid = allAssigned && countsMatch;

  const handleConfirm = async () => {
    if (!isValid) return;
    const mappings: ImeiColorMapping[] = identifiers.map((ident, i) => ({
      label: ident.label,
      imei: ident.imei,
      serialNumber: ident.serialNumber,
      color: assignments[i],
    }));
    await onConfirm(mappings);
  };

  // Helper: is a color over-budget if we were to assign it at a given index?
  const isColorAvailable = (color: string, currentIndex: number): boolean => {
    const budget = colorBudgets.find((b) => b.color === color)?.quantity ?? 0;
    const currentlyAssigned = assignedCounts[color] ?? 0;
    // If this index already has this color, it's a no-op
    if (assignments[currentIndex] === color) return true;
    return currentlyAssigned < budget;
  };

  return (
    <Dialog open={open} onOpenChange={isSaving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Paintbrush className="h-4 w-4 text-primary" />
            </div>
            Assign Colors to Units
          </DialogTitle>
          <DialogDescription>
            Map each IMEI/serial to its color for{" "}
            <strong className="text-foreground">{productName}</strong>. Colors are pre-assigned
            sequentially — adjust as needed.
          </DialogDescription>
        </DialogHeader>

        {/* Budget summary */}
        <div className="shrink-0 flex flex-wrap gap-2 px-1">
          {colorBudgets.map((b) => {
            const assigned = assignedCounts[b.color] ?? 0;
            const isFull = assigned === b.quantity;
            const isOver = assigned > b.quantity;
            return (
              <div
                key={b.color}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md border font-medium tabular-nums",
                  isOver && "border-destructive/50 bg-destructive/10 text-destructive",
                  isFull &&
                    !isOver &&
                    "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
                  !isFull &&
                    !isOver &&
                    "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
                )}
              >
                {b.color}: {assigned}/{b.quantity}
              </div>
            );
          })}
        </div>

        {/* Scrollable list of identifiers */}
        <div className="overflow-y-auto flex-1 min-h-0 px-1 space-y-1.5 pt-1 pb-2">
          {identifiers.map((ident, i) => {
            const currentColor = assignments[i] ?? UNASSIGNED;
            const isUnassigned = currentColor === UNASSIGNED;

            return (
              <div
                key={ident.label}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2",
                  isUnassigned ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card",
                )}
              >
                {/* Index + identifier */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground mr-1.5">#{i + 1}</span>
                  <span className="text-sm font-mono font-medium truncate">{ident.label}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">
                    {ident.imei ? "IMEI" : "Serial"}
                  </span>
                </div>

                {/* Color dropdown */}
                <Select value={currentColor} onValueChange={(v) => handleAssign(i, v)}>
                  <SelectTrigger className="w-[140px] h-8 text-sm">
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {colorBudgets.map((b) => {
                      const available = isColorAvailable(b.color, i);
                      return (
                        <SelectItem key={b.color} value={b.color} disabled={!available}>
                          <span className={cn(!available && "text-muted-foreground")}>
                            {b.color}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Back
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
