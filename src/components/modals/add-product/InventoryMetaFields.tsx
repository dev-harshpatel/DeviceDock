"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ProductForm } from "@/hooks/use-add-product";
import type { InventoryItem } from "@/data/inventory";

interface InventoryMetaFieldsProps {
  form: ProductForm;
  handleField: (field: keyof ProductForm, value: string) => void;
  hasIdentifier: boolean;
  imeiList: string[];
  serialList: string[];
  totalIdentifierCount: number;
  enteredQuantity: number;
  identifierCountMatchesQuantity: boolean;
  hasDuplicateIdentifiers: boolean;
  warnBothImeiAndSerialForSingleQuantity: boolean;
  selectedExisting: InventoryItem | null;
}

export function InventoryMetaFields({
  form,
  handleField,
  hasIdentifier,
  imeiList,
  serialList,
  totalIdentifierCount,
  enteredQuantity,
  identifierCountMatchesQuantity,
  hasDuplicateIdentifiers,
  warnBothImeiAndSerialForSingleQuantity,
  selectedExisting,
}: InventoryMetaFieldsProps) {
  return (
    <>
      {/* IMEI */}
      <div className="space-y-1.5">
        <Label htmlFor="ap-imei" className="text-sm font-medium text-amber-700 dark:text-amber-500">
          IMEI (Scanner focus)
        </Label>
        <Input
          id="ap-imei"
          placeholder="Scan or type IMEI"
          value={form.imei}
          onChange={(e) => handleField("imei", e.target.value)}
          autoFocus
        />
      </div>

      {/* Serial Number */}
      <div className="space-y-1.5">
        <Label htmlFor="ap-serial" className="text-sm font-medium">
          Serial Number
        </Label>
        <Input
          id="ap-serial"
          placeholder="Scan or type Serial"
          value={form.serialNumber}
          onChange={(e) => handleField("serialNumber", e.target.value)}
        />
      </div>

      {hasIdentifier && (
        <div className="col-span-2 rounded-md border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            IMEI: {imeiList.length} | Serial: {serialList.length} | Total: {totalIdentifierCount}
            {enteredQuantity > 0 ? (
              <> / Required: {enteredQuantity}</>
            ) : (
              <span className="text-muted-foreground/80"> — enter quantity below to match</span>
            )}
          </p>
          {enteredQuantity > 0 && !identifierCountMatchesQuantity && (
            <p className="text-xs text-destructive mt-1">
              Total IMEI + Serial must exactly match Quantity.
            </p>
          )}
          {hasDuplicateIdentifiers && (
            <p className="text-xs text-destructive mt-1">
              Duplicate IMEI/Serial values are not allowed.
            </p>
          )}
          {warnBothImeiAndSerialForSingleQuantity && (
            <p
              className="text-xs text-amber-700 dark:text-amber-400 mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5"
              role="status"
            >
              For a single unit, use <span className="font-medium">either</span> IMEI{" "}
              <span className="font-medium">or</span> serial—not both. Values in both fields count
              as two separate units.
            </p>
          )}
        </div>
      )}

      {/* Quantity */}
      <div className="space-y-1.5">
        <Label htmlFor="ap-qty" className="text-sm font-medium">
          {selectedExisting ? "Units to Add" : "Quantity"}
        </Label>
        <Input
          id="ap-qty"
          type="number"
          placeholder="0"
          value={form.quantity}
          onChange={(e) => handleField("quantity", e.target.value)}
          min="1"
        />
      </div>
    </>
  );
}
