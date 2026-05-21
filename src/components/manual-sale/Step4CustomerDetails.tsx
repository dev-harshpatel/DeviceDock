"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants";
import type {
  IdentifierScanGroup,
  ScannedIdentifierUnit,
  SelectedItem,
} from "@/types/inventory-identifiers";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EMT: "E-Transfer (EMT)",
  WIRE: "Wire Transfer",
  CHQ: "Cheque",
  CASH: "Cash",
  CREDIT: "Credit Card",
  DEBIT: "Debit Card",
  "NET 15": "Net 15",
  "NET 30": "Net 30",
  "NET 60": "Net 60",
};

export interface Step4CustomerDetailsProps {
  // Customer fields
  customerName: string;
  onCustomerNameChange: (v: string) => void;
  customerEmail: string;
  onCustomerEmailChange: (v: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (v: string) => void;
  billingAddress: string;
  onBillingAddressChange: (v: string) => void;
  shippingAddress: string;
  onShippingAddressChange: (v: string) => void;
  sameAsShipping: boolean;
  onSameAsShippingChange: (v: boolean) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  // Payment
  paymentMethod: string;
  onPaymentMethodChange: (v: string) => void;
  hstPercent: string;
  onHstPercentChange: (v: string) => void;
  // Order summary
  selectedItemsList: SelectedItem[];
  identifierGroups: IdentifierScanGroup[];
  subtotal: number;
  hstAmount: number;
  total: number;
  getEffectivePrice: (item: SelectedItem["item"]) => number;
  getEffectiveUnitPriceIdent: (unit: ScannedIdentifierUnit, group: IdentifierScanGroup) => number;
  // Submit
  isEdit: boolean;
  isSubmitting: boolean;
  submitFailed: boolean;
  onSubmit: () => void;
  onBack: () => void;
  onStartOver: () => void;
}

export function Step4CustomerDetails({
  customerName,
  onCustomerNameChange,
  customerEmail,
  onCustomerEmailChange,
  customerPhone,
  onCustomerPhoneChange,
  billingAddress,
  onBillingAddressChange,
  shippingAddress,
  onShippingAddressChange,
  sameAsShipping,
  onSameAsShippingChange,
  notes,
  onNotesChange,
  paymentMethod,
  onPaymentMethodChange,
  hstPercent,
  onHstPercentChange,
  selectedItemsList,
  identifierGroups,
  subtotal,
  hstAmount,
  total,
  getEffectivePrice,
  getEffectiveUnitPriceIdent,
  isEdit,
  isSubmitting,
  submitFailed,
  onSubmit,
  onBack,
  onStartOver,
}: Step4CustomerDetailsProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Two-column split on desktop */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] md:divide-x md:divide-border min-h-full">
          {/* Left column: customer form */}
          <div className="px-5 py-4 space-y-4">
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
                    onChange={(e) => onCustomerNameChange(e.target.value)}
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
                      onChange={(e) => onCustomerEmailChange(e.target.value)}
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
                        onChange={(e) => onCustomerPhoneChange(e.target.value)}
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
                    onBillingAddressChange(e.target.value);
                    if (!e.target.value.trim()) onSameAsShippingChange(false);
                  }}
                  className="min-h-[60px] resize-none"
                />
              </div>
              {billingAddress.trim() && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sameAsShipping"
                    checked={sameAsShipping}
                    onCheckedChange={(checked) => onSameAsShippingChange(!!checked)}
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
                    onChange={(e) => onShippingAddressChange(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                )}
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
                onChange={(e) => onNotesChange(e.target.value)}
                className="min-h-[70px] resize-none"
              />
            </div>
          </div>

          {/* Right column: payment + order summary */}
          <div className="px-5 py-4 space-y-4 bg-muted/20">
            {/* Payment */}
            <div className="space-y-1.5">
              <Label>
                Payment Method <span className="text-destructive">*</span>
              </Label>
              <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
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
                  onChange={(e) => onHstPercentChange(e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>

            {/* Order summary */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
              <div className="space-y-1.5">
                {selectedItemsList.map(({ item, quantity }) => (
                  <div key={`browse-${item.id}`} className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground truncate">
                      {item.deviceName} {item.storage} × {quantity}
                    </span>
                    <span className="font-medium text-foreground tabular-nums flex-shrink-0">
                      {formatPrice(getEffectivePrice(item) * quantity)}
                    </span>
                  </div>
                ))}
                {identifierGroups.map((group) => {
                  const groupTotal = group.units.reduce(
                    (sum, u) => sum + getEffectiveUnitPriceIdent(u, group),
                    0,
                  );
                  return (
                    <div key={group.inventoryId} className="flex justify-between text-sm gap-2">
                      <span className="text-muted-foreground truncate">
                        {group.item.deviceName} {group.item.storage} × {group.units.length}{" "}
                        (scanned)
                      </span>
                      <span className="font-medium text-foreground tabular-nums flex-shrink-0">
                        {formatPrice(groupTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border pt-2.5 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>HST ({parseFloat(hstPercent) || 0}%)</span>
                  <span className="tabular-nums">{formatPrice(hstAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-1 border-t border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground tabular-nums">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-4 bg-card">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack} className="gap-2" disabled={isSubmitting}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {submitFailed && (
            <Button variant="ghost" onClick={onStartOver} className="text-muted-foreground">
              Start over
            </Button>
          )}
        </div>
        <Button
          type="button"
          disabled={!customerName.trim() || !paymentMethod || isSubmitting}
          onClick={onSubmit}
          className={cn("gap-2 min-w-[148px] justify-center")}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              <span>Recording sale…</span>
            </>
          ) : isEdit ? (
            "Save changes"
          ) : (
            "Record Sale"
          )}
        </Button>
      </div>
    </div>
  );
}
