"use client";

import type { KeyboardEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type Grade,
  GRADES,
  GRADE_BADGE_LABELS,
  GRADE_LABELS,
  GRADE_STYLES,
} from "@/lib/constants/grades";

interface ProductForm {
  deviceName: string;
  brand: string;
  grade: Grade | "";
  storage: string;
  purchasePrice: string;
  hst: string;
  sellingPrice: string;
}

interface BulkScanRow {
  id: string;
  identifier: string;
  imei: string | null;
  serialNumber: string | null;
  status: "pending" | "valid" | "invalid";
  reason?: string;
}

interface BulkSummary {
  total: number;
  valid: number;
  invalid: number;
}

interface BulkModePanelProps {
  form: ProductForm;
  onField: (field: keyof ProductForm, value: string) => void;
  bulkRows: BulkScanRow[];
  bulkScanInput: string;
  setBulkScanInput: (v: string) => void;
  bulkSummary: BulkSummary | null;
  isBulkReviewing: boolean;
  isBulkSaving: boolean;
  onBulkScanKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBulkScanSubmit: () => void;
  onRemoveBulkRow: (id: string) => void;
  onResetBulkRows: () => void;
  onBulkReview: () => void;
  onBulkInsert: () => void;
  onClose: () => void;
}

export function BulkModePanel({
  form,
  onField,
  bulkRows,
  bulkScanInput,
  setBulkScanInput,
  bulkSummary,
  isBulkReviewing,
  isBulkSaving,
  onBulkScanKeyDown,
  onBulkScanSubmit,
  onRemoveBulkRow,
  onResetBulkRows,
  onBulkReview,
  onBulkInsert,
  onClose,
}: BulkModePanelProps) {
  return (
    <div className="space-y-4 pb-1">
      {/* Shared product configuration */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
        <h4 className="text-sm font-semibold">Shared Product Configuration</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="bulk-device" className="text-sm font-medium">
              Device Name
            </Label>
            <Input
              id="bulk-device"
              placeholder="e.g. iPhone 8"
              value={form.deviceName}
              onChange={(e) => onField("deviceName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-brand" className="text-sm font-medium">
              Brand
            </Label>
            <Input
              id="bulk-brand"
              placeholder="e.g. Apple"
              value={form.brand}
              onChange={(e) => onField("brand", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Grade</Label>
            <Select value={form.grade} onValueChange={(v) => onField("grade", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded text-xs font-bold border px-1.5 py-0.5 min-w-[1.5rem]",
                          GRADE_STYLES[g],
                        )}
                      >
                        {GRADE_BADGE_LABELS[g]}
                      </span>
                      {GRADE_LABELS[g]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-storage" className="text-sm font-medium">
              Storage
            </Label>
            <Input
              id="bulk-storage"
              placeholder="e.g. 64GB"
              value={form.storage}
              onChange={(e) => onField("storage", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-hst" className="text-sm font-medium">
              HST %
            </Label>
            <Input
              id="bulk-hst"
              type="number"
              placeholder="13"
              value={form.hst}
              onChange={(e) => onField("hst", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-purchase" className="text-sm font-medium">
              Purchase Price (per unit)
            </Label>
            <Input
              id="bulk-purchase"
              type="number"
              placeholder="0.00"
              value={form.purchasePrice}
              onChange={(e) => onField("purchasePrice", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-selling" className="text-sm font-medium">
              Selling Price (per unit)
            </Label>
            <Input
              id="bulk-selling"
              type="number"
              placeholder="0.00"
              value={form.sellingPrice}
              onChange={(e) => onField("sellingPrice", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Scan section */}
      <div className="rounded-lg border bg-background p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Scan IMEI / Serial Numbers</h4>
          <Badge variant="secondary">{bulkRows.length} scanned</Badge>
        </div>

        <div className="flex gap-2">
          <Input
            id="bulk-scan"
            value={bulkScanInput}
            placeholder="Scan and press Enter"
            onChange={(e) => setBulkScanInput(e.target.value)}
            onKeyDown={onBulkScanKeyDown}
            aria-label="Scan IMEI or serial number"
          />
          <Button type="button" variant="outline" onClick={onBulkScanSubmit}>
            Add
          </Button>
        </div>

        {bulkRows.length > 0 ? (
          <div className="rounded-md border max-h-52 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Identifier</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{row.identifier}</td>
                    <td className="px-3 py-2">{row.imei ? "IMEI" : "Serial"}</td>
                    <td className="px-3 py-2">
                      {row.status === "pending" && "Pending review"}
                      {row.status === "valid" && <span className="text-emerald-600">Valid</span>}
                      {row.status === "invalid" && (
                        <span className="text-destructive">{row.reason ?? "Invalid row"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveBulkRow(row.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Start scanning devices. Each scan adds one identifier row.
          </p>
        )}

        {bulkSummary && (
          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <p className="font-medium">Bulk Review Summary</p>
            <p className="text-muted-foreground mt-1">
              Total: {bulkSummary.total} | Valid: {bulkSummary.valid} | Invalid:{" "}
              {bulkSummary.invalid}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onResetBulkRows}
            disabled={isBulkReviewing || isBulkSaving || bulkRows.length === 0}
          >
            Clear List
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onBulkReview}
            disabled={isBulkReviewing || isBulkSaving || bulkRows.length === 0}
          >
            {isBulkReviewing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reviewing
              </>
            ) : (
              "Review Bulk List"
            )}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isBulkSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={onBulkInsert}
            disabled={isBulkSaving || !bulkSummary || bulkSummary.valid === 0}
          >
            {isBulkSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding
              </>
            ) : (
              "Confirm & Add Bulk Products"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
