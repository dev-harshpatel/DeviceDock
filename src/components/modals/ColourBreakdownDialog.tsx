"use client";

import { useState, useEffect } from "react";
import { Loader2, Palette, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  /** Previously used colours for this device type shown as a proper dropdown */
  suggestedColors?: string[];
  /** Optional info note shown below the description */
  note?: string;
  /** Called with the validated colour rows when the user confirms */
  onConfirm: (colors: ColourRow[]) => void | Promise<void>;
  /** Shows skeleton while existing color rows are being fetched */
  isLoadingInitialColors?: boolean;
  /** While true, the confirm button shows a spinner and is disabled */
  isSaving?: boolean;
  /** Label for the confirm button (defaults to "Save Colours") */
  confirmLabel?: string;
}

const CUSTOM_SENTINEL = "__custom__";

export function ColourBreakdownDialog({
  open,
  onOpenChange,
  productName,
  totalQuantity,
  initialColors,
  suggestedColors = [],
  note,
  onConfirm,
  isLoadingInitialColors = false,
  isSaving = false,
  confirmLabel = "Save Colours",
}: ColourBreakdownDialogProps) {
  const [colorRows, setColorRows] = useState<ColourRow[]>([{ color: "", quantity: "" }]);
  // Tracks which row indices are in free-text "custom" mode
  const [customIndices, setCustomIndices] = useState<Set<number>>(new Set());

  const hasSuggestions = suggestedColors.length > 0;

  // Reset rows from latest initial colors whenever dialog opens
  // or when async prefill data arrives after open.
  useEffect(() => {
    if (!open) return;
    if (isLoadingInitialColors) return;
    if (initialColors && initialColors.length > 0) {
      setColorRows(initialColors.map((r) => ({ ...r })));
      // Pre-populate rows: rows whose color isn't in suggestions → custom mode
      if (hasSuggestions) {
        const customs = new Set(
          initialColors
            .map((r, i) => (suggestedColors.includes(r.color) ? -1 : i))
            .filter((i) => i >= 0),
        );
        setCustomIndices(customs);
      } else {
        setCustomIndices(new Set());
      }
    } else {
      setColorRows([{ color: "", quantity: "" }]);
      setCustomIndices(new Set());
    }
    // suggestedColors is stable array reference per render — safe to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialColors, open, isLoadingInitialColors]);

  const handleAddRow = () => {
    setColorRows((prev) => [...prev, { color: "", quantity: "" }]);
    // New rows start in dropdown mode (not custom)
  };

  const handleRemoveRow = (i: number) => {
    setColorRows((prev) => prev.filter((_, idx) => idx !== i));
    setCustomIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
  };

  const handleColorChange = (i: number, value: string) => {
    setColorRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, color: value } : row)));
  };

  const handleQtyChange = (i: number, value: string) => {
    setColorRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, quantity: value } : row)));
  };

  const handleSelectChange = (i: number, value: string) => {
    if (value === CUSTOM_SENTINEL) {
      setCustomIndices((prev) => new Set([...prev, i]));
      handleColorChange(i, "");
    } else {
      handleColorChange(i, value);
    }
  };

  const handleSwitchToDropdown = (i: number) => {
    setCustomIndices((prev) => {
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
    handleColorChange(i, "");
  };

  const colorTotal = colorRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const remaining = totalQuantity - colorTotal;
  const isValid =
    !isLoadingInitialColors &&
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
          {isLoadingInitialColors ? (
            <div className="space-y-2">
              <div className="h-12 rounded-md bg-muted/50 animate-pulse" />
              <div className="h-12 rounded-md bg-muted/50 animate-pulse" />
              <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
              <div className="h-[54px] rounded-lg bg-muted/40 animate-pulse mt-1" />
              <p className="text-xs text-muted-foreground px-1">
                Loading previously assigned colours...
              </p>
            </div>
          ) : (
            <>
              {colorRows.map((row, i) => {
                const qtyInvalid =
                  row.color.trim() !== "" && row.quantity !== "" && Number(row.quantity) <= 0;
                const isCustom = customIndices.has(i);

                return (
                  <div key={i} className="flex gap-2 items-center">
                    {hasSuggestions && !isCustom ? (
                      <Select
                        value={row.color || ""}
                        onValueChange={(v) => handleSelectChange(i, v)}
                      >
                        <SelectTrigger className="flex-1 h-10">
                          <SelectValue placeholder="Select colour…" />
                        </SelectTrigger>
                        <SelectContent>
                          {suggestedColors.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                          <SelectItem
                            value={CUSTOM_SENTINEL}
                            className="text-muted-foreground italic"
                          >
                            + Type custom colour…
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex flex-1 gap-1.5">
                        <Input
                          placeholder="e.g. Blue"
                          value={row.color}
                          onChange={(e) => handleColorChange(i, e.target.value)}
                          className="flex-1"
                          autoFocus={isCustom && row.color === ""}
                        />
                        {hasSuggestions && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSwitchToDropdown(i)}
                            className="shrink-0 text-xs text-muted-foreground px-2 h-10"
                            title="Pick from list"
                          >
                            List
                          </Button>
                        )}
                      </div>
                    )}

                    <Input
                      type="number"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => handleQtyChange(i, e.target.value)}
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
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isSaving || isLoadingInitialColors}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isLoadingInitialColors ? (
              "Loading colours..."
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
