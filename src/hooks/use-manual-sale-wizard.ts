"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useAuth } from "@/lib/auth/context";
import { queryKeys } from "@/lib/query-keys";
import { percentToRate } from "@/lib/tax";
import { toastError } from "@/lib/utils/toast-helpers";
import { fetchIdentifierLabelsQuery, fetchAvailableIdentifiersQuery } from "@/lib/supabase/queries";
import { InventoryItem } from "@/data/inventory";
import { Order, OrderItem } from "@/types/order";
import type {
  AvailableIdentifierUnit,
  IdentifierScanGroup,
  ScannedIdentifierUnit,
  SelectedItem,
} from "@/types/inventory-identifiers";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4;

export interface UseManualSaleWizardOptions {
  onDismiss: () => void;
  mode?: "create" | "edit";
  orderToEdit?: Order | null;
  onManualOrderUpdated?: (order: Order) => void;
}

// ── Module-level helpers ───────────────────────────────────────────────────────

function getOrderLineIdentifierId(oi: OrderItem): string | undefined {
  const line = oi as OrderItem & { inventory_identifier_id?: string };
  if (typeof oi.inventoryIdentifierId === "string") return oi.inventoryIdentifierId;
  if (typeof line.inventory_identifier_id === "string") return line.inventory_identifier_id;
  return undefined;
}

function getOrderLineIdentifierLabel(oi: OrderItem): string | undefined {
  const line = oi as OrderItem & { identifier_label?: string };
  if (typeof oi.identifierLabel === "string") return oi.identifierLabel;
  if (typeof line.identifier_label === "string") return line.identifier_label;
  return undefined;
}

type InventoryIdentifierRow = {
  id: string;
  imei: string | null;
  serial_number: string | null;
  color: string | null;
};

async function fetchInventoryIdentifierLabels(ids: string[]): Promise<InventoryIdentifierRow[]> {
  return fetchIdentifierLabelsQuery(ids);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useManualSaleWizard({
  onDismiss,
  mode = "create",
  orderToEdit = null,
  onManualOrderUpdated,
}: UseManualSaleWizardOptions) {
  const isEdit = mode === "edit" && orderToEdit != null;
  const allowedSoldIdentifierIdsRef = useRef<readonly string[]>([]);

  const {
    inventory,
    decreaseQuantity,
    lookupIdentifierForSale,
    markInventoryIdentifierSold,
    revertInventoryIdentifierSold,
  } = useInventory();
  const { createManualOrder, patchManualSaleOrderDetails, updateManualOrder } = useOrders();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Step routing ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>(1);

  // ── Step 1: Select items ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItem>>({});

  // ── Step 3: Selling prices ──────────────────────────────────────────────────
  const [sellingPrices, setSellingPrices] = useState<Record<string, string>>({});
  /** Per inventory row (SKU) for scanned units — group-level default */
  const [sellingPricesIdent, setSellingPricesIdent] = useState<Record<string, string>>({});
  /** Per individual scanned unit: Record<inventoryIdentifierId, price string> */
  const [sellingPricesIdentUnit, setSellingPricesIdentUnit] = useState<Record<string, string>>({});

  // ── Step 4: Customer & payment ──────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [sameAsShipping, setSameAsShipping] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [hstPercent, setHstPercent] = useState("13");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  // ── IMEI scanner ────────────────────────────────────────────────────────────
  const [identifierQuery, setIdentifierQuery] = useState("");
  const [identifierGroups, setIdentifierGroups] = useState<IdentifierScanGroup[]>([]);
  const [identifierLookupLoading, setIdentifierLookupLoading] = useState(false);

  // ── Step 2: IMEI assignment ─────────────────────────────────────────────────
  const [pendingImeiSelections, setPendingImeiSelections] = useState<Record<string, string[]>>({});
  const [availableIdentifiers, setAvailableIdentifiers] = useState<
    Record<string, AvailableIdentifierUnit[]>
  >({});
  const [identifiersLoading, setIdentifiersLoading] = useState(false);

  // ── Derived memos ───────────────────────────────────────────────────────────

  const identifierUnitsFlat = useMemo(
    () =>
      identifierGroups.flatMap((g) =>
        g.units.map((u) => ({
          id: u.id,
          inventoryIdentifierId: u.inventoryIdentifierId,
          displayLabel: u.displayLabel,
          item: g.item,
        })),
      ),
    [identifierGroups],
  );

  const scannedUnitCount = useMemo(
    () => identifierGroups.reduce((sum, g) => sum + g.units.length, 0),
    [identifierGroups],
  );

  const scannedUnitsByInventoryId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of identifierGroups) {
      map[g.inventoryId] = (map[g.inventoryId] ?? 0) + g.units.length;
    }
    return map;
  }, [identifierGroups]);

  /** When editing, add back quantities from this order so browse max qty matches pre-sale capacity. */
  const qtyBonusByItemId = useMemo(() => {
    if (!isEdit || !orderToEdit) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const line of orderToEdit.items) {
      const id = line.item?.id;
      if (!id) continue;
      map[id] = (map[id] ?? 0) + line.quantity;
    }
    return map;
  }, [isEdit, orderToEdit]);

  const getEffectiveStock = useCallback(
    (item: InventoryItem): number => {
      return item.quantity + (qtyBonusByItemId[item.id] ?? 0);
    },
    [qtyBonusByItemId],
  );

  /** Max units selectable from browse for this SKU (stock minus already-scanned units). */
  const getBrowseMaxQty = useCallback(
    (item: InventoryItem): number => {
      const stock = getEffectiveStock(item);
      const scanned = scannedUnitsByInventoryId[item.id] ?? 0;
      return Math.max(0, stock - scanned);
    },
    [getEffectiveStock, scannedUnitsByInventoryId],
  );

  const availableItems = useMemo(
    () =>
      inventory.filter(
        (item) =>
          item.isActive !== false &&
          getEffectiveStock(item) > 0 &&
          (getBrowseMaxQty(item) > 0 || !!selectedItems[item.id]) &&
          (searchQuery === "" ||
            item.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.storage.toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [getBrowseMaxQty, getEffectiveStock, inventory, searchQuery, selectedItems],
  );

  const selectedItemsList = useMemo(() => Object.values(selectedItems), [selectedItems]);

  const getEffectivePrice = useCallback(
    (item: InventoryItem): number => {
      const custom = parseFloat(sellingPrices[item.id] ?? "");
      return isNaN(custom) ? (item.sellingPrice ?? item.pricePerUnit) : custom;
    },
    [sellingPrices],
  );

  const getEffectiveUnitPriceIdent = useCallback(
    (unit: ScannedIdentifierUnit, group: IdentifierScanGroup): number => {
      const listPrice = group.item.sellingPrice ?? group.item.pricePerUnit;
      const unitCustom = parseFloat(sellingPricesIdentUnit[unit.inventoryIdentifierId] ?? "");
      if (!Number.isNaN(unitCustom)) return unitCustom;
      const groupCustom = parseFloat(sellingPricesIdent[group.inventoryId] ?? "");
      return Number.isNaN(groupCustom) ? listPrice : groupCustom;
    },
    [sellingPricesIdentUnit, sellingPricesIdent],
  );

  const subtotal = useMemo(
    () =>
      selectedItemsList.reduce(
        (sum, { item, quantity }) => sum + getEffectivePrice(item) * quantity,
        0,
      ) +
      identifierGroups.reduce(
        (sum, g) => sum + g.units.reduce((uSum, u) => uSum + getEffectiveUnitPriceIdent(u, g), 0),
        0,
      ),
    [selectedItemsList, getEffectivePrice, identifierGroups, getEffectiveUnitPriceIdent],
  );

  const { hstAmount, total } = useMemo(() => {
    const rate = percentToRate(Math.max(0, parseFloat(hstPercent) || 0));
    const amount = subtotal * rate;
    return { hstAmount: amount, total: subtotal + amount };
  }, [subtotal, hstPercent]);

  // ── Effects ─────────────────────────────────────────────────────────────────

  /** Keep browse quantities within (stock − scanned) when scans are added or removed. */
  useEffect(() => {
    setSelectedItems((prev) => {
      let changed = false;
      const next: Record<string, SelectedItem> = { ...prev };
      for (const id of Object.keys(next)) {
        const live = inventory.find((i) => i.id === id);
        if (!live) {
          delete next[id];
          changed = true;
          continue;
        }
        const browseMax = Math.max(
          0,
          getEffectiveStock(live) - (scannedUnitsByInventoryId[id] ?? 0),
        );
        if (browseMax <= 0) {
          delete next[id];
          changed = true;
        } else if (next[id].quantity > browseMax) {
          next[id] = { ...next[id], item: live, quantity: browseMax };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [getEffectiveStock, inventory, scannedUnitsByInventoryId]);

  const didHydrateEditRef = useRef(false);
  const inventoryMergedForEditRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isEdit || !orderToEdit) {
      didHydrateEditRef.current = false;
      inventoryMergedForEditRef.current = null;
      return;
    }
    if (didHydrateEditRef.current) return;
    didHydrateEditRef.current = true;

    let cancelled = false;

    void (async () => {
      allowedSoldIdentifierIdsRef.current = orderToEdit.items
        .map(getOrderLineIdentifierId)
        .filter((x): x is string => typeof x === "string");

      const lineIdentifierIds = orderToEdit.items
        .map(getOrderLineIdentifierId)
        .filter((x): x is string => Boolean(x));

      const labelById = new Map<string, string>();
      const colorById = new Map<string, string | null>();
      if (lineIdentifierIds.length > 0) {
        const identRows = await fetchInventoryIdentifierLabels(lineIdentifierIds);
        if (!cancelled) {
          for (const row of identRows) {
            labelById.set(row.id, row.imei ?? row.serial_number ?? row.id);
            colorById.set(row.id, row.color);
          }
        }
      }

      if (cancelled) return;

      const selected: Record<string, SelectedItem> = {};
      const groupsMap = new Map<string, IdentifierScanGroup>();

      for (const oi of orderToEdit.items) {
        const snap = oi.item;
        const live = inventory.find((i) => i.id === snap.id);
        const merged: InventoryItem = live
          ? {
              ...live,
              sellingPrice: snap.sellingPrice ?? live.sellingPrice,
              pricePerUnit: snap.pricePerUnit ?? live.pricePerUnit,
              purchasePrice: snap.purchasePrice ?? live.purchasePrice,
              hst: snap.hst ?? live.hst,
            }
          : (snap as InventoryItem);

        const identId = getOrderLineIdentifierId(oi);
        if (identId) {
          const invId = merged.id;
          const displayLabel = getOrderLineIdentifierLabel(oi) || labelById.get(identId) || identId;
          const unit: ScannedIdentifierUnit = {
            id: crypto.randomUUID(),
            inventoryIdentifierId: identId,
            displayLabel,
            color: colorById.get(identId) ?? null,
          };
          const existing = groupsMap.get(invId);
          if (existing) {
            existing.units.push(unit);
          } else {
            groupsMap.set(invId, { inventoryId: invId, item: merged, units: [unit] });
          }
        } else {
          const id = merged.id;
          const prev = selected[id];
          if (prev) {
            selected[id] = { item: merged, quantity: prev.quantity + oi.quantity };
          } else {
            selected[id] = { item: merged, quantity: oi.quantity };
          }
        }
      }

      const groupsArray = [...groupsMap.values()];

      setSelectedItems(selected);
      setIdentifierGroups(groupsArray);
      setIdentifierQuery("");

      const sellPrices: Record<string, string> = {};
      Object.values(selected).forEach(({ item }) => {
        sellPrices[item.id] = String(item.sellingPrice ?? item.pricePerUnit);
      });
      setSellingPrices(sellPrices);

      const identPrices: Record<string, string> = {};
      const identUnitPrices: Record<string, string> = {};
      for (const oi of orderToEdit.items) {
        const identId = getOrderLineIdentifierId(oi);
        if (identId) {
          identUnitPrices[identId] = String(oi.item.sellingPrice ?? oi.item.pricePerUnit);
        }
      }
      groupsMap.forEach((g) => {
        identPrices[g.inventoryId] = String(g.item.sellingPrice ?? g.item.pricePerUnit);
      });
      setSellingPricesIdent(identPrices);
      setSellingPricesIdentUnit(identUnitPrices);

      setCustomerName(orderToEdit.manualCustomerName?.trim() ?? "");
      setCustomerEmail(orderToEdit.manualCustomerEmail?.trim() ?? "");
      let phone = orderToEdit.manualCustomerPhone?.trim() ?? "";
      if (phone.startsWith("+1")) phone = phone.slice(2);
      setCustomerPhone(phone);
      setBillingAddress(orderToEdit.billingAddress?.trim() ?? "");
      setShippingAddress(orderToEdit.shippingAddress?.trim() ?? "");
      setSameAsShipping(false);
      setPaymentMethod(orderToEdit.paymentTerms ?? "");
      const tr = orderToEdit.taxRate;
      setHstPercent(String(Math.round((tr ?? 0) * 100)));
      setNotes(orderToEdit.invoiceNotes?.trim() ?? "");
    })();

    return () => {
      cancelled = true;
      // Reset so a remount (e.g. React Strict Mode double-invoke) can re-hydrate.
      didHydrateEditRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per edit open
  }, [isEdit, orderToEdit?.id]);

  useEffect(() => {
    if (!isEdit || !orderToEdit) {
      inventoryMergedForEditRef.current = null;
      return;
    }
    if (identifierGroups.length === 0 || inventory.length === 0) return;
    if (inventoryMergedForEditRef.current === orderToEdit.id) return;
    inventoryMergedForEditRef.current = orderToEdit.id;

    setIdentifierGroups((prev) =>
      prev.map((g) => {
        const live = inventory.find((i) => i.id === g.inventoryId);
        if (!live) return g;
        return {
          ...g,
          item: {
            ...live,
            sellingPrice: g.item.sellingPrice,
            pricePerUnit: g.item.pricePerUnit,
            purchasePrice: g.item.purchasePrice ?? live.purchasePrice,
            hst: g.item.hst ?? live.hst,
          },
        };
      }),
    );
    setSelectedItems((prev) => {
      const next: Record<string, SelectedItem> = { ...prev };
      for (const key of Object.keys(next)) {
        const live = inventory.find((i) => i.id === key);
        if (!live) continue;
        next[key] = {
          ...next[key],
          item: {
            ...live,
            sellingPrice: next[key].item.sellingPrice,
            pricePerUnit: next[key].item.pricePerUnit,
            purchasePrice: next[key].item.purchasePrice ?? live.purchasePrice,
            hst: next[key].item.hst ?? live.hst,
          },
        };
      }
      return next;
    });
  }, [isEdit, orderToEdit, inventory, identifierGroups.length]);

  // ── Step 1 handlers ─────────────────────────────────────────────────────────

  const handleToggleItem = (item: InventoryItem) => {
    setSelectedItems((prev) => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      const live = inventory.find((i) => i.id === item.id) ?? item;
      const browseMax = getBrowseMaxQty(live);
      if (browseMax < 1) {
        toast.error("No units left to add from browse — already added via scan for this device.");
        return prev;
      }
      return { ...prev, [item.id]: { item: live, quantity: 1 } };
    });
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const live = inventory.find((i) => i.id === itemId) ?? current.item;
      const maxQty = getBrowseMaxQty(live);
      if (maxQty < 1) return prev;
      const newQty = Math.max(1, Math.min(maxQty, current.quantity + delta));
      return { ...prev, [itemId]: { ...current, item: live, quantity: newQty } };
    });
  };

  const handleQuantityInput = (itemId: string, value: string, maxQty: number) => {
    const parsed = parseInt(value, 10);
    setSelectedItems((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      if (value === "" || isNaN(parsed)) return { ...prev, [itemId]: { ...current, quantity: 1 } };
      const clamped = Math.max(1, Math.min(maxQty, parsed));
      return { ...prev, [itemId]: { ...current, quantity: clamped } };
    });
  };

  // ── Step 2 handlers ─────────────────────────────────────────────────────────

  const handleGoToStep2 = async () => {
    if (selectedItemsList.length > 0) {
      setIdentifiersLoading(true);
      try {
        const existingScannedIds = new Set(identifierUnitsFlat.map((u) => u.inventoryIdentifierId));
        const itemIds = selectedItemsList.map(({ item }) => item.id);
        const rows = await fetchAvailableIdentifiersQuery(itemIds);

        const result: Record<string, AvailableIdentifierUnit[]> = {};
        for (const { item } of selectedItemsList) result[item.id] = [];
        for (const row of rows) {
          const invId = row.inventory_id;
          if (!result[invId] || existingScannedIds.has(row.id)) continue;
          result[invId].push({
            id: row.id,
            imei: row.imei,
            serialNumber: row.serial_number,
            color: row.color,
            displayLabel: row.imei ?? row.serial_number ?? row.id,
          });
        }
        setAvailableIdentifiers(result);
        const initial: Record<string, string[]> = {};
        for (const { item } of selectedItemsList) {
          initial[item.id] = pendingImeiSelections[item.id] ?? [];
        }
        setPendingImeiSelections(initial);
        setStep(2);
      } catch {
        toast.error("Failed to load available units. Please try again.");
      } finally {
        setIdentifiersLoading(false);
      }
    } else {
      // No browse selections — skip IMEI step and go straight to prices
      const identPrices: Record<string, string> = {};
      const identUnitPrices: Record<string, string> = {};
      identifierGroups.forEach((g) => {
        const listStr = String(g.item.sellingPrice ?? g.item.pricePerUnit);
        identPrices[g.inventoryId] = listStr;
        g.units.forEach((u) => {
          if (!sellingPricesIdentUnit[u.inventoryIdentifierId]) {
            identUnitPrices[u.inventoryIdentifierId] = listStr;
          }
        });
      });
      setSellingPricesIdent(identPrices);
      setSellingPricesIdentUnit((prev) => ({ ...prev, ...identUnitPrices }));
      setStep(3);
    }
  };

  const handleTogglePendingImei = (inventoryId: string, identId: string, maxQty: number) => {
    setPendingImeiSelections((prev) => {
      const current = prev[inventoryId] ?? [];
      if (current.includes(identId)) {
        return { ...prev, [inventoryId]: current.filter((id) => id !== identId) };
      }
      if (current.length >= maxQty) return prev;
      return { ...prev, [inventoryId]: [...current, identId] };
    });
  };

  const handleBackFromStep2 = () => {
    setPendingImeiSelections({});
    setAvailableIdentifiers({});
    setStep(1);
  };

  const handleGoToStep3FromImei = () => {
    for (const { item, quantity } of selectedItemsList) {
      const selected = pendingImeiSelections[item.id] ?? [];
      if (selected.length !== quantity) {
        toast.error(
          `Select exactly ${quantity} unit${quantity !== 1 ? "s" : ""} for ${item.deviceName}.`,
        );
        return;
      }
    }

    const newGroupsMap = new Map<string, IdentifierScanGroup>();
    for (const { item } of selectedItemsList) {
      const selectedIds = pendingImeiSelections[item.id] ?? [];
      const available = availableIdentifiers[item.id] ?? [];
      const units: ScannedIdentifierUnit[] = selectedIds.map((id) => {
        const found = available.find((u) => u.id === id);
        return {
          id: crypto.randomUUID(),
          inventoryIdentifierId: id,
          displayLabel: found?.displayLabel ?? id,
          color: found?.color ?? null,
        };
      });
      newGroupsMap.set(item.id, { inventoryId: item.id, item, units });
    }

    // Merge existing + new groups synchronously to avoid stale closure on identifierGroups
    const mergedGroups: IdentifierScanGroup[] = [...identifierGroups];
    newGroupsMap.forEach((group) => {
      const idx = mergedGroups.findIndex((g) => g.inventoryId === group.inventoryId);
      if (idx >= 0) {
        mergedGroups[idx] = {
          ...mergedGroups[idx],
          units: [...mergedGroups[idx].units, ...group.units],
        };
      } else {
        mergedGroups.push(group);
      }
    });

    const identPrices: Record<string, string> = {};
    const identUnitPrices: Record<string, string> = {};
    mergedGroups.forEach((g) => {
      const listStr = String(g.item.sellingPrice ?? g.item.pricePerUnit);
      identPrices[g.inventoryId] = listStr;
      g.units.forEach((u) => {
        if (!sellingPricesIdentUnit[u.inventoryIdentifierId]) {
          identUnitPrices[u.inventoryIdentifierId] = listStr;
        }
      });
    });

    setIdentifierGroups(mergedGroups);
    setSelectedItems({});
    setPendingImeiSelections({});
    setSellingPricesIdent(identPrices);
    setSellingPricesIdentUnit((prev) => ({ ...prev, ...identUnitPrices }));
    setStep(3);
  };

  // ── Step 3 (price) handlers ──────────────────────────────────────────────────

  const handleSellingPriceChange = (itemId: string, value: string) => {
    setSellingPrices((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSellingPriceBlur = (itemId: string) => {
    const item = selectedItems[itemId]?.item;
    if (!item) return;
    const listPrice = item.sellingPrice ?? item.pricePerUnit;
    const entered = parseFloat(sellingPrices[itemId] ?? "");
    if (isNaN(entered)) {
      setSellingPrices((prev) => ({ ...prev, [itemId]: String(listPrice) }));
    }
  };

  const handleSellingPriceChangeIdentUnit = (inventoryIdentifierId: string, value: string) => {
    setSellingPricesIdentUnit((prev) => ({ ...prev, [inventoryIdentifierId]: value }));
  };

  const handleSellingPriceBlurIdentUnit = (inventoryIdentifierId: string, listPrice: number) => {
    const entered = parseFloat(sellingPricesIdentUnit[inventoryIdentifierId] ?? "");
    if (isNaN(entered)) {
      setSellingPricesIdentUnit((prev) => ({
        ...prev,
        [inventoryIdentifierId]: String(listPrice),
      }));
    }
  };

  const handleGoToStep4 = () => {
    for (const { item } of selectedItemsList) {
      const entered = parseFloat(sellingPrices[item.id] ?? "");
      if (isNaN(entered)) {
        toast.error(`Enter a valid selling price for ${item.deviceName}.`);
        return;
      }
    }
    for (const g of identifierGroups) {
      const listPrice = g.item.sellingPrice ?? g.item.pricePerUnit;
      for (const unit of g.units) {
        const entered = parseFloat(sellingPricesIdentUnit[unit.inventoryIdentifierId] ?? "");
        if (isNaN(entered)) {
          const fallback = parseFloat(sellingPricesIdent[g.inventoryId] ?? "");
          if (isNaN(fallback)) {
            toast.error(
              `Enter a valid selling price for ${unit.displayLabel} (${g.item.deviceName}).`,
            );
            return;
          }
          setSellingPricesIdentUnit((prev) => ({
            ...prev,
            [unit.inventoryIdentifierId]: String(listPrice),
          }));
        }
      }
    }
    setStep(4);
  };

  // ── IMEI scanner handlers ────────────────────────────────────────────────────

  const handleIdentifierLookup = async () => {
    const q = identifierQuery.trim();
    if (!q) {
      toast.error("Enter an IMEI or serial number.");
      return;
    }

    const queries = q
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const lookupOpts =
      isEdit && allowedSoldIdentifierIdsRef.current.length > 0
        ? { allowSoldIdentifierIds: allowedSoldIdentifierIdsRef.current }
        : undefined;

    const resolveIdentifier = async (raw: string) => lookupIdentifierForSale(raw, lookupOpts);

    setIdentifierLookupLoading(true);
    try {
      if (queries.length === 1) {
        const found = await resolveIdentifier(queries[0]);
        if (!found) {
          toast.error("No unit found with that IMEI or serial number.");
          return;
        }
        if (identifierUnitsFlat.some((l) => l.inventoryIdentifierId === found.identifierId)) {
          toast.error("This unit is already added to this sale.");
          return;
        }
        const unit: ScannedIdentifierUnit = {
          id: crypto.randomUUID(),
          inventoryIdentifierId: found.identifierId,
          displayLabel: found.imei ?? found.serialNumber ?? queries[0],
          color: found.color,
          damageNote: found.damageNote,
        };
        const invId = found.item.id;
        const live = inventory.find((i) => i.id === invId) ?? found.item;
        const nextScannedCount = (scannedUnitsByInventoryId[invId] ?? 0) + 1;
        const browseCap = Math.max(0, getEffectiveStock(live) - nextScannedCount);

        setIdentifierGroups((prev) => {
          const idx = prev.findIndex((g) => g.inventoryId === invId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], units: [...next[idx].units, unit] };
            return next;
          }
          return [...prev, { inventoryId: invId, item: found.item, units: [unit] }];
        });
        setSelectedItems((prevSel) => {
          const line = prevSel[invId];
          if (!line) return prevSel;
          if (browseCap <= 0) {
            const next = { ...prevSel };
            delete next[invId];
            return next;
          }
          if (line.quantity > browseCap) {
            return { ...prevSel, [invId]: { ...line, item: live, quantity: browseCap } };
          }
          return prevSel;
        });
        setIdentifierQuery("");
        toast.success(`Added: ${unit.displayLabel}`);
      } else {
        type BatchResult = {
          found: NonNullable<Awaited<ReturnType<typeof lookupIdentifierForSale>>>;
          unit: ScannedIdentifierUnit;
        };

        const results: BatchResult[] = [];
        const notFound: string[] = [];
        const duplicates: string[] = [];
        const failed: string[] = [];
        const batchAddedIds = new Set<string>();

        for (const rawQ of queries) {
          try {
            const found = await resolveIdentifier(rawQ);
            if (!found) {
              notFound.push(rawQ);
              continue;
            }
            if (
              identifierUnitsFlat.some((l) => l.inventoryIdentifierId === found.identifierId) ||
              batchAddedIds.has(found.identifierId)
            ) {
              duplicates.push(rawQ);
              continue;
            }
            batchAddedIds.add(found.identifierId);
            results.push({
              found,
              unit: {
                id: crypto.randomUUID(),
                inventoryIdentifierId: found.identifierId,
                displayLabel: found.imei ?? found.serialNumber ?? rawQ,
                color: found.color,
                damageNote: found.damageNote,
              },
            });
          } catch {
            failed.push(rawQ);
          }
        }

        if (results.length > 0) {
          const addedCountByInvId = new Map<string, number>();
          for (const { found } of results) {
            const id = found.item.id;
            addedCountByInvId.set(id, (addedCountByInvId.get(id) ?? 0) + 1);
          }

          setIdentifierGroups((prev) => {
            let next = [...prev];
            for (const { found, unit } of results) {
              const invId = found.item.id;
              const idx = next.findIndex((g) => g.inventoryId === invId);
              if (idx >= 0) {
                next[idx] = { ...next[idx], units: [...next[idx].units, unit] };
              } else {
                next = [...next, { inventoryId: invId, item: found.item, units: [unit] }];
              }
            }
            return next;
          });

          setSelectedItems((prevSel) => {
            const next = { ...prevSel };
            for (const [invId, addCount] of addedCountByInvId) {
              const live =
                inventory.find((i) => i.id === invId) ??
                results.find((r) => r.found.item.id === invId)!.found.item;
              const nextScanned = (scannedUnitsByInventoryId[invId] ?? 0) + addCount;
              const browseCap = Math.max(0, getEffectiveStock(live) - nextScanned);
              const line = next[invId];
              if (line) {
                if (browseCap <= 0) {
                  delete next[invId];
                } else if (line.quantity > browseCap) {
                  next[invId] = { ...line, item: live, quantity: browseCap };
                }
              }
            }
            return next;
          });

          setIdentifierQuery("");
          toast.success(`Added ${results.length} unit${results.length > 1 ? "s" : ""}`);
        }
        if (notFound.length > 0) toast.error(`Not found: ${notFound.join(", ")}`);
        if (duplicates.length > 0) toast.error(`Already in sale: ${duplicates.join(", ")}`);
        if (failed.length > 0) toast.error(`Lookup failed for: ${failed.join(", ")}`);
      }
    } catch (err) {
      toastError(err, "Lookup failed. Please try again.");
    } finally {
      setIdentifierLookupLoading(false);
    }
  };

  const handleRemoveIdentifierUnit = (inventoryId: string, unitId: string) => {
    setIdentifierGroups((prev) =>
      prev
        .map((g) =>
          g.inventoryId === inventoryId
            ? { ...g, units: g.units.filter((u) => u.id !== unitId) }
            : g,
        )
        .filter((g) => g.units.length > 0),
    );
  };

  // ── Reset / Close ────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep(1);
    setSearchQuery("");
    setSelectedItems({});
    setIdentifierQuery("");
    setIdentifierGroups([]);
    setSellingPricesIdent({});
    setSellingPricesIdentUnit({});
    setSellingPrices({});
    setPendingImeiSelections({});
    setAvailableIdentifiers({});
    setIdentifiersLoading(false);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setBillingAddress("");
    setShippingAddress("");
    setSameAsShipping(false);
    setPaymentMethod("");
    setHstPercent("13");
    setNotes("");
    didHydrateEditRef.current = false;
    onDismiss();
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const hasLines = selectedItemsList.length > 0 || identifierUnitsFlat.length > 0;
    if (!user?.id || !hasLines || !customerName.trim() || !paymentMethod) return;
    setSubmitFailed(false);

    setIsSubmitting(true);
    try {
      const orderItems: OrderItem[] = [
        ...selectedItemsList.map(({ item, quantity }) => ({
          item: { ...item, sellingPrice: getEffectivePrice(item) },
          quantity,
        })),
        ...identifierGroups.flatMap((g) =>
          g.units.map((u) => ({
            item: { ...g.item, sellingPrice: getEffectiveUnitPriceIdent(u, g) },
            quantity: 1,
            inventoryIdentifierId: u.inventoryIdentifierId,
            identifierLabel: u.displayLabel,
          })),
        ),
      ];

      const finalShippingAddress = sameAsShipping ? billingAddress.trim() : shippingAddress.trim();
      const hstVal = Math.max(0, parseFloat(hstPercent) || 0);

      if (isEdit && orderToEdit) {
        const updated = await updateManualOrder(orderToEdit.id, orderItems, hstVal);
        await patchManualSaleOrderDetails(orderToEdit.id, {
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() ? `+1${customerPhone.trim()}` : null,
          paymentMethod,
          billingAddress: billingAddress.trim() || null,
          shippingAddress: finalShippingAddress || null,
          notes: notes.trim() || null,
        });
        toast.success(`Manual sale updated — Order #${updated.id.slice(-8).toUpperCase()}`);
        onManualOrderUpdated?.(updated);
        handleClose();
        return;
      }

      const order = await createManualOrder(
        user.id,
        orderItems,
        {
          name: customerName.trim(),
          email: customerEmail.trim() || undefined,
          phone: customerPhone.trim() ? `+1${customerPhone.trim()}` : undefined,
        },
        paymentMethod,
        hstVal,
        billingAddress.trim() || undefined,
        finalShippingAddress || undefined,
        notes.trim() || undefined,
      );

      // Order is committed — inventory mutations are best-effort; failures must NOT
      // surface as "sale failed" or the user will resubmit and create a duplicate.
      let inventoryWarning = false;
      for (const oi of orderItems) {
        if (oi.inventoryIdentifierId) {
          try {
            await markInventoryIdentifierSold(oi.inventoryIdentifierId);
          } catch (identErr) {
            toastError(
              identErr,
              "Identifier update failed — sale was recorded, check inventory manually",
            );
            inventoryWarning = true;
          }
        }
        try {
          await decreaseQuantity(oi.item.id, oi.quantity);
        } catch (qtyErr) {
          toastError(
            qtyErr,
            "Quantity update failed — sale was recorded, check inventory manually",
          );
          inventoryWarning = true;
        }
      }

      toast.success(
        inventoryWarning
          ? `Sale recorded — Order #${order.id.slice(-8).toUpperCase()} (inventory may need manual review)`
          : `Sale recorded — Order #${order.id.slice(-8).toUpperCase()}`,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.userOrdersBase });
      handleClose();
    } catch {
      setSubmitFailed(true);
      toast.error(
        isEdit
          ? "Failed to update manual sale. Please try again."
          : "Failed to record sale. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Return value ─────────────────────────────────────────────────────────────

  return {
    // Navigation
    step,
    isEdit,
    // Step 1 — browse
    searchQuery,
    setSearchQuery,
    selectedItems,
    selectedItemsList,
    availableItems,
    scannedUnitsByInventoryId,
    scannedUnitCount,
    getEffectiveStock,
    getBrowseMaxQty,
    handleToggleItem,
    handleQuantityChange,
    handleQuantityInput,
    // Step 1 — IMEI scanner
    identifierQuery,
    setIdentifierQuery,
    identifierGroups,
    identifierLookupLoading,
    handleIdentifierLookup,
    handleRemoveIdentifierUnit,
    // Step 2 — IMEI assignment
    identifiersLoading,
    availableIdentifiers,
    pendingImeiSelections,
    handleTogglePendingImei,
    // Step 3 — prices
    sellingPrices,
    sellingPricesIdentUnit,
    getEffectivePrice,
    getEffectiveUnitPriceIdent,
    handleSellingPriceChange,
    handleSellingPriceBlur,
    handleSellingPriceChangeIdentUnit,
    handleSellingPriceBlurIdentUnit,
    // Step 4 — customer & payment
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    customerPhone,
    setCustomerPhone,
    billingAddress,
    setBillingAddress,
    shippingAddress,
    setShippingAddress,
    sameAsShipping,
    setSameAsShipping,
    notes,
    setNotes,
    paymentMethod,
    setPaymentMethod,
    hstPercent,
    setHstPercent,
    isSubmitting,
    submitFailed,
    // Totals
    subtotal,
    hstAmount,
    total,
    // Actions
    handleGoToStep2,
    handleBackFromStep2,
    handleGoToStep3FromImei,
    handleGoToStep4,
    handleClose,
    handleSubmit,
    setStep,
  } as const;
}
