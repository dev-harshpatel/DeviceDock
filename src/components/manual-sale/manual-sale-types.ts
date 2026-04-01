import type { InventoryItem } from "@/data/inventory";

export interface ScannedIdentifierUnit {
  id: string;
  inventoryIdentifierId: string;
  displayLabel: string;
}

/** Scanned units grouped by inventory row (same device / grade / storage). */
export interface IdentifierScanGroup {
  inventoryId: string;
  item: InventoryItem;
  units: ScannedIdentifierUnit[];
}
