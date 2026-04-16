"use client";

import { useState, useCallback, useEffect } from "react";
import { Trash2, Loader2, Palette, Plus } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/utils/toast-helpers";
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
import { Input } from "@/components/ui/input";
import { GradeBadge } from "@/components/common/GradeBadge";
import { Badge } from "@/components/ui/badge";
import type { OrderItem } from "@/types/order";
import { supabase } from "@/lib/supabase/client";

interface ColorRow {
  color: string;
  quantity: string;
}

interface AvailableColor {
  color: string;
  stock: number;
}

interface ItemColorState {
  inventoryId: string;
  orderedQuantity: number;
  deviceName: string;
  storage: string;
  grade: string;
  availableColors: AvailableColor[];
  colorRows: ColorRow[];
}

interface OrderColorFulfillmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderItems: OrderItem[];
  onSuccess: () => Promise<void>;
}

export function OrderColorFulfillmentDialog({
  open,
  onOpenChange,
  orderId,
  orderItems,
  onSuccess,
}: OrderColorFulfillmentDialogProps) {
  const [itemStates, setItemStates] = useState<ItemColorState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buildInitialState = useCallback((): ItemColorState[] => {
    return orderItems
      .filter((oi) => oi?.item?.id && oi?.quantity)
      .map((oi) => ({
        inventoryId: oi.item.id,
        orderedQuantity: oi.quantity,
        deviceName: oi.item.deviceName || "Unknown Device",
        storage: oi.item.storage || "",
        grade: oi.item.grade || "",
        availableColors: [],
        colorRows: [{ color: "", quantity: "" }],
      }));
  }, [orderItems]);

  // When dialog opens: build initial state then fetch available colours for each item
  useEffect(() => {
    if (!open) return;

    const initial = buildInitialState();
    setItemStates(initial);

    if (initial.length === 0) return;

    setIsLoading(true);
    Promise.all(
      initial.map(async (item) => {
        try {
          const { data } = await (supabase as any)
            .from("inventory_colors")
            .select("color, quantity")
            .eq("inventory_id", item.inventoryId)
            .order("color");
          const colors: AvailableColor[] = (data ?? []).map(
            (c: { color: string; quantity: number }) => ({
              color: c.color,
              stock: c.quantity,
            }),
          );
          return { inventoryId: item.inventoryId, colors };
        } catch {
          return { inventoryId: item.inventoryId, colors: [] as AvailableColor[] };
        }
      }),
    ).then((results) => {
      setItemStates((prev) =>
        prev.map((item) => {
          const found = results.find((r) => r.inventoryId === item.inventoryId);
          if (!found) return item;
          const colorRows: ColorRow[] = [{ color: "", quantity: "" }];
          return { ...item, availableColors: found.colors, colorRows };
        }),
      );
      setIsLoading(false);
    });
  }, [open, buildInitialState]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const handleAddColorRow = (itemIndex: number) => {
    setItemStates((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? { ...item, colorRows: [...item.colorRows, { color: "", quantity: "" }] }
          : item,
      ),
    );
  };

  const handleRemoveColorRow = (itemIndex: number, rowIndex: number) => {
    setItemStates((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? { ...item, colorRows: item.colorRows.filter((_, ri) => ri !== rowIndex) }
          : item,
      ),
    );
  };

  const handleColorChange = (itemIndex: number, rowIndex: number, value: string) => {
    setItemStates((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              colorRows: item.colorRows.map((row, ri) =>
                ri === rowIndex ? { ...row, color: value } : row,
              ),
            }
          : item,
      ),
    );
  };

  const handleQuantityChange = (itemIndex: number, rowIndex: number, value: string) => {
    setItemStates((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              colorRows: item.colorRows.map((row, ri) =>
                ri === rowIndex ? { ...row, quantity: value } : row,
              ),
            }
          : item,
      ),
    );
  };

  const getItemTotal = (item: ItemColorState) =>
    item.colorRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const isItemValid = (item: ItemColorState) => {
    const total = getItemTotal(item);
    if (total !== item.orderedQuantity) return false;
    if (item.colorRows.length === 0) return false;
    const colors = item.colorRows.map((r) => r.color.trim().toLowerCase());
    if (new Set(colors).size !== colors.length) return false;
    // Every row must have a colour selected AND a quantity of at least 1
    return item.colorRows.every(
      (r) =>
        r.color.trim() !== "" && Number.isInteger(Number(r.quantity)) && Number(r.quantity) > 0,
    );
  };

  const allValid = !isLoading && itemStates.length > 0 && itemStates.every(isItemValid);

  const handleConfirm = async () => {
    if (!allValid) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/fulfill-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          color_assignments: itemStates.map((item) => ({
            inventory_id: item.inventoryId,
            ordered_quantity: item.orderedQuantity,
            colors: item.colorRows.map((r) => ({
              color: r.color.trim(),
              quantity: Number(r.quantity),
            })),
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fulfil order");
      }

      await onSuccess();
      onOpenChange(false);
    } catch (err) {
      toastError(err, "Failed to fulfil order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            Colour Assignment
          </DialogTitle>
          <DialogDescription>
            Select the colours being fulfilled for each item. Quantities must match each item&apos;s
            ordered amount exactly.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 pt-1 pb-2">
              {itemStates.map((item, itemIndex) => {
                const total = getItemTotal(item);
                const remaining = item.orderedQuantity - total;
                const valid = isItemValid(item);
                // colours already assigned in other rows (for deduplication in dropdown)
                const usedColors = item.colorRows
                  .map((r) => r.color.trim().toLowerCase())
                  .filter(Boolean);

                // Build a quick lookup: color name → available stock
                const stockByColor = Object.fromEntries(
                  item.availableColors.map((c) => [c.color.toLowerCase(), c.stock]),
                );

                return (
                  <div
                    key={`${item.inventoryId}-${itemIndex}`}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    {/* Item header */}
                    <div className="px-4 py-3 bg-muted/40 border-b border-border">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.deviceName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {item.grade && <GradeBadge grade={item.grade as any} />}
                            {item.storage && (
                              <Badge variant="outline" className="text-xs">
                                {item.storage}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Ordered:{" "}
                              <strong className="text-foreground">{item.orderedQuantity}</strong>
                            </span>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "text-sm font-bold tabular-nums px-2 py-1 rounded",
                            valid
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {total}/{item.orderedQuantity}
                        </div>
                      </div>
                    </div>

                    {/* Colour rows */}
                    <div className="p-3 space-y-2">
                      {item.availableColors.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 pb-1">
                          No colours recorded for this item — add them manually.
                        </p>
                      )}

                      {item.colorRows.map((row, rowIndex) => {
                        const rowStock = row.color
                          ? (stockByColor[row.color.toLowerCase()] ?? null)
                          : null;
                        return (
                          <div key={rowIndex} className="space-y-1">
                            <div className="flex gap-2 items-center">
                              {item.availableColors.length > 0 ? (
                                /* Dropdown from saved colours */
                                <Select
                                  value={row.color}
                                  onValueChange={(val) =>
                                    handleColorChange(itemIndex, rowIndex, val)
                                  }
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select colour…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {item.availableColors.map((c) => {
                                      const isUsedElsewhere =
                                        usedColors.includes(c.color.toLowerCase()) &&
                                        row.color.toLowerCase() !== c.color.toLowerCase();
                                      return (
                                        <SelectItem
                                          key={c.color}
                                          value={c.color}
                                          disabled={isUsedElsewhere}
                                        >
                                          <span className="flex items-center justify-between gap-3 w-full">
                                            <span>{c.color}</span>
                                            <span
                                              className={cn(
                                                "text-xs tabular-nums",
                                                c.stock === 0
                                                  ? "text-destructive"
                                                  : c.stock <= 5
                                                    ? "text-amber-500 dark:text-amber-400"
                                                    : "text-muted-foreground",
                                              )}
                                            >
                                              {c.stock} left
                                            </span>
                                          </span>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              ) : (
                                /* Fallback free-text when no colours are on record */
                                <Input
                                  placeholder="Colour (e.g. Black)"
                                  value={row.color}
                                  onChange={(e) =>
                                    handleColorChange(itemIndex, rowIndex, e.target.value)
                                  }
                                  className="flex-1"
                                />
                              )}

                              <Input
                                type="number"
                                placeholder="Qty"
                                value={row.quantity}
                                onChange={(e) =>
                                  handleQuantityChange(itemIndex, rowIndex, e.target.value)
                                }
                                min="1"
                                className={cn(
                                  "w-24",
                                  row.color && row.quantity !== "" && Number(row.quantity) < 1
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : "",
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveColorRow(itemIndex, rowIndex)}
                                disabled={item.colorRows.length === 1}
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            {/* Stock hint */}
                            {rowStock !== null && (
                              <p
                                className={cn(
                                  "text-xs pl-1",
                                  rowStock === 0
                                    ? "text-destructive"
                                    : rowStock <= 5
                                      ? "text-amber-500 dark:text-amber-400"
                                      : "text-muted-foreground",
                                )}
                              >
                                {rowStock === 0 ? "Out of stock" : `${rowStock} in stock`}
                              </p>
                            )}
                          </div>
                        );
                      })}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddColorRow(itemIndex)}
                        className="w-full mt-1"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add Colour
                      </Button>

                      {remaining !== 0 && (
                        <p
                          className={cn(
                            "text-xs text-center mt-1",
                            remaining > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-destructive",
                          )}
                        >
                          {remaining > 0
                            ? `${remaining} unit${remaining !== 1 ? "s" : ""} still unassigned`
                            : `${Math.abs(remaining)} unit${Math.abs(remaining) !== 1 ? "s" : ""} over the ordered quantity`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!allValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fulfilling…
              </>
            ) : (
              "Confirm & Fulfil Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
