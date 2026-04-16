"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { type Grade, GRADE_BADGE_LABELS, GRADE_STYLES } from "@/lib/constants/grades";
import type { InventoryItem } from "@/data/inventory";

interface ProductSearchComboboxProps {
  comboboxOpen: boolean;
  setComboboxOpen: (open: boolean) => void;
  inventory: InventoryItem[];
  selectedExisting: InventoryItem | null;
  selectedExistingId: string | null;
  deviceNameSearch: string;
  onSelectExisting: (item: InventoryItem) => void;
  onClearSelection: () => void;
}

export function ProductSearchCombobox({
  comboboxOpen,
  setComboboxOpen,
  inventory,
  selectedExisting,
  selectedExistingId,
  deviceNameSearch,
  onSelectExisting,
  onClearSelection,
}: ProductSearchComboboxProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Search Existing Products</Label>
      <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={comboboxOpen}
            className="w-full justify-between font-normal h-10"
          >
            <span className={cn("truncate text-sm", !deviceNameSearch && "text-muted-foreground")}>
              {deviceNameSearch || "Search by name, grade, storage…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          side="bottom"
          onWheel={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput placeholder="Type to filter…" className="h-9" />
            <CommandList className="max-h-60">
              <CommandEmpty>
                <div className="py-5 text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">No match found</p>
                  <p className="text-xs text-muted-foreground">
                    Fill in the form below to add a new product.
                  </p>
                </div>
              </CommandEmpty>
              <CommandGroup
                heading={`${inventory.length} product${inventory.length !== 1 ? "s" : ""} in inventory`}
              >
                {inventory.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.deviceName} ${item.grade} ${item.storage} ${item.brand}`}
                    onSelect={() => onSelectExisting(item)}
                    className="py-2 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0 text-primary",
                        selectedExistingId === item.id ? "opacity-100" : "opacity-0",
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

      {selectedExisting && (
        <div className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 min-w-0">
            Restocking <strong className="text-foreground">{selectedExisting.deviceName}</strong> —
            Grade {selectedExisting.grade}, {selectedExisting.storage}
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
