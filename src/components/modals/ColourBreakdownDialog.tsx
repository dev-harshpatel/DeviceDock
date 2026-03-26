"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Palette } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export interface ColourRow {
  color: string;
  quantity: string;
}

interface ColourBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in the header, e.g. "iPhone 14 Pro" */
  productName: string;
  /** The total quantity all colour rows must sum to */
  totalQuantity: number;
  /** Colour rows to pre-populate when the dialog opens */
  initialColors?: ColourRow[];
  /** Optional info note shown below the description */
  note?: string;
  /** Called with the validated colour rows when the user confirms */
  onConfirm: (colors: ColourRow[]) => void | Promise<void>;
  /** While true, the confirm button shows a spinner and is disabled */
  isSaving?: boolean;
  /** Label for the confirm button (defaults to "Save Colours") */
  confirmLabel?: string;
}

export function ColourBreakdownDialog({
  open,
  onOpenChange,
  productName,
  totalQuantity,
  initialColors,
  note,
  onConfirm,
  isSaving = false,
  confirmLabel = "Save Colours",
}: ColourBreakdownDialogProps) {
  const [colorRows, setColorRows] = useState<ColourRow[]>([{ color: "", quantity: "" }]);

  // Reset rows to initialColors every time the dialog opens
  useEffect(() => {
    if (!open) return;
    if (initialColors && initialColors.length > 0) {
      setColorRows(initialColors.map((r) => ({ ...r })));
    } else {
      setColorRows([{ color: "", quantity: "" }]);
    }
  }, [open]); // intentionally not including initialColors to avoid mid-session resets
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleAddRow = () => setColorRows((prev) => [...prev, { color: "", quantity: "" }]);

  const handleRemoveRow = (i: number) => setColorRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleChange = (i: number, field: keyof ColourRow, value: string) => {
    setColorRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };

  const colorTotal = colorRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const remaining = totalQuantity - colorTotal;
  const isValid =
    colorRows.length > 0 &&
    colorRows.every(
      (r) =>
        r.color.trim() !== "" && Number.isInteger(Number(r.quantity)) && Number(r.quantity) > 0,
    ) &&
    colorTotal === totalQuantity &&
    new Set(colorRows.map((r) => r.color.trim().toLowerCase())).size === colorRows.length;

  const handleConfirm = async () => {
    if (!isValid) return;
    await onConfirm(colorRows);
  };

  return (
    <Dialog open={open} onOpenChange={isSaving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            Colour Breakdown
          </DialogTitle>
          <DialogDescription>
            Specify the colour breakdown for{" "}
            <strong className="text-foreground">{productName}</strong>. Quantities must add up to
            exactly <strong className="text-foreground">{totalQuantity}</strong>.
          </DialogDescription>
          {note && (
            <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded-md px-3 py-2">
              {note}
            </p>
          )}
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1 space-y-2 pt-1 pb-2">
          {/* Colour rows */}
          {colorRows.map((row, i) => {
            const qtyInvalid =
              row.color.trim() !== "" && row.quantity !== "" && Number(row.quantity) <= 0;
            return (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Colour (e.g. Black)"
                  value={row.color}
                  onChange={(e) => handleChange(i, "color", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  value={row.quantity}
                  onChange={(e) => handleChange(i, "quantity", e.target.value)}
                  min="1"
                  className={cn(
                    "w-24",
                    qtyInvalid && "border-destructive focus-visible:ring-destructive",
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveRow(i)}
                  disabled={colorRows.length === 1}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Colour
          </Button>

          {/* Running total */}
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3 mt-1",
              colorTotal === totalQuantity
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <span className="text-sm text-muted-foreground">Assigned / Required</span>
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                colorTotal === totalQuantity
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-400",
              )}
            >
              {colorTotal} / {totalQuantity}
              {remaining !== 0 && (
                <span className="ml-1 font-normal text-xs">
                  ({remaining > 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over`})
                </span>
              )}
            </span>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
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
