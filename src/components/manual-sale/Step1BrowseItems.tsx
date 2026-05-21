"use client";

import { ArrowLeft, Check, Loader2, Minus, Plus, ScanLine, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClickableGradeBadge } from "@/components/common/ClickableGradeBadge";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import type { InventoryItem } from "@/data/inventory";
import type { IdentifierScanGroup, SelectedItem } from "@/types/inventory-identifiers";

export interface Step1BrowseItemsProps {
  // IMEI scanner panel
  identifierQuery: string;
  onIdentifierQueryChange: (v: string) => void;
  identifierGroups: IdentifierScanGroup[];
  identifierLookupLoading: boolean;
  onIdentifierLookup: () => void;
  onRemoveIdentifierUnit: (inventoryId: string, unitId: string) => void;
  // Browse panel
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  availableItems: InventoryItem[];
  selectedItems: Record<string, SelectedItem>;
  selectedItemsList: SelectedItem[];
  scannedUnitsByInventoryId: Record<string, number>;
  scannedUnitCount: number;
  subtotal: number;
  getEffectiveStock: (item: InventoryItem) => number;
  getBrowseMaxQty: (item: InventoryItem) => number;
  onToggleItem: (item: InventoryItem) => void;
  onQuantityChange: (itemId: string, delta: number) => void;
  onQuantityInput: (itemId: string, value: string, maxQty: number) => void;
  // Navigation
  onClose: () => void;
  onNext: () => void;
}

export function Step1BrowseItems({
  identifierQuery,
  onIdentifierQueryChange,
  identifierGroups,
  identifierLookupLoading,
  onIdentifierLookup,
  onRemoveIdentifierUnit,
  searchQuery,
  onSearchQueryChange,
  availableItems,
  selectedItems,
  selectedItemsList,
  scannedUnitsByInventoryId,
  scannedUnitCount,
  subtotal,
  getEffectiveStock,
  getBrowseMaxQty,
  onToggleItem,
  onQuantityChange,
  onQuantityInput,
  onClose,
  onNext,
}: Step1BrowseItemsProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Two-column split on desktop */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row md:divide-x md:divide-border overflow-hidden">
        {/* Left panel: IMEI / serial scanner */}
        <div className="md:w-[38%] flex flex-col overflow-hidden border-b border-border md:border-b-0 flex-shrink-0">
          {/* Sticky: header + input */}
          <div className="flex-shrink-0 px-5 pt-4 pb-3 space-y-3 border-b border-border/60 bg-card">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ScanLine className="h-4 w-4 text-primary" aria-hidden />
                Sell by IMEI or serial
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Exact match only. Must be in stock. Paste comma-separated IMEIs to add multiple at
                once.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="IMEI / serial — or paste multiple comma-separated"
                value={identifierQuery}
                onChange={(e) => onIdentifierQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onIdentifierLookup();
                  }
                }}
                aria-label="IMEI or serial number"
                className="flex-1 h-8 text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1.5 px-3"
                disabled={identifierLookupLoading}
                onClick={onIdentifierLookup}
              >
                {identifierLookupLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ScanLine className="h-3.5 w-3.5" />
                )}
                Find
              </Button>
            </div>
          </div>

          {/* Scrollable: scanned units list */}
          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3">
            {identifierGroups.length > 0 ? (
              <ul className="space-y-2">
                {identifierGroups.map((group) => (
                  <li
                    key={group.inventoryId}
                    className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">
                        {group.item.deviceName}
                      </p>
                      <ClickableGradeBadge
                        grade={group.item.grade}
                        inventoryId={group.item.id}
                        deviceName={group.item.deviceName}
                      />
                      <span className="text-xs font-semibold text-primary tabular-nums ml-auto">
                        Qty {group.units.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">
                      {group.item.brand} · {group.item.storage}
                    </p>
                    <ul className="space-y-1 border-t border-border/60 pt-2">
                      {group.units.map((unit) => (
                        <li
                          key={unit.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="font-mono text-foreground truncate">
                              {unit.displayLabel}
                            </span>
                            {unit.color && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">
                                {unit.color}
                              </span>
                            )}
                            {unit.damageNote && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-medium border border-destructive/20 shrink-0 max-w-[160px] truncate"
                                title={unit.damageNote}
                              >
                                ⚠ {unit.damageNote}
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemoveIdentifierUnit(group.inventoryId, unit.id)}
                            aria-label={`Remove scanned unit ${unit.displayLabel}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-muted-foreground/50 text-center py-8">
                  No units scanned yet.
                  <br />
                  Enter an IMEI or serial above.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Browse inventory */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sticky: search input */}
          <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border/60 bg-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by device, brand, or storage..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          {/* Scrollable: inventory list */}
          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-2">
            {availableItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No items available in inventory.
              </p>
            ) : (
              availableItems.map((item) => {
                const effStock = getEffectiveStock(item);
                const scannedForSku = scannedUnitsByInventoryId[item.id] ?? 0;
                const browseMax = getBrowseMaxQty(item);
                const isSelected = !!selectedItems[item.id];
                const selected = selectedItems[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => onToggleItem(item)}
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
                          <ClickableGradeBadge
                            grade={item.grade}
                            inventoryId={item.id}
                            deviceName={item.deviceName}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.brand} • {item.storage}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {scannedForSku > 0
                            ? `${browseMax} available for browse (${scannedForSku} scanned, ${effStock} in stock)`
                            : `${effStock} in stock`}
                        </p>
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
                            onClick={() => onQuantityChange(item.id, -1)}
                            disabled={selected.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={browseMax}
                            value={selected.quantity}
                            onChange={(e) => onQuantityInput(item.id, e.target.value, browseMax)}
                            onBlur={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              if (isNaN(parsed) || parsed < 1)
                                onQuantityInput(item.id, "1", browseMax);
                            }}
                            className="h-7 w-16 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onQuantityChange(item.id, 1)}
                            disabled={selected.quantity >= browseMax}
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
        </div>
      </div>

      {/* Footer bar — full width */}
      <div className="flex-shrink-0 border-t border-border px-5 py-3 flex items-center justify-between gap-4 bg-card">
        <p className="text-sm text-muted-foreground">
          {selectedItemsList.length > 0 || scannedUnitCount > 0 ? (
            <span className="font-medium text-foreground">
              {selectedItemsList.length > 0 && `${selectedItemsList.length} browse line(s)`}
              {selectedItemsList.length > 0 && scannedUnitCount > 0 && ", "}
              {scannedUnitCount > 0 && `${scannedUnitCount} scanned unit(s)`}
              {" — "}
              subtotal {formatPrice(subtotal)}
            </span>
          ) : (
            "No items selected"
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={selectedItemsList.length === 0 && scannedUnitCount === 0}
            onClick={onNext}
          >
            {selectedItemsList.length > 0 ? "Next: Assign IMEIs →" : "Next: Selling Price →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
