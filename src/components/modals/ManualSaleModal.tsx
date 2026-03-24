"use client";

import { useState, useMemo } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useAuth } from "@/lib/auth/context";
import { InventoryItem } from "@/data/inventory";
import { OrderItem } from "@/types/order";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PAYMENT_METHODS } from "@/lib/constants";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EMT: "E-Transfer (EMT)",
  WIRE: "Wire Transfer",
  CHQ: "Cheque",
  CASH: "Cash",
  "NET 15": "Net 15",
  "NET 30": "Net 30",
  "NET 60": "Net 60",
};

interface SelectedItem {
  item: InventoryItem;
  quantity: number;
}

interface ManualSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualSaleModal({ open, onOpenChange }: ManualSaleModalProps) {
  const { inventory, decreaseQuantity } = useInventory();
  const { createManualOrder } = useOrders();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<
    Record<string, SelectedItem>
  >({});

  // Step 2 fields
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

  const availableItems = useMemo(
    () =>
      inventory.filter(
        (item) =>
          item.isActive !== false &&
          item.quantity > 0 &&
          (searchQuery === "" ||
            item.deviceName
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.storage.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [inventory, searchQuery]
  );

  const selectedItemsList = Object.values(selectedItems);
  const subtotal = selectedItemsList.reduce(
    (sum, { item, quantity }) =>
      sum + (item.sellingPrice ?? item.pricePerUnit) * quantity,
    0
  );
  const hstRate = Math.max(0, parseFloat(hstPercent) || 0) / 100;
  const hstAmount = subtotal * hstRate;
  const total = subtotal + hstAmount;

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
      const newQty = Math.max(
        1,
        Math.min(current.item.quantity, current.quantity + delta)
      );
      return { ...prev, [itemId]: { ...current, quantity: newQty } };
    });
  };

  const handleQuantityInput = (itemId: string, value: string, maxQty: number) => {
    const parsed = parseInt(value, 10);
    setSelectedItems((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      // Allow empty string while typing; clamp on blur via onBlur
      if (value === "" || isNaN(parsed)) return { ...prev, [itemId]: { ...current, quantity: 1 } };
      const clamped = Math.max(1, Math.min(maxQty, parsed));
      return { ...prev, [itemId]: { ...current, quantity: clamped } };
    });
  };

  const handleClose = () => {
    setStep(1);
    setSearchQuery("");
    setSelectedItems({});
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

  const handleSubmit = async () => {
    if (
      !user?.id ||
      selectedItemsList.length === 0 ||
      !customerName.trim() ||
      !paymentMethod
    )
      return;

    setIsSubmitting(true);
    try {
      const orderItems: OrderItem[] = selectedItemsList.map(
        ({ item, quantity }) => ({ item, quantity })
      );

      const finalShippingAddress = sameAsShipping
        ? billingAddress.trim()
        : shippingAddress.trim();

      const order = await createManualOrder(
        user.id,
        orderItems,
        {
          name: customerName.trim(),
          email: customerEmail.trim() || undefined,
          phone: customerPhone.trim()
            ? `+1${customerPhone.trim()}`
            : undefined,
        },
        paymentMethod,
        Math.max(0, parseFloat(hstPercent) || 0),
        billingAddress.trim() || undefined,
        finalShippingAddress || undefined,
        notes.trim() || undefined
      );

      // Decrement inventory since the sale is already approved
      await Promise.all(
        orderItems.map(({ item, quantity }) =>
          decreaseQuantity(item.id, quantity)
        )
      );

      toast.success(
        `Sale recorded — Order #${order.id.slice(-8).toUpperCase()}`
      );
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
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Record Manual Sale
          </DialogTitle>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mt-3">
            <div
              className={cn(
                "flex items-center gap-2 text-xs font-medium",
                step === 1 ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                  step === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > 1 ? <Check className="h-3 w-3" /> : "1"}
              </div>
              Select Items
            </div>
            <div className="flex-1 h-px bg-border" />
            <div
              className={cn(
                "flex items-center gap-2 text-xs font-medium",
                step === 2 ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                  step === 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                2
              </div>
              Customer & Payment
            </div>
          </div>
        </DialogHeader>

        {/* ── STEP 1: Select Items ─────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4">
            {/* Search */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by device, brand, or storage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Items list */}
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
                          : "border-border bg-card hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div
                          className={cn(
                            "mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground"
                          )}
                        >
                          {isSelected && (
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          )}
                        </div>

                        {/* Item info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-foreground">
                              {item.deviceName}
                            </p>
                            <GradeBadge grade={item.grade} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.brand} • {item.storage}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} in stock
                          </p>
                        </div>

                        {/* Price */}
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-sm text-foreground">
                            {formatPrice(item.sellingPrice ?? item.pricePerUnit)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            per unit
                          </p>
                        </div>
                      </div>

                      {/* Quantity selector — shown when selected */}
                      {isSelected && (
                        <div
                          className="mt-3 flex items-center gap-3 pt-3 border-t border-primary/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs text-muted-foreground">
                            Qty:
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                handleQuantityChange(item.id, -1)
                              }
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
                                if (isNaN(parsed) || parsed < 1) handleQuantityInput(item.id, "1", item.quantity);
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
                              (item.sellingPrice ?? item.pricePerUnit) *
                                selected.quantity
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-border pt-4 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {selectedItemsList.length > 0 ? (
                  <span className="font-medium text-foreground">
                    {selectedItemsList.length} item(s) — subtotal{" "}
                    {formatPrice(subtotal)}
                  </span>
                ) : (
                  "No items selected"
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  disabled={selectedItemsList.length === 0}
                  onClick={() => setStep(2)}
                >
                  Next: Customer Details →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Customer & Payment ───────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4">
            <div className="flex-1 overflow-y-auto min-h-0 space-y-5 px-1 -mx-1">
              {/* Customer info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="customerName">
                      Customer Name{" "}
                      <span className="text-destructive">*</span>
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
                        Email{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
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
                        Phone{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
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
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </h3>

                {/* Billing Address */}
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

                {/* Same-as-billing toggle — shown only when billing has content */}
                {billingAddress.trim() && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sameAsShipping"
                      checked={sameAsShipping}
                      onCheckedChange={(checked) =>
                        setSameAsShipping(!!checked)
                      }
                    />
                    <Label
                      htmlFor="sameAsShipping"
                      className="text-sm font-normal text-muted-foreground cursor-pointer"
                    >
                      Use same address for shipping
                    </Label>
                  </div>
                )}

                {/* Shipping Address */}
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

              {/* Payment method */}
              <div className="space-y-1.5">
                <Label>
                  Payment Method{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                >
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
                  HST / Tax Rate{" "}
                  <span className="text-xs text-muted-foreground">(%)</span>
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
                  Notes{" "}
                  <span className="text-xs text-muted-foreground">
                    (optional)
                  </span>
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
                <h3 className="text-sm font-semibold text-foreground">
                  Order Summary
                </h3>
                <div className="space-y-1.5">
                  {selectedItemsList.map(({ item, quantity }) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {item.deviceName} {item.storage} × {quantity}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPrice(
                          (item.sellingPrice ?? item.pricePerUnit) * quantity
                        )}
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
                    <span>
                      HST ({parseFloat(hstPercent) || 0}%)
                    </span>
                    <span>{formatPrice(hstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">{formatPrice(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-border pt-4 flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                disabled={
                  !customerName.trim() || !paymentMethod || isSubmitting
                }
                onClick={handleSubmit}
                className="gap-2"
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Record Sale
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
