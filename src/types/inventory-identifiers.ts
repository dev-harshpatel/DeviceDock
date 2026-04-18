import type { InventoryItem } from "@/data/inventory";

/** Result of resolving an IMEI or serial for manual sale (PLAN-5). */
export interface IdentifierSaleLookup {
  identifierId: string;
  imei: string | null;
  serialNumber: string | null;
  status: string;
  color: string | null;
  damageNote: string | null;
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
  item: InventoryItem;
}
