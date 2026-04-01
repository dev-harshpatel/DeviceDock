import type { InventoryItem } from "@/data/inventory";

/** Result of resolving an IMEI or serial for manual sale (PLAN-5). */
export interface IdentifierSaleLookup {
  identifierId: string;
  imei: string | null;
  serialNumber: string | null;
  status: string;
  item: InventoryItem;
}
