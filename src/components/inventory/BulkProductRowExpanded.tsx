"use client";

import { Check, ChevronsUpDown, Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Grade, GRADES, GRADE_BADGE_LABELS, GRADE_LABELS } from "@/lib/constants/grades";
import { cn, formatPrice } from "@/lib/utils";
import { normalizeStorage, storageInputDisplay } from "@/lib/utils/storage";
import { parseIdentifierList } from "@/lib/inventory/parse-identifier-list";
import type { InventoryItem } from "@/data/inventory";
import type { BulkEditableField, BulkProductRowForm } from "@/types/bulk-products";
import { BulkRowPricePreview } from "./BulkRowPricePreview";

const GRADE_STYLES: Record<string, string> = {
  "Brand New Open Box": "bg-teal-500/10 text-teal-700 border-teal-500/30",
  "Brand New Sealed": "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  D: "bg-red-500/10 text-red-700 border-red-500/30",
};

interface BulkProductRowExpandedProps {
  index: number;
  row: BulkProductRowForm;
  inventory: InventoryItem[];
  isSubmitting: boolean;
  isLoadingColorRows: boolean;
  comboboxOpenIndex: number | null;
  setComboboxOpenIndex: (idx: number | null) => void;
  onFieldChange: (index: number, field: BulkEditableField, val: string) => void;
  onSelectInventoryItem: (index: number, item: InventoryItem) => void;
  onLineDone: (index: number) => void;
  onRemove: (index: number) => void;
  onOpenColorDialog: (index: number) => void;
}

export function BulkProductRowExpanded({
  index,
  row,
  inventory,
  isSubmitting,
  isLoadingColorRows,
  comboboxOpenIndex,
  setComboboxOpenIndex,
  onFieldChange,
  onSelectInventoryItem,
  onLineDone,
  onRemove,
  onOpenColorDialog,
}: BulkProductRowExpandedProps) {
  const existingItem =
    row.selectedInventoryId != null
      ? (inventory.find((i) => i.id === row.selectedInventoryId) ?? null)
      : null;

  return (
    <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-stretch lg:gap-4 xl:gap-6">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
            <span className="text-base font-semibold tabular-nums text-foreground">
              {index + 1}.
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => onLineDone(index)}
                disabled={isSubmitting}
              >
                <Check className="h-3.5 w-3.5" />
                Done
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(index)}
                disabled={isSubmitting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor={`bulk-device-search-${index}`}>
              Product
            </Label>
            <Popover
              open={comboboxOpenIndex === index}
              onOpenChange={(popoverOpen) => {
                if (popoverOpen) {
                  setComboboxOpenIndex(index);
                  return;
                }
                setComboboxOpenIndex(comboboxOpenIndex === index ? null : comboboxOpenIndex);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  id={`bulk-device-search-${index}`}
                  aria-expanded={comboboxOpenIndex === index}
                  disabled={isSubmitting}
                  className="h-10 w-full min-w-0 justify-between font-normal whitespace-normal text-left"
                >
                  <span
                    className={cn(
                      "line-clamp-2 text-sm text-left",
                      !row.deviceName && "text-muted-foreground",
                    )}
                  >
                    {row.deviceName ? row.deviceName : "Search inventory..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                side="bottom"
              >
                <Command>
                  <CommandInput placeholder="Type to filter..." className="h-9" />
                  <CommandList className="max-h-60">
                    <CommandEmpty>
                      <div className="py-4 text-center space-y-1">
                        <p className="text-sm font-medium text-foreground">No match found</p>
                        <p className="text-xs text-muted-foreground">
                          Fill in the device name below to add a new product.
                        </p>
                      </div>
                    </CommandEmpty>
                    <CommandGroup heading={`${inventory.length} products in inventory`}>
                      {inventory.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.deviceName} ${item.grade} ${item.storage} ${item.brand}`}
                          onSelect={() => onSelectInventoryItem(index, item)}
                          className="py-2 cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0 text-primary",
                              row.selectedInventoryId === item.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-1 items-center justify-between min-w-0 gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate leading-tight">
                                {item.deviceName}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.storage} · Qty:{" "}
                                <strong className="text-foreground">{item.quantity}</strong> ·{" "}
                                {formatPrice(item.sellingPrice)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 min-w-[1.5rem] rounded border",
                                GRADE_STYLES[item.grade],
                              )}
                            >
                              {GRADE_BADGE_LABELS[item.grade as Grade]}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {!row.selectedInventoryId && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" htmlFor={`bulk-device-name-${index}`}>
                Device name
              </Label>
              <Input
                id={`bulk-device-name-${index}`}
                placeholder="e.g. iPhone 14 Pro"
                value={row.deviceName}
                onChange={(event) => onFieldChange(index, "deviceName", event.target.value)}
                disabled={isSubmitting}
                className="h-10"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Brand</Label>
              <Input
                placeholder="Brand"
                value={row.brand}
                onChange={(event) => onFieldChange(index, "brand", event.target.value)}
                disabled={isSubmitting || !!row.selectedInventoryId}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Grade</Label>
              <Select
                value={row.grade === "" ? undefined : row.grade}
                onValueChange={(value) => onFieldChange(index, "grade", value)}
                disabled={isSubmitting || !!row.selectedInventoryId}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((gradeValue) => (
                    <SelectItem key={gradeValue} value={gradeValue}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center rounded text-xs font-bold border px-1.5 py-0.5 min-w-[1.5rem]",
                            GRADE_STYLES[gradeValue],
                          )}
                        >
                          {GRADE_BADGE_LABELS[gradeValue]}
                        </span>
                        {GRADE_LABELS[gradeValue]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Storage</Label>
              <div className="relative">
                <Input
                  placeholder="128"
                  value={storageInputDisplay(row.storage)}
                  onChange={(event) =>
                    onFieldChange(index, "storage", normalizeStorage(event.target.value))
                  }
                  disabled={isSubmitting || !!row.selectedInventoryId}
                  className="h-10 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  GB
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {row.selectedInventoryId ? "Units to add" : "Quantity"}
              </Label>
              <Input
                type="number"
                min={1}
                placeholder="0"
                value={row.quantity}
                onChange={(event) => onFieldChange(index, "quantity", event.target.value)}
                disabled={isSubmitting}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">HST %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="13"
                value={row.hst}
                onChange={(event) => onFieldChange(index, "hst", event.target.value)}
                disabled={isSubmitting}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Total purchase $</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={row.purchasePrice}
                onChange={(event) => onFieldChange(index, "purchasePrice", event.target.value)}
                disabled={isSubmitting}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Sell / unit $</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={row.sellingPrice}
                onChange={(event) => onFieldChange(index, "sellingPrice", event.target.value)}
                disabled={isSubmitting}
                className="h-10"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Colours assigned:{" "}
              {row.colorRows.reduce((sum, colorRow) => sum + (Number(colorRow.quantity) || 0), 0)} /{" "}
              {Number(row.quantity) || 0}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => onOpenColorDialog(index)}
              disabled={isSubmitting || isLoadingColorRows}
            >
              <Palette className="h-3.5 w-3.5" />
              Assign colors
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor={`bulk-imei-${index}`}>
              IMEI numbers (comma-separated)
            </Label>
            <Textarea
              id={`bulk-imei-${index}`}
              placeholder={
                "Paste IMEIs separated by commas\nExample: 357890123456789, 357890123456790"
              }
              value={row.imeiText}
              onChange={(event) => onFieldChange(index, "imeiText", event.target.value)}
              disabled={isSubmitting}
              className="min-h-[90px] resize-y"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" htmlFor={`bulk-serial-${index}`}>
              Serial numbers (comma-separated)
            </Label>
            <Textarea
              id={`bulk-serial-${index}`}
              placeholder={"Paste serials separated by commas\nExample: SN-ABC-12345, SN-XYZ-99211"}
              value={row.serialText}
              onChange={(event) => onFieldChange(index, "serialText", event.target.value)}
              disabled={isSubmitting}
              className="min-h-[90px] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Use commas between identifiers (new lines also work). IMEI{" "}
              {parseIdentifierList(row.imeiText).length} | Serial{" "}
              {parseIdentifierList(row.serialText).length} | Total{" "}
              {parseIdentifierList(row.imeiText).length +
                parseIdentifierList(row.serialText).length}{" "}
              / Required {Number(row.quantity) || 0}
            </p>
          </div>
        </div>

        <div className="lg:w-[min(100%,380px)] xl:w-[420px] shrink-0 lg:border-l lg:border-border lg:pl-4 xl:pl-6 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pricing preview
          </p>
          <BulkRowPricePreview row={row} existingItem={existingItem} />
        </div>
      </div>
    </article>
  );
}
