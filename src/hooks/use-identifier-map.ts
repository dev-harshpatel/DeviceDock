"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOptionalCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/lib/supabase/client";
import { INVENTORY_ADMIN_FIELDS } from "@/lib/supabase/queries/inventory";
import { dbRowToInventoryItem } from "@/lib/supabase/queries/mappers";
import { queryKeys } from "@/lib/query-keys";
import type { IdentifierSaleLookup } from "@/types/inventory-identifiers";

const STALE_MS = 5 * 60 * 1000; // 5 minutes

async function fetchAllActiveIdentifiers(companyId: string): Promise<IdentifierSaleLookup[]> {
  // Single JOIN query — identifiers + their inventory row in one round-trip.
  // Includes in_stock, reserved, and damaged so the edit/delete by IMEI flows get
  // instant O(1) lookups for all actionable statuses. Sold/returned fall back to DB.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("inventory_identifiers") as any)
    .select(
      `id, imei, serial_number, status, color, damage_note, purchase_price, inventory!inner(${INVENTORY_ADMIN_FIELDS})`,
    )
    .eq("company_id", companyId)
    .in("status", ["in_stock", "reserved", "damaged"]);

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    identifierId: row.id as string,
    imei: (row.imei as string | null) ?? null,
    serialNumber: (row.serial_number as string | null) ?? null,
    status: String(row.status ?? "in_stock"),
    color: (row.color as string | null) ?? null,
    damageNote: (row.damage_note as string | null) ?? null,
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    item: dbRowToInventoryItem(row.inventory),
  }));
}

/**
 * Loads all in-stock/reserved identifiers for the company into two Maps
 * (by IMEI and by serial number) for O(1) synchronous lookups during manual sale.
 *
 * Data is cached for 5 minutes and invalidated automatically via realtime
 * when inventory or identifier state changes (see use-realtime-invalidation.ts).
 */
export function useIdentifierMap() {
  const company = useOptionalCompany();
  const companyId = company?.companyId ?? "";

  const { data: identifiers = [] } = useQuery({
    queryKey: queryKeys.identifierMapAll(companyId),
    queryFn: () => fetchAllActiveIdentifiers(companyId),
    staleTime: STALE_MS,
    enabled: !!companyId,
  });

  const byImei = useMemo(() => {
    const map = new Map<string, IdentifierSaleLookup>();
    for (const row of identifiers) {
      if (row.imei) map.set(row.imei.toLowerCase(), row);
    }
    return map;
  }, [identifiers]);

  const bySerial = useMemo(() => {
    const map = new Map<string, IdentifierSaleLookup>();
    for (const row of identifiers) {
      if (row.serialNumber) map.set(row.serialNumber.toLowerCase(), row);
    }
    return map;
  }, [identifiers]);

  /**
   * Synchronous O(1) lookup by IMEI or serial number.
   * Returns null if not found in the cache (caller should fall back to DB if needed).
   */
  const lookup = (value: string): IdentifierSaleLookup | null => {
    const v = value.trim().toLowerCase();
    return byImei.get(v) ?? bySerial.get(v) ?? null;
  };

  return { lookup, byImei, bySerial };
}
