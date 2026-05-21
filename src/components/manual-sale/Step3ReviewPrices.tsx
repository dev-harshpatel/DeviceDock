"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClickableGradeBadge } from "@/components/common/ClickableGradeBadge";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import type {
  IdentifierScanGroup,
  ScannedIdentifierUnit,
  SelectedItem,
} from "@/types/inventory-identifiers";

export interface Step3ReviewPricesProps {
  selectedItemsList: SelectedItem[];
  identifierGroups: IdentifierScanGroup[];
  sellingPrices: Record<string, string>;
  sellingPricesIdentUnit: Record<string, string>;
  subtotal: number;
  getEffectiveUnitPriceIdent: (unit: ScannedIdentifierUnit, group: IdentifierScanGroup) => number;
  onSellingPriceChange: (itemId: string, value: string) => void;
  onSellingPriceBlur: (itemId: string) => void;
  onSellingPriceChangeIdentUnit: (inventoryIdentifierId: string, value: string) => void;
  onSellingPriceBlurIdentUnit: (inventoryIdentifierId: string, listPrice: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3ReviewPrices({
  selectedItemsList,
  identifierGroups,
  sellingPrices,
  sellingPricesIdentUnit,
  subtotal,
  getEffectiveUnitPriceIdent,
  onSellingPriceChange,
  onSellingPriceBlur,
  onSellingPriceChangeIdentUnit,
  onSellingPriceBlurIdentUnit,
  onNext,
  onBack,
}: Step3ReviewPricesProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 px-5 py-3 gap-3">
      <p className="text-sm text-muted-foreground flex-shrink-0">
        Set the selling price for each line. Prices below the list price are allowed but flagged.
      </p>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 -mx-1 px-1">
        {selectedItemsList.map(({ item, quantity }) => {
          const listPrice = item.sellingPrice ?? item.pricePerUnit;
          const priceStr = sellingPrices[item.id] ?? String(listPrice);
          const parsedPrice = parseFloat(priceStr);
          const lineTotal = isNaN(parsedPrice) ? 0 : parsedPrice * quantity;
          const isBelowMin = !isNaN(parsedPrice) && parsedPrice < listPrice;

          return (
            <div key={item.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              {/* Item header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">{item.deviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.brand} · {item.storage} · Qty {quantity}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-right flex-shrink-0">
                  List price:{" "}
                  <span className="font-semibold text-foreground">{formatPrice(listPrice)}</span>
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
                    min={0}
                    step="0.01"
                    value={priceStr}
                    onChange={(e) => onSellingPriceChange(item.id, e.target.value)}
                    onBlur={() => onSellingPriceBlur(item.id)}
                    className={cn(
                      "pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                      isBelowMin && "border-warning focus-visible:ring-warning",
                    )}
                  />
                </div>
                {isBelowMin && (
                  <p className="text-xs text-warning">
                    Warning: selling below list price of {formatPrice(listPrice)}.
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Line total:{" "}
                <span className="font-semibold text-foreground">{formatPrice(lineTotal)}</span>
              </p>
            </div>
          );
        })}

        {identifierGroups.map((group) => {
          const listPrice = group.item.sellingPrice ?? group.item.pricePerUnit;
          const lineTotal = group.units.reduce(
            (sum, u) => sum + getEffectiveUnitPriceIdent(u, group),
            0,
          );

          return (
            <div
              key={group.inventoryId}
              className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
            >
              {/* Group header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{group.item.deviceName}</p>
                    <ClickableGradeBadge
                      grade={group.item.grade}
                      inventoryId={group.item.id}
                      deviceName={group.item.deviceName}
                    />
                    <span className="text-xs font-medium text-foreground">
                      {group.units.length} unit{group.units.length !== 1 ? "s" : ""} scanned
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {group.item.brand} · {group.item.storage} · List price:{" "}
                    <span className="font-medium text-foreground">{formatPrice(listPrice)}</span>
                  </p>
                </div>
              </div>

              {/* Per-unit price inputs */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Price per unit (CAD)</Label>
                {group.units.map((unit) => {
                  const unitPriceStr =
                    sellingPricesIdentUnit[unit.inventoryIdentifierId] ?? String(listPrice);
                  const parsedUnitPrice = parseFloat(unitPriceStr);
                  const isUnitBelowMin = !isNaN(parsedUnitPrice) && parsedUnitPrice < listPrice;

                  return (
                    <div key={unit.id} className="flex items-center gap-2">
                      <span
                        className="text-xs text-muted-foreground font-mono flex-shrink-0 w-36 truncate"
                        title={unit.displayLabel}
                      >
                        {unit.displayLabel}
                      </span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none pointer-events-none">
                          $
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={unitPriceStr}
                          onChange={(e) =>
                            onSellingPriceChangeIdentUnit(
                              unit.inventoryIdentifierId,
                              e.target.value,
                            )
                          }
                          onBlur={() =>
                            onSellingPriceBlurIdentUnit(unit.inventoryIdentifierId, listPrice)
                          }
                          className={cn(
                            "pl-7 h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                            isUnitBelowMin && "border-warning focus-visible:ring-warning",
                          )}
                        />
                      </div>
                      {isUnitBelowMin && (
                        <span className="text-xs text-warning flex-shrink-0">Below list</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Line total:{" "}
                <span className="font-semibold text-foreground">{formatPrice(lineTotal)}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-4 bg-card">
        <p className="text-sm font-medium text-foreground">Subtotal {formatPrice(subtotal)}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button onClick={onNext}>Next: Customer Details →</Button>
        </div>
      </div>
    </div>
  );
}
