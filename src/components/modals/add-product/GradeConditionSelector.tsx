"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADES, GRADE_BADGE_LABELS, GRADE_LABELS, GRADE_STYLES } from "@/lib/constants/grades";
import { normalizeStorage, storageInputDisplay } from "@/lib/utils/storage";
import type { ProductForm } from "@/hooks/use-add-product";
import type { InventoryItem } from "@/data/inventory";

interface GradeConditionSelectorProps {
  form: ProductForm;
  handleField: (field: keyof ProductForm, value: string) => void;
  selectedExisting: InventoryItem | null;
}

export function GradeConditionSelector({
  form,
  handleField,
  selectedExisting,
}: GradeConditionSelectorProps) {
  return (
    <>
      {/* Device Name */}
      <div className="col-span-2 space-y-1.5 mt-2">
        <Label htmlFor="ap-device" className="text-sm font-medium">
          Device Name
        </Label>
        <Input
          id="ap-device"
          placeholder="e.g. iPhone 12"
          value={form.deviceName}
          onChange={(e) => handleField("deviceName", e.target.value)}
          disabled={!!selectedExisting}
          className={selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
        />
      </div>

      {/* Brand */}
      <div className="space-y-1.5">
        <Label htmlFor="ap-brand" className="text-sm font-medium">
          Brand
        </Label>
        <Input
          id="ap-brand"
          placeholder="e.g. Apple"
          value={form.brand}
          onChange={(e) => handleField("brand", e.target.value)}
          disabled={!!selectedExisting}
          className={selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
        />
      </div>

      {/* Grade */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Grade</Label>
        <Select
          value={form.grade}
          onValueChange={(v) => handleField("grade", v)}
          disabled={!!selectedExisting}
        >
          <SelectTrigger
            className={
              selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""
            }
          >
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

      {/* Damage Note — D grade only */}
      {form.grade === "D" && (
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="ap-damage-note" className="text-sm font-medium text-destructive">
            Damage Note
          </Label>
          <Textarea
            id="ap-damage-note"
            placeholder="Describe the damage (e.g. cracked screen, faulty charging port, back glass broken…)"
            value={form.damageNote}
            onChange={(e) => handleField("damageNote", e.target.value)}
            rows={3}
            className="resize-none text-sm border-destructive/40 focus-visible:ring-destructive/30"
          />
          <p className="text-xs text-muted-foreground">
            This note will be stored per unit and shown in the IMEI list and on orders.
          </p>
        </div>
      )}

      {/* Storage */}
      <div className="space-y-1.5">
        <Label htmlFor="ap-storage" className="text-sm font-medium">
          Storage
        </Label>
        <div className="relative">
          <Input
            id="ap-storage"
            placeholder="128"
            value={storageInputDisplay(form.storage)}
            onChange={(e) => handleField("storage", normalizeStorage(e.target.value))}
            disabled={!!selectedExisting}
            className={cn(
              "pr-10",
              selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : "",
            )}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            GB
          </span>
        </div>
      </div>
    </>
  );
}
