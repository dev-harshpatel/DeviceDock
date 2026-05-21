import type { InventoryItem } from "@/data/inventory";

// ── Manual Sale Wizard types ──────────────────────────────────────────────────

export interface ScannedIdentifierUnit {
  id: string;
  inventoryIdentifierId: string;
  displayLabel: string;
  color?: string | null;
  damageNote?: string | null;
}

/** Scanned units grouped by inventory row (same device / grade / storage). */
export interface IdentifierScanGroup {
  inventoryId: string;
  item: InventoryItem;
  units: ScannedIdentifierUnit[];
}

export interface SelectedItem {
  item: InventoryItem;
  quantity: number;
}

export interface AvailableIdentifierUnit {
  id: string;
  imei: string | null;
  serialNumber: string | null;
  color: string | null;
  displayLabel: string;
}

/** Result of resolving an IMEI or serial for manual sale (PLAN-5). */
export interface IdentifierSaleLookup {
  identifierId: string;
  imei: string | null;
  serialNumber: string | null;
  status: string;
  color: string | null;
  damageNote: string | null;
  /** Per-unit base purchase cost (pre-HST); null for legacy records before migration 043. */
  purchasePrice?: number | null;
  item: InventoryItem;
}

/** Result of a general IMEI lookup (all statuses). */
export interface IdentifierFullLookup {
  identifierId: string;
  imei: string | null;
  serialNumber: string | null;
  status: string;
  soldAt: string | null;
  color: string | null;
  damageNote: string | null;
  /** Per-unit purchase cost stored at add-time; null for legacy records added before migration 043. */
  purchasePrice?: number | null;
  item: InventoryItem;
}

/** Result used by the Edit Products by IMEI workflow. */
export type IdentifierEditLookup = IdentifierFullLookup;
