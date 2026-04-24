import type { InventoryItem } from "@/data/inventory";

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
