"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { useAuth } from "@/lib/auth/context";
import { InventoryItem } from "@/data/inventory";
import { queryKeys } from "@/lib/query-keys";
import { percentToRate } from "@/lib/tax";
import { toastError } from "@/lib/utils/toast-helpers";
import { Order, OrderItem } from "@/types/order";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GradeBadge } from "@/components/common/GradeBadge";
import { ClickableGradeBadge } from "@/components/common/ClickableGradeBadge";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Plus,
  ScanLine,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ManualSaleStepIndicator } from "@/components/manual-sale/ManualSaleStepIndicator";
import type {
  IdentifierScanGroup,
  ScannedIdentifierUnit,
} from "@/components/manual-sale/manual-sale-types";
import { useIdentifierMap } from "@/hooks/use-identifier-map";
import { supabase } from "@/lib/supabase/client";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EMT: "E-Transfer (EMT)",
  WIRE: "Wire Transfer",
  CHQ: "Cheque",
  CASH: "Cash",
  CREDIT: "Credit Card",
  DEBIT: "Debit Card",
  "NET 15": "Net 15",
  "NET 30": "Net 30",
  "NET 60": "Net 60",
};

type Step = 1 | 2 | 3 | 4;

interface SelectedItem {
  item: InventoryItem;
  quantity: number;
}

interface AvailableIdentifierUnit {
  id: string;
  imei: string | null;
  serialNumber: string | null;
  color: string | null;
  displayLabel: string;
}

export interface ManualSaleWizardProps {
  /** Called after cancel or successful submit (reset form first). */
  onDismiss: () => void;
  /** Full page gives the browse list more vertical room than the modal. */
  layout: "modal" | "page";
  mode?: "create" | "edit";
  /** When `mode` is `edit`, seed and submit against this order. */
  orderToEdit?: Order | null;
  /** Called after a successful edit (not used for create). */
  onManualOrderUpdated?: (order: Order) => void;
}

const getOrderLineIdentifierId = (oi: OrderItem): string | undefined => {
  const line = oi as OrderItem & { inventory_identifier_id?: string };
  if (typeof oi.inventoryIdentifierId === "string") return oi.inventoryIdentifierId;
  if (typeof line.inventory_identifier_id === "string") return line.inventory_identifier_id;
  return undefined;
};

const getOrderLineIdentifierLabel = (oi: OrderItem): string | undefined => {
  const line = oi as OrderItem & { identifier_label?: string };
  if (typeof oi.identifierLabel === "string") return oi.identifierLabel;
  if (typeof line.identifier_label === "string") return line.identifier_label;
  return undefined;
};

/** `inventory_identifiers` is not in generated Database types; narrow client for this query only. */
type InventoryIdentifierRow = {
  id: string;
  imei: string | null;
  serial_number: string | null;
  color: string | null;
};
const fetchInventoryIdentifierLabels = async (ids: string[]): Promise<InventoryIdentifierRow[]> => {
  if (ids.length === 0) return [];
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (
          column: string,
          values: string[],
        ) => PromiseLike<{ data: InventoryIdentifierRow[] | null }>;
      };
    };
  };
  const { data } = await client
    .from("inventory_identifiers")
    .select("id, imei, serial_number, color")
    .in("id", ids);
  return data ?? [];
};

export function ManualSaleWizard({
  onDismiss,
  layout,
  mode = "create",
  orderToEdit = null,
  onManualOrderUpdated,
}: ManualSaleWizardProps) {
  const isPage = layout === "page";
  const isEdit = mode === "edit" && orderToEdit != null;
  const allowedSoldIdentifierIdsRef = useRef<readonly string[]>([]);
  const {
    inventory,
    decreaseQuantity,
    lookupIdentifierForSale,
    markInventoryIdentifierSold,
    revertInventoryIdentifierSold,
  } = useInventory();
  const { lookup: lookupFromMap } = useIdentifierMap();
  const { createManualOrder, patchManualSaleOrderDetails, updateManualOrder } = useOrders();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Step routing
  const [step, setStep] = useState<Step>(1);

  // ── Step 1: Select Items ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItem>>({});

  // ── Step 2: Selling Price ─────────────────────────────────────────────────
  // Record<itemId, price string> — string so input is editable; validated on advance
  const [sellingPrices, setSellingPrices] = useState<Record<string, string>>({});

  // ── Step 3: Customer & Payment ────────────────────────────────────────────
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

  const [identifierQuery, setIdentifierQuery] = useState("");
  const [identifierGroups, setIdentifierGroups] = useState<IdentifierScanGroup[]>([]);
  const [identifierLookupLoading, setIdentifierLookupLoading] = useState(false);
  /** Per inventory row (SKU) for scanned units */
  const [sellingPricesIdent, setSellingPricesIdent] = useState<Record<string, string>>({});

  // ── Step 2: IMEI Assignment ─────────────────────────────────────────────────
  const [pendingImeiSelections, setPendingImeiSelections] = useState<Record<string, string[]>>({});
  const [availableIdentifiers, setAvailableIdentifiers] = useState<
    Record<string, AvailableIdentifierUnit[]>
  >({});
  const [identifiersLoading, setIdentifiersLoading] = useState(false);

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

  /** Units already chosen via IMEI/serial scan, per inventory row — reduces browse capacity. */
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
      const bonus = qtyBonusByItemId[item.id] ?? 0;
      return item.quantity + bonus;
    },
    [qtyBonusByItemId],
  );

  /** Max units selectable from the browse column for this SKU (stock minus already-scanned units). */
  const getBrowseMaxQty = useCallback(
    (item: InventoryItem): number => {
      const stock = getEffectiveStock(item);
      const scanned = scannedUnitsByInventoryId[item.id] ?? 0;
      return Math.max(0, stock - scanned);
    },
    [getEffectiveStock, scannedUnitsByInventoryId],
  );

  // ── Derived ───────────────────────────────────────────────────────────────
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
            groupsMap.set(invId, {
              inventoryId: invId,
              item: merged,
              units: [unit],
            });
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
      groupsMap.forEach((g) => {
        identPrices[g.inventoryId] = String(g.item.sellingPrice ?? g.item.pricePerUnit);
      });
      setSellingPricesIdent(identPrices);

      setCustomerName(orderToEdit.manualCustomerName?.trim() ?? "");
      setCustomerEmail(orderToEdit.manualCustomerEmail?.trim() ?? "");
      let phone = orderToEdit.manualCustomerPhone?.trim() ?? "";
      if (phone.startsWith("+1")) {
        phone = phone.slice(2);
      }
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
      // The `cancelled` flag above prevents the in-flight async from writing stale state.
      didHydrateEditRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per edit open; inventory merged in separate effect
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
  }, [isEdit, orderToEdit?.id, inventory, identifierGroups.length]);

  const selectedItemsList = useMemo(() => Object.values(selectedItems), [selectedItems]);

  const getEffectivePrice = useCallback(
    (item: InventoryItem): number => {
      const custom = parseFloat(sellingPrices[item.id] ?? "");
      return isNaN(custom) ? (item.sellingPrice ?? item.pricePerUnit) : custom;
    },
    [sellingPrices],
  );

  const getEffectivePriceIdentGroup = useCallback(
    (group: IdentifierScanGroup): number => {
      const custom = parseFloat(sellingPricesIdent[group.inventoryId] ?? "");
      const base = group.item.sellingPrice ?? group.item.pricePerUnit;
      return Number.isNaN(custom) ? base : custom;
    },
    [sellingPricesIdent],
  );

  const subtotal = useMemo(
    () =>
      selectedItemsList.reduce(
        (sum, { item, quantity }) => sum + getEffectivePrice(item) * quantity,
        0,
      ) +
      identifierGroups.reduce((sum, g) => sum + getEffectivePriceIdentGroup(g) * g.units.length, 0),
    [selectedItemsList, getEffectivePrice, identifierGroups, getEffectivePriceIdentGroup],
  );

  const hstRate = percentToRate(Math.max(0, parseFloat(hstPercent) || 0));
  const hstAmount = subtotal * hstRate;
  const total = subtotal + hstAmount;

  // ── Step 1 handlers ───────────────────────────────────────────────────────
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

  // ── Step 2 handlers ───────────────────────────────────────────────────────
  const handleGoToStep2 = async () => {
    if (selectedItemsList.length > 0) {
      setIdentifiersLoading(true);
      try {
        const existingScannedIds = new Set(identifierUnitsFlat.map((u) => u.inventoryIdentifierId));
        const result: Record<string, AvailableIdentifierUnit[]> = {};
        for (const { item } of selectedItemsList) {
          const { data } = await (supabase.from("inventory_identifiers") as any)
            .select("id, imei, serial_number, color")
            .eq("inventory_id", item.id)
            .in("status", ["in_stock", "reserved"]);
          result[item.id] = ((data ?? []) as Record<string, unknown>[])
            .filter((row) => !existingScannedIds.has(String(row.id)))
            .map((row) => ({
              id: String(row.id),
              imei: (row.imei as string | null) ?? null,
              serialNumber: (row.serial_number as string | null) ?? null,
              color: (row.color as string | null) ?? null,
              displayLabel: String(row.imei ?? row.serial_number ?? row.id),
            }));
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
      // No browse selections (edit mode hydration or direct-scan only) — skip IMEI step
      const identPrices: Record<string, string> = {};
      identifierGroups.forEach((g) => {
        identPrices[g.inventoryId] = String(g.item.sellingPrice ?? g.item.pricePerUnit);
      });
      setSellingPricesIdent(identPrices);
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
    // Convert pending selections → identifierGroups
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
    setIdentifierGroups((prev) => {
      const next = [...prev];
      newGroupsMap.forEach((group) => {
        const idx = next.findIndex((g) => g.inventoryId === group.inventoryId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], units: [...next[idx].units, ...group.units] };
        } else {
          next.push(group);
        }
      });
      return next;
    });
    setSelectedItems({});
    setPendingImeiSelections({});
    // Init selling prices for all groups (including newly added)
    const identPrices: Record<string, string> = {};
    identifierGroups.forEach((g) => {
      identPrices[g.inventoryId] = String(g.item.sellingPrice ?? g.item.pricePerUnit);
    });
    newGroupsMap.forEach((g) => {
      identPrices[g.inventoryId] = String(g.item.sellingPrice ?? g.item.pricePerUnit);
    });
    setSellingPricesIdent(identPrices);
    setStep(3);
  };

  const handleSellingPriceChange = (itemId: string, value: string) => {
    setSellingPrices((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSellingPriceBlur = (itemId: string) => {
    const item = selectedItems[itemId]?.item;
    if (!item) return;
    const listPrice = item.sellingPrice ?? item.pricePerUnit;
    const entered = parseFloat(sellingPrices[itemId] ?? "");
    if (isNaN(entered) || entered < listPrice) {
      setSellingPrices((prev) => ({ ...prev, [itemId]: String(listPrice) }));
    }
  };

  const handleSellingPriceChangeIdent = (inventoryId: string, value: string) => {
    setSellingPricesIdent((prev) => ({ ...prev, [inventoryId]: value }));
  };

  const handleSellingPriceBlurIdent = (group: IdentifierScanGroup) => {
    const listPrice = group.item.sellingPrice ?? group.item.pricePerUnit;
    const entered = parseFloat(sellingPricesIdent[group.inventoryId] ?? "");
    if (isNaN(entered) || entered < listPrice) {
      setSellingPricesIdent((prev) => ({
        ...prev,
        [group.inventoryId]: String(listPrice),
      }));
    }
  };

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

    /**
     * Always validate via DB so we catch stale map entries (e.g. a unit sold
     * moments ago whose realtime event hasn't arrived yet). The map is kept for
     * the IMEI assignment panel; the scan step must have authoritative status.
     */
    const resolveIdentifier = async (raw: string) => {
      return lookupIdentifierForSale(raw, lookupOpts);
    };

    setIdentifierLookupLoading(true);
    try {
      if (queries.length === 1) {
        // ── Single IMEI — map-first then DB fallback ────────────────────
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
        // ── Multiple comma-separated IMEIs — batch lookup ───────────────
        type BatchResult = {
          found: NonNullable<Awaited<ReturnType<typeof lookupIdentifierForSale>>>;
          unit: ScannedIdentifierUnit;
        };

        const results: BatchResult[] = [];
        const notFound: string[] = [];
        const duplicates: string[] = [];
        const failed: string[] = [];
        // Track IDs added within this batch to catch intra-batch duplicates
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
          // Count additions per inventoryId to adjust browse caps
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
        if (notFound.length > 0) {
          toast.error(`Not found: ${notFound.join(", ")}`);
        }
        if (duplicates.length > 0) {
          toast.error(`Already in sale: ${duplicates.join(", ")}`);
        }
        if (failed.length > 0) {
          toast.error(`Lookup failed for: ${failed.join(", ")}`);
        }
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

  const handleGoToStep4 = () => {
    // Validate selling prices — none can be below list price
    for (const { item } of selectedItemsList) {
      const listPrice = item.sellingPrice ?? item.pricePerUnit;
      const entered = parseFloat(sellingPrices[item.id] ?? "");
      if (isNaN(entered) || entered < listPrice) {
        toast.error(
          `Selling price for ${item.deviceName} cannot be below $${listPrice.toFixed(2)}.`,
        );
        return;
      }
    }
    for (const g of identifierGroups) {
      const listPrice = g.item.sellingPrice ?? g.item.pricePerUnit;
      const entered = parseFloat(sellingPricesIdent[g.inventoryId] ?? "");
      if (isNaN(entered) || entered < listPrice) {
        toast.error(
          `Selling price for ${g.item.deviceName} (scanned) cannot be below $${listPrice.toFixed(2)}.`,
        );
        return;
      }
    }
    setStep(4);
  };

  // ── Step 3 handlers ───────────────────────────────────────────────────────
  // ── Reset / Close ─────────────────────────────────────────────────────────
  const handleClose = () => {
    setStep(1);
    setSearchQuery("");
    setSelectedItems({});
    setIdentifierQuery("");
    setIdentifierGroups([]);
    setSellingPricesIdent({});
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const hasLines = selectedItemsList.length > 0 || identifierUnitsFlat.length > 0;
    if (!user?.id || !hasLines || !customerName.trim() || !paymentMethod) return;

    setIsSubmitting(true);
    try {
      const orderItems: OrderItem[] = [
        ...selectedItemsList.map(({ item, quantity }) => ({
          item: { ...item, sellingPrice: getEffectivePrice(item) },
          quantity,
        })),
        ...identifierGroups.flatMap((g) =>
          g.units.map((u) => ({
            item: { ...g.item, sellingPrice: getEffectivePriceIdentGroup(g) },
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
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
        queryClient.invalidateQueries({ queryKey: queryKeys.orders });
        queryClient.invalidateQueries({ queryKey: queryKeys.userOrdersBase });
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

      for (const oi of orderItems) {
        if (oi.inventoryIdentifierId) {
          try {
            await markInventoryIdentifierSold(oi.inventoryIdentifierId);
          } catch (identErr) {
            toastError(identErr, "Identifier update failed");
            throw identErr;
          }
        }
        try {
          await decreaseQuantity(oi.item.id, oi.quantity);
        } catch (qtyErr) {
          if (oi.inventoryIdentifierId) {
            await revertInventoryIdentifierSold(oi.inventoryIdentifierId);
          }
          throw qtyErr;
        }
      }

      toast.success(`Sale recorded — Order #${order.id.slice(-8).toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.userOrdersBase });
      handleClose();
    } catch {
      toast.error(
        isEdit
          ? "Failed to update manual sale. Please try again."
          : "Failed to record sale. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      {isPage ? (
        <div className="px-6 pt-4 pb-3 border-b border-border flex-shrink-0">
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary shrink-0" aria-hidden />
            {isEdit ? "Edit Manual Sale" : "Record Manual Sale"}
          </h1>
          <ManualSaleStepIndicator step={step} />
        </div>
      ) : (
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary shrink-0" aria-hidden />
            {isEdit ? "Edit Manual Sale" : "Record Manual Sale"}
          </DialogTitle>
          <ManualSaleStepIndicator step={step} />
        </DialogHeader>
      )}

      {/* ── STEP 1: Select Items ──────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Two-column split on desktop */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row md:divide-x md:divide-border overflow-hidden">
            {/* Left panel: IMEI / serial scanner */}
            <div className="md:w-[38%] flex flex-col overflow-hidden border-b border-border md:border-b-0 flex-shrink-0">
              {/* Sticky: header + input */}
              <div className="flex-shrink-0 px-5 pt-4 pb-3 space-y-3 border-b border-border/60 bg-card">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ScanLine className="h-4 w-4 text-primary" aria-hidden />
                    Sell by IMEI or serial
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Exact match only. Must be in stock. Paste comma-separated IMEIs to add multiple
                    at once.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="IMEI / serial — or paste multiple comma-separated"
                    value={identifierQuery}
                    onChange={(e) => setIdentifierQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleIdentifierLookup();
                      }
                    }}
                    aria-label="IMEI or serial number"
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 gap-1.5 px-3"
                    disabled={identifierLookupLoading}
                    onClick={() => void handleIdentifierLookup()}
                  >
                    {identifierLookupLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ScanLine className="h-3.5 w-3.5" />
                    )}
                    Find
                  </Button>
                </div>
              </div>

              {/* Scrollable: scanned units list */}
              <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3">
                {identifierGroups.length > 0 ? (
                  <ul className="space-y-2">
                    {identifierGroups.map((group) => (
                      <li
                        key={group.inventoryId}
                        className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm space-y-2"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">
                            {group.item.deviceName}
                          </p>
                          <ClickableGradeBadge
                            grade={group.item.grade}
                            inventoryId={group.item.id}
                            deviceName={group.item.deviceName}
                          />
                          <span className="text-xs font-semibold text-primary tabular-nums ml-auto">
                            Qty {group.units.length}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground -mt-1">
                          {group.item.brand} · {group.item.storage}
                        </p>
                        <ul className="space-y-1 border-t border-border/60 pt-2">
                          {group.units.map((unit) => (
                            <li
                              key={unit.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="font-mono text-foreground truncate">
                                  {unit.displayLabel}
                                </span>
                                {unit.color && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">
                                    {unit.color}
                                  </span>
                                )}
                                {unit.damageNote && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-medium border border-destructive/20 shrink-0 max-w-[160px] truncate"
                                    title={unit.damageNote}
                                  >
                                    ⚠ {unit.damageNote}
                                  </span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  handleRemoveIdentifierUnit(group.inventoryId, unit.id)
                                }
                                aria-label={`Remove scanned unit ${unit.displayLabel}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-muted-foreground/50 text-center py-8">
                      No units scanned yet.
                      <br />
                      Enter an IMEI or serial above.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: Browse inventory */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Sticky: search input */}
              <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border/60 bg-card">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by device, brand, or storage..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
              </div>

              {/* Scrollable: inventory list */}
              <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-2">
                {availableItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No items available in inventory.
                  </p>
                ) : (
                  availableItems.map((item) => {
                    const effStock = getEffectiveStock(item);
                    const scannedForSku = scannedUnitsByInventoryId[item.id] ?? 0;
                    const browseMax = getBrowseMaxQty(item);
                    const isSelected = !!selectedItems[item.id];
                    const selected = selectedItems[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(item)}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-colors select-none",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                              isSelected ? "bg-primary border-primary" : "border-muted-foreground",
                            )}
                          >
                            {isSelected && (
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground">
                                {item.deviceName}
                              </p>
                              <ClickableGradeBadge
                                grade={item.grade}
                                inventoryId={item.id}
                                deviceName={item.deviceName}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.brand} • {item.storage}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {scannedForSku > 0
                                ? `${browseMax} available for browse (${scannedForSku} scanned, ${effStock} in stock)`
                                : `${effStock} in stock`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-sm text-foreground">
                              {formatPrice(item.sellingPrice ?? item.pricePerUnit)}
                            </p>
                            <p className="text-xs text-muted-foreground">per unit</p>
                          </div>
                        </div>

                        {isSelected && (
                          <div
                            className="mt-3 flex items-center gap-3 pt-3 border-t border-primary/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-xs text-muted-foreground">Qty:</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleQuantityChange(item.id, -1)}
                                disabled={selected.quantity <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                max={browseMax}
                                value={selected.quantity}
                                onChange={(e) =>
                                  handleQuantityInput(item.id, e.target.value, browseMax)
                                }
                                onBlur={(e) => {
                                  const parsed = parseInt(e.target.value, 10);
                                  if (isNaN(parsed) || parsed < 1)
                                    handleQuantityInput(item.id, "1", browseMax);
                                }}
                                className="h-7 w-16 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleQuantityChange(item.id, 1)}
                                disabled={selected.quantity >= browseMax}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="text-xs text-muted-foreground ml-auto">
                              ={" "}
                              {formatPrice(
                                (item.sellingPrice ?? item.pricePerUnit) * selected.quantity,
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer bar — full width */}
          <div className="flex-shrink-0 border-t border-border px-5 py-3 flex items-center justify-between gap-4 bg-card">
            <p className="text-sm text-muted-foreground">
              {selectedItemsList.length > 0 || scannedUnitCount > 0 ? (
                <span className="font-medium text-foreground">
                  {selectedItemsList.length > 0 && `${selectedItemsList.length} browse line(s)`}
                  {selectedItemsList.length > 0 && scannedUnitCount > 0 && ", "}
                  {scannedUnitCount > 0 && `${scannedUnitCount} scanned unit(s)`}
                  {" — "}
                  subtotal {formatPrice(subtotal)}
                </span>
              ) : (
                "No items selected"
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                disabled={selectedItemsList.length === 0 && scannedUnitCount === 0}
                onClick={() => void handleGoToStep2()}
              >
                {selectedItemsList.length > 0 ? "Next: Assign IMEIs →" : "Next: Selling Price →"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Assign IMEIs ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border/60 bg-card">
            <p className="text-sm text-muted-foreground">
              Select the specific units (by IMEI or serial) for each item. You must select exactly
              the quantity chosen in the previous step.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
            {identifiersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              selectedItemsList.map(({ item, quantity }) => {
                const available = availableIdentifiers[item.id] ?? [];
                const selected = pendingImeiSelections[item.id] ?? [];
                const isComplete = selected.length === quantity;

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-card overflow-hidden"
                  >
                    {/* Device header */}
                    <div
                      className={cn(
                        "px-4 py-3 flex items-center justify-between gap-3 border-b border-border",
                        isComplete ? "bg-primary/5" : "bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{item.deviceName}</p>
                        <ClickableGradeBadge
                          grade={item.grade}
                          inventoryId={item.id}
                          deviceName={item.deviceName}
                        />
                        <span className="text-xs text-muted-foreground">
                          {item.brand} · {item.storage}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full",
                            isComplete
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {selected.length} / {quantity} selected
                        </span>
                      </div>
                    </div>

                    {/* Units list */}
                    {available.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-destructive font-medium">
                          No available units found for this device.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ensure units are in stock with IMEI/serial numbers assigned.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {available.map((unit) => {
                          const isSelected = selected.includes(unit.id);
                          const isDisabled = !isSelected && selected.length >= quantity;
                          return (
                            <label
                              key={unit.id}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none",
                                isSelected
                                  ? "bg-primary/5"
                                  : isDisabled
                                    ? "opacity-40"
                                    : "hover:bg-muted/40",
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                disabled={isDisabled}
                                onCheckedChange={() =>
                                  handleTogglePendingImei(item.id, unit.id, quantity)
                                }
                                aria-label={`Select unit ${unit.displayLabel}`}
                              />
                              <span className="font-mono text-sm text-foreground flex-1 truncate">
                                {unit.displayLabel}
                              </span>
                              {unit.color && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                                  {unit.color}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-5 py-3 flex items-center justify-between gap-4 bg-card">
            <p className="text-sm text-muted-foreground">
              {selectedItemsList.every(
                ({ item, quantity }) => (pendingImeiSelections[item.id] ?? []).length === quantity,
              ) ? (
                <span className="text-primary font-medium">All units assigned</span>
              ) : (
                "Assign IMEIs for all items to continue"
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPendingImeiSelections({});
                  setAvailableIdentifiers({});
                  setStep(1);
                }}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                disabled={
                  identifiersLoading ||
                  !selectedItemsList.every(
                    ({ item, quantity }) =>
                      (pendingImeiSelections[item.id] ?? []).length === quantity,
                  )
                }
                onClick={handleGoToStep3FromImei}
              >
                Next: Selling Price →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Selling Price ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col flex-1 min-h-0 px-5 py-3 gap-3">
          <p className="text-sm text-muted-foreground flex-shrink-0">
            Set the selling price for each line. You cannot go below the inventory list price.
          </p>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 -mx-1 px-1">
            {selectedItemsList.map(({ item, quantity }) => {
              const listPrice = item.sellingPrice ?? item.pricePerUnit;
              const priceStr = sellingPrices[item.id] ?? String(listPrice);
              const parsedPrice = parseFloat(priceStr);
              const lineTotal = isNaN(parsedPrice) ? 0 : parsedPrice * quantity;
              const isBelowMin = !isNaN(parsedPrice) && parsedPrice < listPrice;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card p-4 space-y-3"
                >
                  {/* Item header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{item.deviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.brand} · {item.storage} · Qty {quantity}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground text-right flex-shrink-0">
                      List price (minimum):{" "}
                      <span className="font-semibold text-destructive">
                        {formatPrice(listPrice)}
                      </span>
                    </p>
                  </div>

                  {/* Price input */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Selling price per unit (CAD)</Label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-sm text-muted-foreground select-none pointer-events-none">
                        $
                      </span>
                      <Input
                        type="number"
                        min={listPrice}
                        step="0.01"
                        value={priceStr}
                        onChange={(e) => handleSellingPriceChange(item.id, e.target.value)}
                        onBlur={() => handleSellingPriceBlur(item.id)}
                        className={cn(
                          "pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          isBelowMin && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                    </div>
                    {isBelowMin && (
                      <p className="text-xs text-destructive">
                        Cannot be below the list price of {formatPrice(listPrice)}.
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Line total:{" "}
                    <span className="font-semibold text-foreground">{formatPrice(lineTotal)}</span>
                  </p>
                </div>
              );
            })}

            {identifierGroups.map((group) => {
              const listPrice = group.item.sellingPrice ?? group.item.pricePerUnit;
              const priceStr = sellingPricesIdent[group.inventoryId] ?? String(listPrice);
              const parsedPrice = parseFloat(priceStr);
              const qty = group.units.length;
              const lineTotal = isNaN(parsedPrice) ? 0 : parsedPrice * qty;
              const isBelowMin = !isNaN(parsedPrice) && parsedPrice < listPrice;

              return (
                <div
                  key={group.inventoryId}
                  className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">
                          {group.item.deviceName}
                        </p>
                        <ClickableGradeBadge
                          grade={group.item.grade}
                          inventoryId={group.item.id}
                          deviceName={group.item.deviceName}
                        />
                        <span className="text-xs font-medium text-foreground">
                          Scanned qty: {qty}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {group.item.brand} · {group.item.storage} · per-unit price applies to all
                        scanned units in this line
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground text-right flex-shrink-0">
                      List price (minimum):{" "}
                      <span className="font-semibold text-destructive">
                        {formatPrice(listPrice)}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Selling price per unit (CAD)</Label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-sm text-muted-foreground select-none pointer-events-none">
                        $
                      </span>
                      <Input
                        type="number"
                        min={listPrice}
                        step="0.01"
                        value={priceStr}
                        onChange={(e) =>
                          handleSellingPriceChangeIdent(group.inventoryId, e.target.value)
                        }
                        onBlur={() => handleSellingPriceBlurIdent(group)}
                        className={cn(
                          "pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          isBelowMin && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                    </div>
                    {isBelowMin && (
                      <p className="text-xs text-destructive">
                        Cannot be below the list price of {formatPrice(listPrice)}.
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Line total:{" "}
                    <span className="font-semibold text-foreground">{formatPrice(lineTotal)}</span>
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-4 bg-card">
            <p className="text-sm font-medium text-foreground">Subtotal {formatPrice(subtotal)}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleGoToStep4}>Next: Customer Details →</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: Customer & Payment ────────────────────────────────── */}
      {step === 4 && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Two-column split on desktop */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] md:divide-x md:divide-border min-h-full">
              {/* Left column: customer form */}
              <div className="px-5 py-4 space-y-4">
                {/* Customer info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Customer Information</h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="customerName">
                        Customer Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="customerName"
                        placeholder="e.g. John Doe or ABC Electronics"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="customerEmail">
                          Email <span className="text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="customerEmail"
                          type="email"
                          placeholder="email@example.com"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="customerPhone">
                          Phone <span className="text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-sm text-muted-foreground select-none pointer-events-none">
                            +1
                          </span>
                          <Input
                            id="customerPhone"
                            type="tel"
                            placeholder="(416) 555-0000"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Address{" "}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="billingAddress">Billing Address</Label>
                    <Textarea
                      id="billingAddress"
                      placeholder="123 Main St, City, Province, Postal Code"
                      value={billingAddress}
                      onChange={(e) => {
                        setBillingAddress(e.target.value);
                        if (!e.target.value.trim()) setSameAsShipping(false);
                      }}
                      className="min-h-[60px] resize-none"
                    />
                  </div>
                  {billingAddress.trim() && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sameAsShipping"
                        checked={sameAsShipping}
                        onCheckedChange={(checked) => setSameAsShipping(!!checked)}
                      />
                      <Label
                        htmlFor="sameAsShipping"
                        className="text-sm font-normal text-muted-foreground cursor-pointer"
                      >
                        Use same address for shipping
                      </Label>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="shippingAddress">Shipping Address</Label>
                    {sameAsShipping ? (
                      <div className="px-3 py-2 min-h-[60px] rounded-md border border-border bg-muted/40 text-sm text-muted-foreground whitespace-pre-wrap">
                        {billingAddress}
                      </div>
                    ) : (
                      <Textarea
                        id="shippingAddress"
                        placeholder="123 Main St, City, Province, Postal Code"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        className="min-h-[60px] resize-none"
                      />
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="saleNotes">
                    Notes <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="saleNotes"
                    placeholder="Any additional details about this sale..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[70px] resize-none"
                  />
                </div>
              </div>

              {/* Right column: payment + order summary */}
              <div className="px-5 py-4 space-y-4 bg-muted/20">
                {/* Payment */}
                <div className="space-y-1.5">
                  <Label>
                    Payment Method <span className="text-destructive">*</span>
                  </Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {PAYMENT_METHOD_LABELS[value] ?? value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* HST */}
                <div className="space-y-1.5">
                  <Label htmlFor="hstPercent">
                    HST / Tax Rate <span className="text-xs text-muted-foreground">(%)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="hstPercent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="e.g. 13"
                      value={hstPercent}
                      onChange={(e) => setHstPercent(e.target.value)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                      %
                    </span>
                  </div>
                </div>

                {/* Order summary */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
                  <div className="space-y-1.5">
                    {selectedItemsList.map(({ item, quantity }) => (
                      <div key={`browse-${item.id}`} className="flex justify-between text-sm gap-2">
                        <span className="text-muted-foreground truncate">
                          {item.deviceName} {item.storage} × {quantity}
                        </span>
                        <span className="font-medium text-foreground tabular-nums flex-shrink-0">
                          {formatPrice(getEffectivePrice(item) * quantity)}
                        </span>
                      </div>
                    ))}
                    {identifierGroups.map((group) => (
                      <div key={group.inventoryId} className="flex justify-between text-sm gap-2">
                        <span className="text-muted-foreground truncate">
                          {group.item.deviceName} {group.item.storage} × {group.units.length}{" "}
                          (scanned)
                        </span>
                        <span className="font-medium text-foreground tabular-nums flex-shrink-0">
                          {formatPrice(getEffectivePriceIdentGroup(group) * group.units.length)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-2.5 space-y-1.5">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>HST ({parseFloat(hstPercent) || 0}%)</span>
                      <span className="tabular-nums">{formatPrice(hstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold pt-1 border-t border-border">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground tabular-nums">{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-4 bg-card">
            <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              disabled={!customerName.trim() || !paymentMethod || isSubmitting}
              onClick={handleSubmit}
              className="gap-2 min-w-[148px] justify-center"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                  <span>Recording sale…</span>
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Record Sale"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
