"use client";

import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import type { ProductForm } from "@/hooks/use-add-product";

interface ProductFormSummaryProps {
  form: ProductForm;
  imeiList: string[];
  serialList: string[];
  warnBothImeiAndSerialForSingleQuantity: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export function ProductFormSummary({
  form,
  imeiList,
  serialList,
  warnBothImeiAndSerialForSingleQuantity,
  isSubmitting,
  onBack,
  onConfirm,
}: ProductFormSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <h4 className="font-semibold text-sm">Product Overview</h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="space-y-1">
            <dt className="text-muted-foreground">Device</dt>
            <dd className="font-medium">{form.deviceName || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Brand</dt>
            <dd className="font-medium">{form.brand || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Grade</dt>
            <dd className="font-medium">{form.grade || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Storage</dt>
            <dd className="font-medium">{form.storage || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-amber-600 dark:text-amber-500">IMEI</dt>
            <dd className="font-medium">{imeiList.length || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Serial</dt>
            <dd className="font-medium">{serialList.length || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Quantity</dt>
            <dd className="font-medium">{form.quantity}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Purchase Price</dt>
            <dd className="font-medium">{formatPrice(Number(form.purchasePrice) || 0)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Selling Price</dt>
            <dd className="font-medium">{formatPrice(Number(form.sellingPrice) || 0)}</dd>
          </div>
          {form.grade === "D" && (
            <div className="col-span-2 space-y-1">
              <dt className="text-muted-foreground text-destructive">Damage Note</dt>
              <dd className="font-medium text-sm">
                {form.damageNote.trim() || (
                  <span className="text-muted-foreground italic">None provided</span>
                )}
              </dd>
            </div>
          )}
        </dl>
        {warnBothImeiAndSerialForSingleQuantity && (
          <p
            className="text-xs text-amber-700 dark:text-amber-400 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2"
            role="status"
          >
            For a single unit, use either IMEI or serial—not both fields.
          </p>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={isSubmitting}>
          Back to Edit
        </Button>
        <Button className="flex-1" onClick={onConfirm} disabled={isSubmitting}>
          <Palette className="h-4 w-4 mr-2" />
          Confirm & Configure Colors
        </Button>
      </div>
    </div>
  );
}
