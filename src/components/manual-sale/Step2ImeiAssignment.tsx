"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClickableGradeBadge } from "@/components/common/ClickableGradeBadge";
import { cn } from "@/lib/utils";
import type { AvailableIdentifierUnit, SelectedItem } from "@/types/inventory-identifiers";

export interface Step2ImeiAssignmentProps {
  selectedItemsList: SelectedItem[];
  identifiersLoading: boolean;
  availableIdentifiers: Record<string, AvailableIdentifierUnit[]>;
  pendingImeiSelections: Record<string, string[]>;
  onTogglePendingImei: (inventoryId: string, identId: string, maxQty: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2ImeiAssignment({
  selectedItemsList,
  identifiersLoading,
  availableIdentifiers,
  pendingImeiSelections,
  onTogglePendingImei,
  onNext,
  onBack,
}: Step2ImeiAssignmentProps) {
  const allAssigned = selectedItemsList.every(
    ({ item, quantity }) => (pendingImeiSelections[item.id] ?? []).length === quantity,
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border/60 bg-card">
        <p className="text-sm text-muted-foreground">
          Select the specific units (by IMEI or serial) for each item. You must select exactly the
          quantity chosen in the previous step.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
        {identifiersLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          selectedItemsList.map(({ item, quantity }) => {
            const available = availableIdentifiers[item.id] ?? [];
            const selected = pendingImeiSelections[item.id] ?? [];
            const isComplete = selected.length === quantity;

            return (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                {/* Device header */}
                <div
                  className={cn(
                    "px-4 py-3 flex items-center justify-between gap-3 border-b border-border",
                    isComplete ? "bg-primary/5" : "bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{item.deviceName}</p>
                    <ClickableGradeBadge
                      grade={item.grade}
                      inventoryId={item.id}
                      deviceName={item.deviceName}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.brand} · {item.storage}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full",
                        isComplete
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {selected.length} / {quantity} selected
                    </span>
                  </div>
                </div>

                {/* Units list */}
                {available.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-destructive font-medium">
                      No available units found for this device.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ensure units are in stock with IMEI/serial numbers assigned.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {available.map((unit) => {
                      const isSelected = selected.includes(unit.id);
                      const isDisabled = !isSelected && selected.length >= quantity;
                      return (
                        <label
                          key={unit.id}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none",
                            isSelected
                              ? "bg-primary/5"
                              : isDisabled
                                ? "opacity-40"
                                : "hover:bg-muted/40",
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onCheckedChange={() => onTogglePendingImei(item.id, unit.id, quantity)}
                            aria-label={`Select unit ${unit.displayLabel}`}
                          />
                          <span className="font-mono text-sm text-foreground flex-1 truncate">
                            {unit.displayLabel}
                          </span>
                          {unit.color && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                              {unit.color}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border px-5 py-3 flex items-center justify-between gap-4 bg-card">
        <p className="text-sm text-muted-foreground">
          {allAssigned ? (
            <span className="text-primary font-medium">All units assigned</span>
          ) : (
            "Assign IMEIs for all items to continue"
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button disabled={identifiersLoading || !allAssigned} onClick={onNext}>
            Next: Selling Price →
          </Button>
        </div>
      </div>
    </div>
  );
}
