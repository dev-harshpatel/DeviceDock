"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { lookupIdentifierByImei } from "@/lib/supabase/queries/inventory";
import { useFilterOptions } from "@/hooks/use-filter-options";
import { useIdentifierMap } from "@/hooks/use-identifier-map";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import type { IdentifierFullLookup, IdentifierSaleLookup } from "@/types/inventory-identifiers";

export interface BulkImeiEntry {
  imei: string;
  deviceName: string | null;
  grade: string | null;
  storage: string | null;
  color: string | null;
  sellingPrice: number | null;
}

/** Convert an in-memory map hit (no soldAt) to the full lookup shape. */
function saleLookupToFull(r: IdentifierSaleLookup): IdentifierFullLookup {
  return { ...r, soldAt: null, purchasePrice: r.purchasePrice ?? null };
}

export function useImeiLookup() {
  const { companyId } = useCompany();
  const { lookup: lookupFromMap } = useIdentifierMap();
  const { storageOptions } = useFilterOptions();
  const [activeTab, setActiveTab] = useState<string>("single");

  // ── Single Lookup state ──
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<IdentifierFullLookup | null>(null);
  const [searched, setSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);

  // ── Bulk Print state ──
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkEntries, setBulkEntries] = useState<BulkImeiEntry[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [showBulkBarcode, setShowBulkBarcode] = useState(false);

  // ── Single Lookup handlers ──
  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !companyId) return;

    setIsLoading(true);
    setResult(null);
    setSearched(true);

    try {
      // Try in-memory map first (O(1), no network). Map only holds in_stock/reserved,
      // so sold/returned/damaged devices fall through to the DB query.
      const mapHit = lookupFromMap(trimmed);
      if (mapHit) {
        setResult(saleLookupToFull(mapHit));
        setIsLoading(false);
        return;
      }

      const data = await lookupIdentifierByImei(companyId, trimmed);
      setResult(data);
      if (!data) {
        toast.error(TOAST_MESSAGES.IMEI_NOT_FOUND);
      }
    } catch {
      toast.error(TOAST_MESSAGES.IMEI_LOOKUP_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [query, companyId, lookupFromMap]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  // ── Bulk Print handlers ──
  const handleAddBulkImeis = useCallback(async () => {
    const raw = bulkInput.trim();
    if (!raw || !companyId) return;

    const parsed = raw
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const existingSet = new Set(bulkEntries.map((e) => e.imei));
    const newImeis: string[] = [];
    let duplicateCount = 0;

    for (const imei of parsed) {
      if (existingSet.has(imei)) {
        duplicateCount++;
      } else {
        existingSet.add(imei);
        newImeis.push(imei);
      }
    }

    if (duplicateCount > 0) {
      toast.error(`${duplicateCount} duplicate IMEI${duplicateCount > 1 ? "s" : ""} skipped.`);
    }

    if (newImeis.length === 0) {
      setBulkInput("");
      return;
    }

    setIsBulkLoading(true);
    setBulkInput("");

    // Resolve all IMEIs in parallel: map hit (instant) or DB fallback per miss.
    const entries = await Promise.all(
      newImeis.map(async (imei): Promise<BulkImeiEntry> => {
        try {
          const mapHit = lookupFromMap(imei);
          const data = mapHit
            ? saleLookupToFull(mapHit)
            : await lookupIdentifierByImei(companyId, imei);
          return {
            imei,
            deviceName: data?.item.deviceName ?? null,
            grade: data?.item.grade ?? null,
            storage: data?.item.storage ?? null,
            color: data?.color ?? null,
            sellingPrice: data?.item.sellingPrice ?? null,
          };
        } catch {
          return {
            imei,
            deviceName: null,
            grade: null,
            storage: null,
            color: null,
            sellingPrice: null,
          };
        }
      }),
    );

    setBulkEntries((prev) => [...prev, ...entries]);
    setIsBulkLoading(false);
    // Restore focus so the user can immediately scan/type the next IMEI.
    bulkInputRef.current?.focus();
  }, [bulkInput, bulkEntries, companyId, lookupFromMap]);

  const handleBulkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAddBulkImeis();
      }
    },
    [handleAddBulkImeis],
  );

  const handleRemoveBulkEntry = useCallback((index: number) => {
    setBulkEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearBulk = useCallback(() => {
    setBulkEntries([]);
    setBulkInput("");
  }, []);

  const bulkCount = bulkEntries.length;
  const hasBulkEntries = bulkCount > 0;
  const bulkDialogEntries = bulkEntries.map((e) => ({
    imei: e.imei,
    deviceName: e.deviceName,
    grade: e.grade,
    storage: e.storage,
    sellingPrice: e.sellingPrice,
  }));

  return {
    companyId,
    storageOptions,
    activeTab,
    setActiveTab,
    query,
    setQuery,
    result,
    setResult,
    searched,
    isLoading,
    showBarcode,
    setShowBarcode,
    bulkInputRef,
    bulkInput,
    setBulkInput,
    bulkEntries,
    isBulkLoading,
    showBulkBarcode,
    setShowBulkBarcode,
    handleSearch,
    handleKeyDown,
    handleAddBulkImeis,
    handleBulkKeyDown,
    handleRemoveBulkEntry,
    handleClearBulk,
    bulkCount,
    hasBulkEntries,
    bulkDialogEntries,
  };
}
