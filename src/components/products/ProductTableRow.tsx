"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2, Palette, Save, Trash2 } from "lucide-react";
import { InventoryItem, calculatePricePerUnit, formatPrice } from "@/data/inventory";
import { GRADES } from "@/lib/constants/grades";

interface ProductTableRowProps {
  product: InventoryItem;
  index: number;
  editedFields: Partial<InventoryItem> | undefined;
  isColorLoading: boolean;
  hasColours: boolean;
  isActive: boolean;
  isToggling: boolean;
  canDelete: boolean;
  onFieldChange: (id: string, field: keyof InventoryItem, value: string | number) => void;
  onOpenColour: (id: string) => void;
  onSave: (id: string) => void;
  onToggleActive: (product: InventoryItem) => void;
  onDelete: (product: InventoryItem) => void;
}

export function ProductTableRow({
  product,
  index,
  editedFields,
  isColorLoading,
  hasColours,
  isActive,
  isToggling,
  canDelete,
  onFieldChange,
  onOpenColour,
  onSave,
  onToggleActive,
  onDelete,
}: ProductTableRowProps) {
  const hasEdits = !!editedFields;

  const deviceName = (editedFields?.deviceName ?? product.deviceName) as string;
  const brand = (editedFields?.brand ?? product.brand) as string;
  const grade = (editedFields?.grade ?? product.grade) as string;
  const storage = (editedFields?.storage ?? product.storage) as string;
  const quantity = (editedFields?.quantity ?? product.quantity) as number;
  const purchasePrice = (editedFields?.purchasePrice ?? product.purchasePrice ?? 0) as number;
  const hst = (editedFields?.hst ?? product.hst ?? 0) as number;
  const sellingPrice = (editedFields?.sellingPrice ?? product.sellingPrice) as number;
  const calculatedPricePerUnit = calculatePricePerUnit(purchasePrice, quantity, hst);

  return (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/50",
        index % 2 === 1 && "bg-muted/20",
        hasEdits && "bg-primary/5",
        !isActive && "opacity-50",
      )}
    >
      <td className="px-4 py-2">
        <Input
          value={deviceName}
          onChange={(e) => onFieldChange(product.id, "deviceName", e.target.value)}
          className="min-w-[200px] text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={brand}
          onChange={(e) => onFieldChange(product.id, "brand", e.target.value)}
          className="min-w-[120px] text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Select value={grade} onValueChange={(v) => onFieldChange(product.id, "grade", v)}>
          <SelectTrigger className="min-w-[140px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input
          value={storage}
          onChange={(e) => onFieldChange(product.id, "storage", e.target.value)}
          className="min-w-[100px] text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          value={quantity ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onFieldChange(product.id, "quantity", val === "" ? "" : parseInt(val) || 0);
          }}
          onBlur={() => {
            if (!quantity && quantity !== 0) onFieldChange(product.id, "quantity", 0);
          }}
          className="w-24 text-center text-sm"
          min="0"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-sm">$</span>
          <Input
            type="number"
            value={purchasePrice ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onFieldChange(product.id, "purchasePrice", val === "" ? "" : parseFloat(val) || 0);
            }}
            onBlur={() => {
              if (!purchasePrice && purchasePrice !== 0)
                onFieldChange(product.id, "purchasePrice", 0);
            }}
            className="w-28 text-right text-sm"
            min="0"
            step="0.01"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-2">
          <Input
            type="number"
            value={hst ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onFieldChange(product.id, "hst", val === "" ? "" : parseFloat(val) || 0);
            }}
            onBlur={() => {
              if (!hst && hst !== 0) onFieldChange(product.id, "hst", 0);
            }}
            className="w-20 text-right text-sm"
            min="0"
            step="0.01"
          />
          <span className="text-muted-foreground">%</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <span className="text-sm text-muted-foreground font-medium">
          {formatPrice(calculatedPricePerUnit).replace(/\s*CAD$/i, "")}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground">$</span>
          <Input
            type="number"
            value={sellingPrice ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onFieldChange(product.id, "sellingPrice", val === "" ? "" : parseFloat(val) || 0);
            }}
            onBlur={() => {
              if (!sellingPrice && sellingPrice !== 0) onFieldChange(product.id, "sellingPrice", 0);
            }}
            className="w-28 text-right text-sm"
            min="0"
            step="0.01"
          />
        </div>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-center gap-2">
          {/* Colours button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenColour(product.id)}
            disabled={isColorLoading}
            className={cn(
              "h-8 w-8 p-0 relative",
              hasColours ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            title="Manage colours"
          >
            {isColorLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Palette className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Save button */}
          <Button
            size="sm"
            variant={hasEdits ? "default" : "ghost"}
            onClick={() => onSave(product.id)}
            disabled={!hasEdits}
            className={cn("gap-1.5", !hasEdits && "text-muted-foreground")}
            title={hasEdits ? "Save changes" : "No changes to save"}
          >
            <Save className="h-3.5 w-3.5" />
          </Button>

          {/* Active toggle */}
          <Switch
            checked={isActive}
            onCheckedChange={() => onToggleActive(product)}
            disabled={isToggling}
            title={isActive ? "Listed — click to unlist" : "Unlisted — click to list"}
          />

          {/* Delete button — owner/manager only */}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(product)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Delete product"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
