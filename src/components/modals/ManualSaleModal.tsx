"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useAuth } from "@/lib/auth/context";
import { InventoryItem } from "@/data/inventory";
import { OrderItem } from "@/types/order";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GradeBadge } from "@/components/common/GradeBadge";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Minus, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PAYMENT_METHODS } from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EMT: "E-Transfer (EMT)",
  WIRE: "Wire Transfer",
  CHQ: "Cheque",
  CASH: "Cash",
  "NET 15": "Net 15",
  "NET 30": "Net 30",
  "NET 60": "Net 60",
};

type Step = 1 | 2 | 3 | 4;

interface SelectedItem {
  item: InventoryItem;
  quantity: number;
}

interface ColorRow {
  color: string;
  quantity: string;
}

interface ManualSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { n: 1, label: "Select Items" },
  { n: 2, label: "Selling Price" },
  { n: 3, label: "Colour Assignment" },
  { n: 4, label: "Customer & Payment" },
] as const;

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const isDone = step > s.n;
        const isActive = step === s.n;
        return (
          <div key={s.n} className="flex items-center gap-1 flex-shrink-0">
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                isActive
                  ? "text-primary"
                  : isDone
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50",
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted/40 text-muted-foreground/50",
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : s.n}
              </div>
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-6 h-px flex-shrink-0",
                  step > s.n ? "bg-muted-foreground/40" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ManualSaleModal({ open, onOpenChange }: ManualSaleModalProps) {
  const { inventory, decreaseQuantity } = useInventory();
  const { createManualOrder } = useOrders();
  const { user } = useAuth();

  // Step routing
  const [step, setStep] = useState<Step>(1);

  // ── Step 1: Select Items ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItem>>({});

  // ── Step 2: Selling Price ─────────────────────────────────────────────────
  // Record<itemId, price string> — string so input is editable; validated on advance
  const [sellingPrices, setSellingPrices] = useState<Record<string, string>>({});

  // ── Step 3: Colour Assignment ─────────────────────────────────────────────
  const [colorAssignments, setColorAssignments] = useState<Record<string, ColorRow[]>>({});
  const [availableColors, setAvailableColors] = useState<Record<string, string[]>>({});
  const [loadingColors, setLoadingColors] = useState(false);

  // ── Step 4: Customer & Payment ────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [sameAsShipping, setSameAsShipping] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [hstPercent, setHstPercent] = useState("13");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const availableItems = useMemo(
    () =>
      inventory.filter(
        (item) =>
          item.isActive !== false &&
          item.quantity > 0 &&
          (searchQuery === "" ||
            item.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.storage.toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [inventory, searchQuery],
  );

  const selectedItemsList = useMemo(() => Object.values(selectedItems), [selectedItems]);

  const getEffectivePrice = useCallback(
    (item: InventoryItem): number => {
      const custom = parseFloat(sellingPrices[item.id] ?? "");
      return isNaN(custom) ? (item.sellingPrice ?? item.pricePerUnit) : custom;
    },
    [sellingPrices],
  );

  const subtotal = useMemo(
    () =>
      selectedItemsList.reduce(
        (sum, { item, quantity }) => sum + getEffectivePrice(item) * quantity,
        0,
      ),
    [selectedItemsList, getEffectivePrice],
  );

  const hstRate = Math.max(0, parseFloat(hstPercent) || 0) / 100;
  const hstAmount = subtotal * hstRate;
  const total = subtotal + hstAmount;

  // ── Step 1 handlers ───────────────────────────────────────────────────────
  const handleToggleItem = (item: InventoryItem) => {
    setSelectedItems((prev) => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return { ...prev, [item.id]: { item, quantity: 1 } };
    });
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const newQty = Math.max(1, Math.min(current.item.quantity, current.quantity + delta));
      return { ...prev, [itemId]: { ...current, quantity: newQty } };
    });
  };

  const handleQuantityInput = (itemId: string, value: string, maxQty: number) => {
    const parsed = parseInt(value, 10);
    setSelectedItems((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      if (value === "" || isNaN(parsed)) return { ...prev, [itemId]: { ...current, quantity: 1 } };
      const clamped = Math.max(1, Math.min(maxQty, parsed));
      return { ...prev, [itemId]: { ...current, quantity: clamped } };
    });
  };

  // ── Step 2 handlers ───────────────────────────────────────────────────────
  const handleGoToStep2 = () => {
    // Pre-fill selling prices from item's current selling price
    const prices: Record<string, string> = {};
    selectedItemsList.forEach(({ item }) => {
      prices[item.id] = String(item.sellingPrice ?? item.pricePerUnit);
    });
    setSellingPrices(prices);
    setStep(2);
  };

  const handleSellingPriceChange = (itemId: string, value: string) => {
    setSellingPrices((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSellingPriceBlur = (itemId: string) => {
    const item = selectedItems[itemId]?.item;
    if (!item) return;
    const listPrice = item.sellingPrice ?? item.pricePerUnit;
    const entered = parseFloat(sellingPrices[itemId] ?? "");
    if (isNaN(entered) || entered < listPrice) {
      setSellingPrices((prev) => ({ ...prev, [itemId]: String(listPrice) }));
    }
  };

  const handleGoToStep3 = () => {
    // Validate selling prices — none can be below list price
    for (const { item } of selectedItemsList) {
      const listPrice = item.sellingPrice ?? item.pricePerUnit;
      const entered = parseFloat(sellingPrices[item.id] ?? "");
      if (isNaN(entered) || entered < listPrice) {
        toast.error(
          `Selling price for ${item.deviceName} cannot be below $${listPrice.toFixed(2)}.`,
        );
        return;
      }
    }
    // Init colour assignments with one empty row per item
    const assignments: Record<string, ColorRow[]> = {};
    selectedItemsList.forEach(({ item }) => {
      assignments[item.id] = [{ color: "", quantity: "" }];
    });
    setColorAssignments(assignments);
    setStep(3);
  };

  // ── Step 3 handlers ───────────────────────────────────────────────────────
  const fetchAvailableColors = useCallback(async () => {
    if (selectedItemsList.length === 0) return;
    setLoadingColors(true);
    const colors: Record<string, string[]> = {};
    try {
      await Promise.all(
        selectedItemsList.map(async ({ item }) => {
          const { data, error } = await (supabase as any)
            .from("inventory_colors")
            .select("color, quantity")
            .eq("inventory_id", item.id)
            .gt("quantity", 0)
            .order("color");
          colors[item.id] = !error && data ? data.map((r: any) => r.color as string) : [];
        }),
      );
      setAvailableColors(colors);
    } catch {
      // leave colors empty — user can still proceed (skip tracking)
    } finally {
      setLoadingColors(false);
    }
  }, [selectedItemsList]);

  // Fetch colors when step 3 becomes active
  useEffect(() => {
    if (step === 3) {
      fetchAvailableColors();
    }
  }, [step, fetchAvailableColors]);

  const handleColorRowChange = (
    itemId: string,
    rowIdx: number,
    field: keyof ColorRow,
    value: string,
  ) => {
    setColorAssignments((prev) => {
      const rows = [...(prev[itemId] ?? [])];
      rows[rowIdx] = { ...rows[rowIdx], [field]: value };
      return { ...prev, [itemId]: rows };
    });
  };

  const handleAddColorRow = (itemId: string) => {
    setColorAssignments((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] ?? []), { color: "", quantity: "" }],
    }));
  };

  const handleRemoveColorRow = (itemId: string, rowIdx: number) => {
    setColorAssignments((prev) => {
      const rows = (prev[itemId] ?? []).filter((_, i) => i !== rowIdx);
      return { ...prev, [itemId]: rows.length > 0 ? rows : [{ color: "", quantity: "" }] };
    });
  };

  const handleGoToStep4 = () => {
    for (const { item, quantity: soldQty } of selectedItemsList) {
      const rows = colorAssignments[item.id] ?? [];
      const filledRows = rows.filter((r) => r.color || r.quantity !== "");
      if (filledRows.length === 0) continue; // empty = skip tracking for this item

      // Partial rows: both fields required
      const partialRow = filledRows.find((r) => !r.color || r.quantity === "");
      if (partialRow) {
        toast.error(`Each colour row for ${item.deviceName} needs both a colour and a quantity.`);
        return;
      }

      const total = filledRows.reduce((sum, r) => sum + (parseInt(r.quantity, 10) || 0), 0);
      if (total !== soldQty) {
        toast.error(
          `Colour quantities for ${item.deviceName} must total ${soldQty} (currently ${total}).`,
        );
        return;
      }
    }
    setStep(4);
  };

  // ── Reset / Close ─────────────────────────────────────────────────────────
  const handleClose = () => {
    setStep(1);
    setSearchQuery("");
    setSelectedItems({});
    setSellingPrices({});
    setColorAssignments({});
    setAvailableColors({});
    setLoadingColors(false);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setBillingAddress("");
    setShippingAddress("");
    setSameAsShipping(false);
    setPaymentMethod("");
    setHstPercent("13");
    setNotes("");
    onOpenChange(false);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user?.id || selectedItemsList.length === 0 || !customerName.trim() || !paymentMethod)
      return;

    setIsSubmitting(true);
    try {
      // Build order items using effective (possibly overridden) selling prices
      const orderItems: OrderItem[] = selectedItemsList.map(({ item, quantity }) => ({
        item: { ...item, sellingPrice: getEffectivePrice(item) },
        quantity,
      }));

      const finalShippingAddress = sameAsShipping ? billingAddress.trim() : shippingAddress.trim();

      const order = await createManualOrder(
        user.id,
        orderItems,
        {
          name: customerName.trim(),
          email: customerEmail.trim() || undefined,
          phone: customerPhone.trim() ? `+1${customerPhone.trim()}` : undefined,
        },
        paymentMethod,
        Math.max(0, parseFloat(hstPercent) || 0),
        billingAddress.trim() || undefined,
        finalShippingAddress || undefined,
        notes.trim() || undefined,
      );

      // Decrement inventory quantities
      await Promise.all(
        orderItems.map(({ item, quantity }) => decreaseQuantity(item.id, quantity)),
      );

      // Save colour assignments if any were provided
      const assignmentEntries = Object.entries(colorAssignments).filter(([, rows]) =>
        rows.some((r) => r.color && r.quantity !== ""),
      );

      if (assignmentEntries.length > 0) {
        await Promise.all(
          assignmentEntries.map(async ([itemId, rows]) => {
            const filledRows = rows.filter(
              (r) => r.color && r.quantity !== "" && parseInt(r.quantity, 10) > 0,
            );
            if (filledRows.length === 0) return;

            // Decrement inventory_colors quantities
            await Promise.all(
              filledRows.map(async (r) => {
                const qty = parseInt(r.quantity, 10);
                const { data: colorRow } = await (supabase as any)
                  .from("inventory_colors")
                  .select("quantity")
                  .eq("inventory_id", itemId)
                  .eq("color", r.color)
                  .maybeSingle();
                if (colorRow) {
                  await (supabase as any)
                    .from("inventory_colors")
                    .update({
                      quantity: Math.max(0, colorRow.quantity - qty),
                      updated_at: new Date().toISOString(),
                    })
                    .eq("inventory_id", itemId)
                    .eq("color", r.color);
                }
              }),
            );

            // Record order_color_assignments
            await (supabase as any).from("order_color_assignments").insert(
              filledRows.map((r) => ({
                order_id: order.id,
                inventory_id: itemId,
                color: r.color,
                quantity: parseInt(r.quantity, 10),
              })),
            );
          }),
        );
      }

      toast.success(`Sale recorded — Order #${order.id.slice(-8).toUpperCase()}`);
      handleClose();
    } catch {
      toast.error("Failed to record sale. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Record Manual Sale
          </DialogTitle>
          <StepIndicator step={step} />
        </DialogHeader>

        {/* ── STEP 1: Select Items ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4">
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by device, brand, or storage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 -mx-1 px-1">
              {availableItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  No items available in inventory.
                </p>
              ) : (
                availableItems.map((item) => {
                  const isSelected = !!selectedItems[item.id];
                  const selected = selectedItems[item.id];
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItem(item)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors select-none",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-primary border-primary" : "border-muted-foreground",
                          )}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-foreground">{item.deviceName}</p>
                            <GradeBadge grade={item.grade} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.brand} • {item.storage}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.quantity} in stock</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-sm text-foreground">
                            {formatPrice(item.sellingPrice ?? item.pricePerUnit)}
                          </p>
                          <p className="text-xs text-muted-foreground">per unit</p>
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          className="mt-3 flex items-center gap-3 pt-3 border-t border-primary/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs text-muted-foreground">Qty:</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleQuantityChange(item.id, -1)}
                              disabled={selected.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={selected.quantity}
                              onChange={(e) =>
                                handleQuantityInput(item.id, e.target.value, item.quantity)
                              }
                              onBlur={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                if (isNaN(parsed) || parsed < 1)
                                  handleQuantityInput(item.id, "1", item.quantity);
                              }}
                              className="h-7 w-16 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleQuantityChange(item.id, 1)}
                              disabled={selected.quantity >= item.quantity}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-xs text-muted-foreground ml-auto">
                            ={" "}
                            {formatPrice(
                              (item.sellingPrice ?? item.pricePerUnit) * selected.quantity,
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex-shrink-0 border-t border-border pt-4 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {selectedItemsList.length > 0 ? (
                  <span className="font-medium text-foreground">
                    {selectedItemsList.length} item(s) — subtotal {formatPrice(subtotal)}
                  </span>
                ) : (
                  "No items selected"
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button disabled={selectedItemsList.length === 0} onClick={handleGoToStep2}>
                  Next: Selling Price →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Selling Price ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4">
            <p className="text-sm text-muted-foreground flex-shrink-0">
              Set the selling price for each line. You cannot go below the inventory list price.
            </p>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 -mx-1 px-1">
              {selectedItemsList.map(({ item, quantity }) => {
                const listPrice = item.sellingPrice ?? item.pricePerUnit;
                const priceStr = sellingPrices[item.id] ?? String(listPrice);
                const parsedPrice = parseFloat(priceStr);
                const lineTotal = isNaN(parsedPrice) ? 0 : parsedPrice * quantity;
                const isBelowMin = !isNaN(parsedPrice) && parsedPrice < listPrice;

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-4 space-y-3"
                  >
                    {/* Item header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{item.deviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.brand} · {item.storage} · Qty {quantity}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground text-right flex-shrink-0">
                        List price (minimum):{" "}
                        <span className="font-semibold text-destructive">
                          {formatPrice(listPrice)}
                        </span>
                      </p>
                    </div>

                    {/* Price input */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Selling price per unit (CAD)</Label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-sm text-muted-foreground select-none pointer-events-none">
                          $
                        </span>
                        <Input
                          type="number"
                          min={listPrice}
                          step="0.01"
                          value={priceStr}
                          onChange={(e) => handleSellingPriceChange(item.id, e.target.value)}
                          onBlur={() => handleSellingPriceBlur(item.id)}
                          className={cn(
                            "pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                            isBelowMin && "border-destructive focus-visible:ring-destructive",
                          )}
                        />
                      </div>
                      {isBelowMin && (
                        <p className="text-xs text-destructive">
                          Cannot be below the list price of {formatPrice(listPrice)}.
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Line total:{" "}
                      <span className="font-semibold text-foreground">
                        {formatPrice(lineTotal)}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex-shrink-0 border-t border-border pt-4 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-foreground">
                Subtotal {formatPrice(subtotal)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleGoToStep3}>Next: Colour Assignment →</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Colour Assignment ─────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4">
            <p className="text-sm text-muted-foreground flex-shrink-0">
              Assign the colours for each item sold. Quantities must match exactly, or leave all
              rows empty to skip colour tracking for that item.
            </p>

            {loadingColors ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0 space-y-3 -mx-1 px-1">
                {selectedItemsList.map(({ item, quantity: soldQty }) => {
                  const colors = availableColors[item.id] ?? [];
                  const rows = colorAssignments[item.id] ?? [];
                  const hasColors = colors.length > 0;

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-card p-4 space-y-3"
                    >
                      {/* Item header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{item.deviceName}</p>
                        <GradeBadge grade={item.grade} />
                        <span className="text-xs text-muted-foreground">{item.storage}</span>
                        <span className="text-xs text-muted-foreground">
                          Qty sold: <span className="font-semibold text-foreground">{soldQty}</span>
                        </span>
                      </div>

                      {!hasColors ? (
                        <p className="text-xs text-muted-foreground italic">
                          No colours configured for this item — colour tracking will be skipped.
                        </p>
                      ) : (
                        <>
                          {/* Colour rows */}
                          <div className="space-y-2">
                            {rows.map((row, rowIdx) => (
                              <div key={rowIdx} className="flex items-center gap-2">
                                <Select
                                  value={row.color}
                                  onValueChange={(v) =>
                                    handleColorRowChange(item.id, rowIdx, "color", v)
                                  }
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select colour..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {colors.map((c) => (
                                      <SelectItem key={c} value={c}>
                                        {c}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min={1}
                                  placeholder="Qty"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    handleColorRowChange(
                                      item.id,
                                      rowIdx,
                                      "quantity",
                                      e.target.value,
                                    )
                                  }
                                  className="w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0"
                                  onClick={() => handleRemoveColorRow(item.id, rowIdx)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          {/* Add colour button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-muted-foreground"
                            onClick={() => handleAddColorRow(item.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Colour
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-shrink-0 border-t border-border pt-4 flex items-center justify-between gap-4">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleGoToStep4} disabled={loadingColors}>
                Next: Customer Details →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Customer & Payment ────────────────────────────────── */}
        {step === 4 && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4">
            <div className="flex-1 overflow-y-auto min-h-0 space-y-5 px-1 -mx-1">
              {/* Customer info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Customer Information</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="customerName">
                      Customer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="customerName"
                      placeholder="e.g. John Doe or ABC Electronics"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="customerEmail">
                        Email <span className="text-xs text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        placeholder="email@example.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="customerPhone">
                        Phone <span className="text-xs text-muted-foreground">(optional)</span>
                      </Label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-sm text-muted-foreground select-none pointer-events-none">
                          +1
                        </span>
                        <Input
                          id="customerPhone"
                          type="tel"
                          placeholder="(416) 555-0000"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Address{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </h3>
                <div className="space-y-1.5">
                  <Label htmlFor="billingAddress">Billing Address</Label>
                  <Textarea
                    id="billingAddress"
                    placeholder="123 Main St, City, Province, Postal Code"
                    value={billingAddress}
                    onChange={(e) => {
                      setBillingAddress(e.target.value);
                      if (!e.target.value.trim()) setSameAsShipping(false);
                    }}
                    className="min-h-[60px] resize-none"
                  />
                </div>
                {billingAddress.trim() && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sameAsShipping"
                      checked={sameAsShipping}
                      onCheckedChange={(checked) => setSameAsShipping(!!checked)}
                    />
                    <Label
                      htmlFor="sameAsShipping"
                      className="text-sm font-normal text-muted-foreground cursor-pointer"
                    >
                      Use same address for shipping
                    </Label>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="shippingAddress">Shipping Address</Label>
                  {sameAsShipping ? (
                    <div className="px-3 py-2 min-h-[60px] rounded-md border border-border bg-muted/40 text-sm text-muted-foreground whitespace-pre-wrap">
                      {billingAddress}
                    </div>
                  ) : (
                    <Textarea
                      id="shippingAddress"
                      placeholder="123 Main St, City, Province, Postal Code"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="min-h-[60px] resize-none"
                    />
                  )}
                </div>
              </div>

              {/* Payment */}
              <div className="space-y-1.5">
                <Label>
                  Payment Method <span className="text-destructive">*</span>
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {PAYMENT_METHOD_LABELS[value] ?? value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* HST */}
              <div className="space-y-1.5">
                <Label htmlFor="hstPercent">
                  HST / Tax Rate <span className="text-xs text-muted-foreground">(%)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="hstPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g. 13"
                    value={hstPercent}
                    onChange={(e) => setHstPercent(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="saleNotes">
                  Notes <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="saleNotes"
                  placeholder="Any additional details about this sale..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[70px] resize-none"
                />
              </div>

              {/* Order summary */}
              <div className="bg-muted/50 rounded-lg border border-border p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
                <div className="space-y-1.5">
                  {selectedItemsList.map(({ item, quantity }) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.deviceName} {item.storage} × {quantity}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPrice(getEffectivePrice(item) * quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-2 space-y-1.5">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>HST ({parseFloat(hstPercent) || 0}%)</span>
                    <span>{formatPrice(hstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">{formatPrice(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-border pt-4 flex items-center justify-between gap-4">
              <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                disabled={!customerName.trim() || !paymentMethod || isSubmitting}
                onClick={handleSubmit}
                className="gap-2"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Record Sale
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
