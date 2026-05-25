"use client";

import { Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BulkImeiEntry } from "@/hooks/use-imei-lookup";

interface BulkPrintTabProps {
  bulkInputRef: React.RefObject<HTMLInputElement>;
  bulkInput: string;
  setBulkInput: (val: string) => void;
  handleBulkKeyDown: (e: React.KeyboardEvent) => void;
  isBulkLoading: boolean;
  handleAddBulkImeis: () => void;
  hasBulkEntries: boolean;
  bulkCount: number;
  handleClearBulk: () => void;
  bulkEntries: BulkImeiEntry[];
  handleRemoveBulkEntry: (index: number) => void;
  setShowBulkBarcode: (val: boolean) => void;
}

export function BulkPrintTab({
  bulkInputRef,
  bulkInput,
  setBulkInput,
  handleBulkKeyDown,
  isBulkLoading,
  handleAddBulkImeis,
  hasBulkEntries,
  bulkCount,
  handleClearBulk,
  bulkEntries,
  handleRemoveBulkEntry,
  setShowBulkBarcode,
}: BulkPrintTabProps) {
  return (
    <div className="mt-4 flex-1 min-h-0">
      <div className="space-y-4">
        {/* Input area */}
        <div className="max-w-2xl space-y-2">
          <p className="text-sm text-muted-foreground">
            Enter or scan IMEI numbers separated by commas, spaces, or new lines.
          </p>
          <div className="flex gap-2">
            <Input
              ref={bulkInputRef}
              type="text"
              placeholder="Enter IMEI numbers..."
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              onKeyDown={handleBulkKeyDown}
              disabled={isBulkLoading}
              className="flex-1"
            />
            <Button
              onClick={handleAddBulkImeis}
              disabled={!bulkInput.trim() || isBulkLoading}
              className="gap-2"
            >
              {isBulkLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add"
              )}
            </Button>
          </div>
        </div>

        {/* Queued IMEIs list */}
        {hasBulkEntries ? (
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {bulkCount} IMEI{bulkCount !== 1 ? "s" : ""} queued
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearBulk}
                className="text-xs text-muted-foreground hover:text-destructive gap-1.5 h-8"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="max-h-64 overflow-y-auto divide-y divide-border">
                {bulkEntries.map((entry, index) => {
                  const details = [entry.deviceName, entry.grade, entry.storage, entry.color]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <div
                      key={`${entry.imei}-${index}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 mr-3">
                        <p className="text-sm font-mono text-foreground">{entry.imei}</p>
                        {details && (
                          <p className="text-xs text-muted-foreground truncate">{details}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBulkEntry(index)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button onClick={() => setShowBulkBarcode(true)} className="w-full gap-2">
              <Printer className="h-4 w-4" />
              Generate {bulkCount} Label{bulkCount !== 1 ? "s" : ""}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mb-3">
              <Printer className="h-7 w-7 text-accent-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">No IMEIs queued</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Enter IMEI numbers above to queue them for bulk label printing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
