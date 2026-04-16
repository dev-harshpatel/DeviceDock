"use client";

import { KeyboardEvent, useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Loader2, Package, Info, Palette } from "lucide-react";
import { ColourBreakdownDialog, type ColourRow } from "@/components/modals/ColourBreakdownDialog";
import {
  ImeiColorMappingDialog,
  type IdentifierEntry,
  type ColorBudget,
  type ImeiColorMapping,
} from "@/components/modals/ImeiColorMappingDialog";
import { toast } from "sonner";
import { toastError } from "@/lib/utils/toast-helpers";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { calculatePricePerUnit } from "@/data/inventory";
import type { InventoryItem } from "@/data/inventory";
import { parseIdentifierList } from "@/lib/inventory/parse-identifier-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useInventory } from "@/contexts/InventoryContext";
import { useAuth } from "@/lib/auth/context";
import { useCompany } from "@/contexts/CompanyContext";
import { createNotificationEvent } from "@/lib/notifications/client";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";
import { supabase } from "@/lib/supabase/client";
import {
  type Grade,
  GRADES,
  GRADE_BADGE_LABELS,
  GRADE_LABELS,
  GRADE_STYLES,
} from "@/lib/constants/grades";
import { BulkModePanel } from "@/components/modals/BulkModePanel";
import { MergePreviewCard } from "@/components/modals/MergePreviewCard";
import { ProductSearchCombobox } from "@/components/modals/ProductSearchCombobox";

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pre-select an existing inventory item (e.g. from Demand page restock flow) */
  initialItemId?: string;
  /** Called after a successful restock of an existing item */
  onRestockComplete?: (itemId: string) => void;
}

interface ProductForm {
  deviceName: string;
  brand: string;
  grade: Grade | "";
  storage: string;
  quantity: string;
  purchasePrice: string;
  hst: string;
  sellingPrice: string;
  imei: string;
  serialNumber: string;
}

type BulkRowStatus = "pending" | "valid" | "invalid";

interface BulkScanRow {
  id: string;
  identifier: string;
  imei: string | null;
  serialNumber: string | null;
  status: BulkRowStatus;
  reason?: string;
}

const defaultForm: ProductForm = {
  deviceName: "",
  brand: "",
  grade: "",
  storage: "",
  quantity: "",
  purchasePrice: "",
  hst: "13",
  sellingPrice: "",
  imei: "",
  serialNumber: "",
};

export function AddProductModal({
  open,
  onOpenChange,
  onSuccess,
  initialItemId,
  onRestockComplete,
}: AddProductModalProps) {
  const { inventory, updateProduct, bulkInsertProducts, addInventoryIdentifier } = useInventory();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colourDialogOpen, setColourDialogOpen] = useState(false);
  const [existingColorRows, setExistingColorRows] = useState<ColourRow[]>([]);
  const [isLoadingExistingColors, setIsLoadingExistingColors] = useState(false);
  /** Authoritative quantity from DB when restocking — context can lag behind React Query on the inventory page. */
  const [liveInventoryQuantity, setLiveInventoryQuantity] = useState<number | null>(null);
  const [suggestedColors, setSuggestedColors] = useState<string[]>([]);
  // IMEI-to-color mapping dialog state
  const [imeiColorMappingOpen, setImeiColorMappingOpen] = useState(false);
  const [pendingColorRows, setPendingColorRows] = useState<ColourRow[]>([]);

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [step, setStep] = useState<"form" | "review">("form");
  const [bulkRows, setBulkRows] = useState<BulkScanRow[]>([]);
  const [bulkScanInput, setBulkScanInput] = useState("");
  const [isBulkReviewing, setIsBulkReviewing] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  const imeiList = useMemo(() => parseIdentifierList(form.imei), [form.imei]);
  const serialList = useMemo(() => parseIdentifierList(form.serialNumber), [form.serialNumber]);
  const totalIdentifierCount = imeiList.length + serialList.length;
  const hasIdentifier = totalIdentifierCount > 0;

  // Fetch all unique colors used by same device type (brand + deviceName) for suggestions
  useEffect(() => {
    if (!colourDialogOpen || !form.brand.trim() || !form.deviceName.trim()) {
      setSuggestedColors([]);
      return;
    }

    const sameDeviceIds = inventory
      .filter((i) => i.brand === form.brand && i.deviceName === form.deviceName)
      .map((i) => i.id);

    if (sameDeviceIds.length === 0) {
      setSuggestedColors([]);
      return;
    }

    (supabase as any)
      .from("inventory_colors")
      .select("color")
      .in("inventory_id", sameDeviceIds)
      .then(({ data }: { data: Array<{ color: string }> | null }) => {
        const unique = [...new Set((data ?? []).map((r) => r.color))].sort();
        setSuggestedColors(unique);
      })
      .catch(() => setSuggestedColors([]));
  }, [colourDialogOpen, form.brand, form.deviceName, inventory]);

  // When adding a unit to an existing device (any case), pre-load its colour breakdown
  // so the dialog shows the full picture and a full replace is applied on save.
  useEffect(() => {
    if (!colourDialogOpen || !selectedExistingId) {
      setIsLoadingExistingColors(false);
      return;
    }

    setIsLoadingExistingColors(true);
    (supabase as any)
      .from("inventory_colors")
      .select("color, quantity")
      .eq("inventory_id", selectedExistingId)
      .order("color")
      .then(({ data }: { data: Array<{ color: string; quantity: number }> | null }) => {
        setExistingColorRows(
          (data ?? []).map((r) => ({ color: r.color, quantity: String(r.quantity) })),
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to load existing colors:", error);
      })
      .finally(() => {
        setIsLoadingExistingColors(false);
      });
  }, [colourDialogOpen, selectedExistingId]);

  // Pre-select item when initialItemId is provided (e.g. from Demand restock flow)
  useEffect(() => {
    if (open && initialItemId) {
      const item = inventory.find((i) => i.id === initialItemId);
      if (item) {
        handleSelectExisting(item);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItemId]);

  const selectedExisting = useMemo(
    () =>
      selectedExistingId ? (inventory.find((i) => i.id === selectedExistingId) ?? null) : null,
    [inventory, selectedExistingId],
  );

  useEffect(() => {
    if (!open || !selectedExistingId || !companyId) {
      setLiveInventoryQuantity(null);
      return;
    }

    let cancelled = false;

    const loadLiveQuantity = async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("id", selectedExistingId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[AddProductModal] Live quantity fetch failed:", error);
        setLiveInventoryQuantity(null);
        return;
      }

      const quantity = (data as { quantity?: number } | null)?.quantity;
      setLiveInventoryQuantity(typeof quantity === "number" ? quantity : null);
    };

    void loadLiveQuantity();

    return () => {
      cancelled = true;
    };
  }, [open, selectedExistingId, companyId]);

  const selectedExistingEffective = useMemo((): InventoryItem | null => {
    if (!selectedExisting) return null;
    if (liveInventoryQuantity === null) return selectedExisting;
    return { ...selectedExisting, quantity: liveInventoryQuantity };
  }, [selectedExisting, liveInventoryQuantity]);

  const isLegacyRestock = Boolean(selectedExisting && !hasIdentifier);
  const newQuantity = Number(form.quantity) || 0;
  const enteredQuantity = newQuantity;
  const effectiveQuantity = newQuantity;
  const newPurchasePrice = Number(form.purchasePrice) || 0;
  const hstValue = Number(form.hst) || 0;
  const sellingPrice = Number(form.sellingPrice) || 0;
  // IMEI/Serial fields appear above Quantity; until quantity is entered, do not treat as a mismatch.
  const identifierCountMatchesQuantity =
    !hasIdentifier || enteredQuantity <= 0 || totalIdentifierCount === enteredQuantity;
  const hasDuplicateIdentifiers = useMemo(() => {
    const normalized = [...imeiList, ...serialList].map((identifier) => identifier.toLowerCase());
    return new Set(normalized).size !== normalized.length;
  }, [imeiList, serialList]);

  /** One physical unit should be identified in one field only; both columns = two units. */
  const warnBothImeiAndSerialForSingleQuantity =
    enteredQuantity === 1 && imeiList.length > 0 && serialList.length > 0;

  // Weighted-average merge preview when restocking an existing product.
  const mergePreview = useMemo(() => {
    if (!selectedExistingEffective || newQuantity <= 0 || newPurchasePrice <= 0) return null;
    const isOutOfStock = selectedExistingEffective.quantity === 0;
    const totalQty = isOutOfStock ? newQuantity : selectedExistingEffective.quantity + newQuantity;
    const totalPP = isOutOfStock
      ? newPurchasePrice
      : (selectedExistingEffective.purchasePrice ?? 0) + newPurchasePrice;
    const avgPricePerUnit = calculatePricePerUnit(totalPP, totalQty, hstValue);
    return { totalQty, totalPP, avgPricePerUnit, isOutOfStock };
  }, [selectedExistingEffective, newQuantity, newPurchasePrice, hstValue]);

  // Price/unit preview for a brand-new product
  const computedPricePerUnit = useMemo(() => {
    if (!newPurchasePrice || !newQuantity) return null;
    return calculatePricePerUnit(newPurchasePrice, newQuantity, hstValue);
  }, [newPurchasePrice, newQuantity, hstValue]);

  const handleSelectExisting = useCallback((item: InventoryItem) => {
    setSelectedExistingId(item.id);
    setForm({
      deviceName: item.deviceName,
      brand: item.brand,
      grade: item.grade,
      storage: item.storage,
      quantity: "",
      purchasePrice: "",
      hst: item.hst?.toString() ?? "13",
      sellingPrice: item.sellingPrice.toString(),
      imei: "",
      serialNumber: "",
    });
    setComboboxOpen(false);
  }, []);

  const handleClearSelection = () => {
    setSelectedExistingId(null);
    setForm(defaultForm);
  };

  const handleField = (field: keyof ProductForm, value: string) => {
    if (field === "deviceName" && selectedExistingId) {
      setSelectedExistingId(null);
    }
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Keep quantity in sync with identifier count so the user doesn't have to type it manually.
      if (field === "imei" || field === "serialNumber") {
        const newImeiList = parseIdentifierList(field === "imei" ? value : prev.imei);
        const newSerialList = parseIdentifierList(
          field === "serialNumber" ? value : prev.serialNumber,
        );
        const totalCount = newImeiList.length + newSerialList.length;
        updated.quantity = totalCount > 0 ? String(totalCount) : "";
      }
      return updated;
    });
  };

  const isFormValid = Boolean(
    form.deviceName.trim() &&
    form.brand.trim() &&
    form.grade &&
    form.storage.trim() &&
    effectiveQuantity > 0 &&
    newPurchasePrice > 0 &&
    sellingPrice > 0 &&
    identifierCountMatchesQuantity &&
    !hasDuplicateIdentifiers,
  );

  const isBulkConfigValid = Boolean(
    form.deviceName.trim() &&
    form.brand.trim() &&
    form.grade &&
    form.storage.trim() &&
    newPurchasePrice > 0 &&
    sellingPrice > 0,
  );

  const normalizedIdentifierSet = useMemo(
    () => new Set(bulkRows.map((row) => row.identifier.toLowerCase())),
    [bulkRows],
  );

  const getIdentifierType = useCallback(
    (rawValue: string): { imei: string | null; serialNumber: string | null } => {
      const normalizedValue = rawValue.trim();
      if (!normalizedValue) return { imei: null, serialNumber: null };

      const onlyDigits = /^\d+$/.test(normalizedValue);
      const isImeiLike = onlyDigits && normalizedValue.length >= 14 && normalizedValue.length <= 17;

      if (isImeiLike) {
        return { imei: normalizedValue, serialNumber: null };
      }

      return { imei: null, serialNumber: normalizedValue };
    },
    [],
  );

  const addBulkIdentifier = useCallback(
    (rawValue: string) => {
      const normalizedValue = rawValue.trim();
      if (!normalizedValue) {
        return;
      }

      if (normalizedIdentifierSet.has(normalizedValue.toLowerCase())) {
        toast.error(`Duplicate scan ignored: ${normalizedValue}`);
        return;
      }

      const typedIdentifier = getIdentifierType(normalizedValue);
      if (!typedIdentifier.imei && !typedIdentifier.serialNumber) {
        toast.error("Invalid identifier. Scan IMEI or Serial Number.");
        return;
      }

      const nextRow: BulkScanRow = {
        id: crypto.randomUUID(),
        identifier: normalizedValue,
        imei: typedIdentifier.imei,
        serialNumber: typedIdentifier.serialNumber,
        status: "pending",
      };

      setBulkRows((prev) => [nextRow, ...prev]);
      setBulkScanInput("");
      setBulkSummary(null);
    },
    [getIdentifierType, normalizedIdentifierSet],
  );

  const handleBulkScanSubmit = useCallback(() => {
    addBulkIdentifier(bulkScanInput);
  }, [addBulkIdentifier, bulkScanInput]);

  const handleBulkScanKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleBulkScanSubmit();
    },
    [handleBulkScanSubmit],
  );

  const handleRemoveBulkRow = useCallback((rowId: string) => {
    setBulkRows((prev) => prev.filter((row) => row.id !== rowId));
    setBulkSummary(null);
  }, []);

  const handleResetBulkRows = useCallback(() => {
    setBulkRows([]);
    setBulkScanInput("");
    setBulkSummary(null);
  }, []);

  const runBulkValidation = useCallback(async (): Promise<BulkScanRow[]> => {
    if (!companyId) {
      throw new Error("No active company context");
    }

    if (!bulkRows.length) {
      throw new Error("Please scan at least one IMEI/Serial Number for bulk add.");
    }

    const nextRows: BulkScanRow[] = [];
    const seen = new Set<string>();

    for (const row of bulkRows) {
      const dedupeKey = row.identifier.toLowerCase();
      if (seen.has(dedupeKey)) {
        nextRows.push({ ...row, status: "invalid", reason: "Duplicate in current bulk list" });
        continue;
      }
      seen.add(dedupeKey);
      nextRows.push({ ...row, status: "valid", reason: undefined });
    }

    const imeis = nextRows
      .filter((row) => row.status === "valid" && row.imei)
      .map((row) => row.imei as string);
    const serialNumbers = nextRows
      .filter((row) => row.status === "valid" && row.serialNumber)
      .map((row) => row.serialNumber as string);

    const existingImeiSet = new Set<string>();
    const existingSerialSet = new Set<string>();

    if (imeis.length) {
      const { data, error } = await (supabase as any)
        .from("inventory")
        .select("imei")
        .eq("company_id", companyId)
        .in("imei", imeis);

      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{ imei: string | null }>) {
        if (row.imei) existingImeiSet.add(row.imei.toLowerCase());
      }
    }

    if (serialNumbers.length) {
      const { data, error } = await (supabase as any)
        .from("inventory")
        .select("serial_number")
        .eq("company_id", companyId)
        .in("serial_number", serialNumbers);

      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{ serial_number: string | null }>) {
        if (row.serial_number) existingSerialSet.add(row.serial_number.toLowerCase());
      }
    }

    return nextRows.map((row) => {
      if (row.status === "invalid") return row;

      if (row.imei && existingImeiSet.has(row.imei.toLowerCase())) {
        return { ...row, status: "invalid", reason: "IMEI already exists in inventory" };
      }

      if (row.serialNumber && existingSerialSet.has(row.serialNumber.toLowerCase())) {
        return { ...row, status: "invalid", reason: "Serial Number already exists in inventory" };
      }

      return row;
    });
  }, [bulkRows, companyId]);

  const handleBulkReview = useCallback(async () => {
    if (!isBulkConfigValid) {
      toast.error("Fill all shared product details before reviewing bulk list.");
      return;
    }

    setIsBulkReviewing(true);
    try {
      const validatedRows = await runBulkValidation();
      const valid = validatedRows.filter((row) => row.status === "valid").length;
      const invalid = validatedRows.length - valid;

      setBulkRows(validatedRows);
      setBulkSummary({
        total: validatedRows.length,
        valid,
        invalid,
      });
    } catch (error) {
      toastError(error, "Bulk validation failed");
    } finally {
      setIsBulkReviewing(false);
    }
  }, [isBulkConfigValid, runBulkValidation]);

  const handleBulkInsert = useCallback(async () => {
    if (!bulkSummary || bulkSummary.valid === 0) {
      toast.error("No valid rows to add. Please scan and review again.");
      return;
    }

    setIsBulkSaving(true);
    try {
      const validRows = bulkRows.filter((row) => row.status === "valid");
      const hstForBulk = Number(form.hst) || 0;
      const purchasePriceForBulk = Number(form.purchasePrice);
      const pricePerUnit = calculatePricePerUnit(purchasePriceForBulk, 1, hstForBulk);

      const payload: InventoryItem[] = validRows.map((row) => ({
        id: "",
        deviceName: form.deviceName.trim(),
        brand: form.brand.trim(),
        grade: form.grade as Grade,
        storage: form.storage.trim(),
        quantity: 1,
        purchasePrice: purchasePriceForBulk,
        hst: hstForBulk || null,
        pricePerUnit,
        sellingPrice: Number(form.sellingPrice),
        lastUpdated: "Just now",
        priceChange: "stable",
        isActive: true,
        imei: row.imei,
        serialNumber: row.serialNumber,
        status: "in_stock",
      }));

      const result = await bulkInsertProducts(payload);

      if (result.success > 0 && companyId) {
        await createNotificationEvent({
          actorUserId: user?.id ?? null,
          companyId,
          eventType: NOTIFICATION_EVENT_TYPES.inventoryProductAdded,
          message: `${result.success} unit${result.success !== 1 ? "s" : ""} added via bulk inventory entry.`,
          metadata: { successCount: result.success },
          title: "Inventory updated",
        });
      }

      if (result.failed > 0) {
        toast.success(`${result.success} products added. ${result.failed} failed.`);
      } else {
        toast.success(`${result.success} products added to inventory.`);
      }

      handleClose();
      onSuccess();
    } catch (error) {
      toastError(error, "Bulk insert failed");
    } finally {
      setIsBulkSaving(false);
    }
  }, [
    bulkInsertProducts,
    bulkRows,
    bulkSummary,
    companyId,
    form.brand,
    form.deviceName,
    form.grade,
    form.hst,
    form.purchasePrice,
    form.sellingPrice,
    form.storage,
    onSuccess,
    user?.id,
  ]);

  const handleNextStep = () => {
    if (!isFormValid) return;
    setStep("review");
  };

  // When colour dialog confirms: if identifiers exist, open IMEI-color mapping step.
  // Otherwise, submit directly.
  const handleColourConfirm = async (colorRows: ColourRow[]) => {
    const enteredImeiList = parseIdentifierList(form.imei);
    const enteredSerialList = parseIdentifierList(form.serialNumber);
    const hasAnyIdentifiers = enteredImeiList.length > 0 || enteredSerialList.length > 0;
    const hasValidColors = colorRows.some((r) => r.color.trim() && Number(r.quantity) > 0);

    if (hasAnyIdentifiers && hasValidColors) {
      // Save color rows and open the mapping dialog
      setPendingColorRows(colorRows);
      setColourDialogOpen(false);
      setImeiColorMappingOpen(true);
      return;
    }

    // No identifiers or no colors — submit directly
    await handleSubmit(colorRows);
  };

  // Called from ImeiColorMappingDialog onConfirm
  const handleImeiColorMappingConfirm = async (mappings: ImeiColorMapping[]) => {
    await handleSubmit(pendingColorRows, mappings);
  };

  const handleSubmit = async (colorRows: ColourRow[], imeiColorMappings?: ImeiColorMapping[]) => {
    setIsSubmitting(true);
    try {
      let savedInventoryId: string | null = null;
      const enteredImeiList = parseIdentifierList(form.imei);
      const enteredSerialList = parseIdentifierList(form.serialNumber);
      const identifiers = [
        ...enteredImeiList.map((imei) => ({ imei, serialNumber: null as string | null })),
        ...enteredSerialList.map((serialNumber) => ({ imei: null as string | null, serialNumber })),
      ];

      // Build a lookup from identifier value → color using the IMEI-color mappings
      const colorByIdentifier = new Map<string, string>();
      if (imeiColorMappings) {
        for (const m of imeiColorMappings) {
          const key = (m.imei ?? m.serialNumber ?? "").toLowerCase();
          if (key) colorByIdentifier.set(key, m.color);
        }
      }
      const getColorForIdentifier = (imei: string | null, serial: string | null): string | null => {
        const key = (imei ?? serial ?? "").toLowerCase();
        return colorByIdentifier.get(key) ?? null;
      };
      const quantityForSubmit = Number(form.quantity) || 0;

      if (identifiers.length > 0 && identifiers.length !== quantityForSubmit) {
        throw new Error(
          `Identifiers mismatch: ${identifiers.length} entered for ${quantityForSubmit} units.`,
        );
      }

      const uniqueIdentifierSet = new Set(
        identifiers
          .map((row) => row.imei ?? row.serialNumber ?? "")
          .filter(Boolean)
          .map((value) => value.toLowerCase()),
      );
      if (uniqueIdentifierSet.size !== identifiers.length) {
        throw new Error("Duplicate IMEI/Serial values detected in this entry.");
      }

      // ── Pre-validate identifiers against the DB BEFORE any writes ──────────
      // Without this, the inventory row gets committed and then identifier
      // insertion fails, leaving orphaned inventory rows on each retry.
      if (identifiers.length > 0 && companyId) {
        const imeiValues = identifiers.filter((i) => i.imei).map((i) => i.imei as string);
        const serialValues = identifiers
          .filter((i) => i.serialNumber)
          .map((i) => i.serialNumber as string);

        const alreadyExists: string[] = [];

        if (imeiValues.length > 0) {
          const { data } = await (supabase.from("inventory_identifiers") as any)
            .select("imei")
            .eq("company_id", companyId)
            .in("imei", imeiValues);
          if (data) {
            alreadyExists.push(...(data as { imei: string }[]).map((r) => r.imei));
          }
        }

        if (serialValues.length > 0) {
          const { data } = await (supabase.from("inventory_identifiers") as any)
            .select("serial_number")
            .eq("company_id", companyId)
            .in("serial_number", serialValues);
          if (data) {
            alreadyExists.push(
              ...(data as { serial_number: string }[]).map((r) => r.serial_number),
            );
          }
        }

        if (alreadyExists.length > 0) {
          throw new Error(
            `${alreadyExists.join(", ")} ${alreadyExists.length === 1 ? "is" : "are"} already registered in inventory. Remove the duplicate${alreadyExists.length === 1 ? "" : "s"} and try again.`,
          );
        }
      }
      // ────────────────────────────────────────────────────────────────────────

      if (selectedExisting && hasIdentifier) {
        // ── Case 1: Scan a new unit of an existing device configuration ──────
        // Increment the shared quantity counter and register the new identifier.
        let currentQty = selectedExisting.quantity;
        if (companyId) {
          const { data: qtyRow, error: qtyErr } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("id", selectedExisting.id)
            .eq("company_id", companyId)
            .maybeSingle();
          const liveQty = (qtyRow as { quantity?: number } | null)?.quantity;
          if (!qtyErr && typeof liveQty === "number") {
            currentQty = liveQty;
          }
        }
        await updateProduct(selectedExisting.id, {
          quantity: currentQty + identifiers.length,
        });
        for (const identifier of identifiers) {
          await addInventoryIdentifier(
            selectedExisting.id,
            identifier.imei,
            identifier.serialNumber,
            getColorForIdentifier(identifier.imei, identifier.serialNumber),
          );
        }
        savedInventoryId = selectedExisting.id;
        toast.success(
          `${form.deviceName} — ${identifiers.length} unit${identifiers.length !== 1 ? "s" : ""} added with identifiers`,
        );
        onRestockComplete?.(selectedExisting.id);
      } else if (selectedExisting && mergePreview && !hasIdentifier) {
        // ── Case 2: Legacy restock without a scanned identifier ──────────────
        let currentQty = selectedExisting.quantity;
        if (companyId) {
          const { data: qtyRow, error: qtyErr } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("id", selectedExisting.id)
            .eq("company_id", companyId)
            .maybeSingle();
          const liveQty = (qtyRow as { quantity?: number } | null)?.quantity;
          if (!qtyErr && typeof liveQty === "number") {
            currentQty = liveQty;
          }
        }
        const isOutOfStock = currentQty === 0;
        const totalQty = isOutOfStock ? effectiveQuantity : currentQty + effectiveQuantity;
        const totalPP = isOutOfStock
          ? newPurchasePrice
          : (selectedExisting.purchasePrice ?? 0) + newPurchasePrice;
        const avgPricePerUnit = calculatePricePerUnit(totalPP, totalQty, hstValue);
        await updateProduct(selectedExisting.id, {
          quantity: totalQty,
          purchasePrice: totalPP,
          pricePerUnit: avgPricePerUnit,
          sellingPrice,
          hst: hstValue || null,
        });
        savedInventoryId = selectedExisting.id;
        toast.success(
          `${form.deviceName} restocked — ${effectiveQuantity} unit${effectiveQuantity !== 1 ? "s" : ""} added`,
        );
        onRestockComplete?.(selectedExisting.id);
      } else {
        // ── Case 3: New product configuration ───────────────────────────────
        const pricePerUnit = calculatePricePerUnit(newPurchasePrice, effectiveQuantity, hstValue);
        const result = await bulkInsertProducts([
          {
            id: "",
            deviceName: form.deviceName.trim(),
            brand: form.brand.trim(),
            grade: form.grade as Grade,
            storage: form.storage.trim(),
            quantity: effectiveQuantity,
            purchasePrice: newPurchasePrice,
            hst: hstValue || null,
            pricePerUnit,
            sellingPrice,
            lastUpdated: "Just now",
            priceChange: "stable",
            isActive: true,
          },
        ]);

        savedInventoryId = result.insertedIds?.[0] ?? null;

        // Register the scanned identifier against the new inventory record.
        if (identifiers.length > 0 && savedInventoryId) {
          for (const identifier of identifiers) {
            await addInventoryIdentifier(
              savedInventoryId,
              identifier.imei,
              identifier.serialNumber,
              getColorForIdentifier(identifier.imei, identifier.serialNumber),
            );
          }
        }

        toast.success(`${form.deviceName} added to inventory`);
      }

      if (savedInventoryId && companyId) {
        await createNotificationEvent({
          actorUserId: user?.id ?? null,
          companyId,
          entityId: savedInventoryId,
          entityType: "inventory",
          eventType: NOTIFICATION_EVENT_TYPES.inventoryProductAdded,
          message: `${form.brand} ${form.deviceName} (${effectiveQuantity} unit${effectiveQuantity !== 1 ? "s" : ""}) added to inventory.`,
          metadata: {
            brand: form.brand.trim(),
            deviceName: form.deviceName.trim(),
            quantity: effectiveQuantity,
          },
          title: "Inventory updated",
        });
      }

      // ── Save colour breakdown ───────────────────────────────────────────────
      const inventoryId = savedInventoryId; // narrow to string for callbacks
      if (inventoryId && colorRows.length > 0) {
        const rows = colorRows
          .filter((r) => r.color.trim() && Number(r.quantity) > 0)
          .map((r) => ({
            inventory_id: inventoryId,
            color: r.color.trim(),
            quantity: Number(r.quantity),
            updated_at: new Date().toISOString(),
          }));

        if (rows.length > 0) {
          const { error: upsertError } = await (supabase as any)
            .from("inventory_colors")
            .upsert(rows, { onConflict: "inventory_id,color" });
          if (upsertError) throw new Error(`Colour save failed: ${upsertError.message}`);

          // Remove colours no longer in the breakdown
          const keptColors = rows.map((r) => r.color);
          const { data: existing } = await (supabase as any)
            .from("inventory_colors")
            .select("color")
            .eq("inventory_id", inventoryId);
          const toDelete = (existing ?? [])
            .map((r: { color: string }) => r.color)
            .filter((c: string) => !keptColors.includes(c));
          if (toDelete.length > 0) {
            const { error: deleteError } = await (supabase as any)
              .from("inventory_colors")
              .delete()
              .eq("inventory_id", inventoryId)
              .in("color", toDelete);
            if (deleteError) throw new Error(`Colour cleanup failed: ${deleteError.message}`);
          }
        }
      }

      handleClose();
      onSuccess();
    } catch (err) {
      toastError(err, "Failed to save product. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setForm(defaultForm);
      setSelectedExistingId(null);
      setMode("single");
      setStep("form");
      setBulkRows([]);
      setBulkScanInput("");
      setIsBulkReviewing(false);
      setIsBulkSaving(false);
      setBulkSummary(null);
      setComboboxOpen(false);
      setColourDialogOpen(false);
      setExistingColorRows([]);
      setIsLoadingExistingColors(false);
      setSuggestedColors([]);
      setImeiColorMappingOpen(false);
      setPendingColorRows([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[calc(100%-1rem)] mx-auto max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Package className="h-4 w-4 text-primary" />
            </div>
            Add Product to Inventory
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Search for an existing product to restock, or fill in the form to add a new one.
            Purchase prices are automatically averaged.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1">
          <div className="space-y-4 pt-1 mb-4">
            <div className="bg-muted/50 px-3 py-2 rounded-lg text-sm font-medium text-foreground">
              Single product
            </div>
          </div>

          {mode === "single" && step === "form" && (
            <div className="space-y-5">
              {/* ── Product search combobox ───────────────────────────────────── */}
              <ProductSearchCombobox
                comboboxOpen={comboboxOpen}
                setComboboxOpen={setComboboxOpen}
                inventory={inventory}
                selectedExisting={selectedExisting}
                selectedExistingId={selectedExistingId}
                deviceNameSearch={form.deviceName}
                onSelectExisting={handleSelectExisting}
                onClearSelection={handleClearSelection}
              />

              <div className="relative">
                <Separator />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-background px-2 text-xs text-muted-foreground">
                    Product Details
                  </span>
                </span>
              </div>

              {/* ── Form fields ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                {/* IMEI */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ap-imei"
                    className="text-sm font-medium text-amber-700 dark:text-amber-500"
                  >
                    IMEI (Scanner focus)
                  </Label>
                  <Input
                    id="ap-imei"
                    placeholder="Scan or type IMEI"
                    value={form.imei}
                    onChange={(e) => handleField("imei", e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Serial Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-serial" className="text-sm font-medium">
                    Serial Number
                  </Label>
                  <Input
                    id="ap-serial"
                    placeholder="Scan or type Serial"
                    value={form.serialNumber}
                    onChange={(e) => handleField("serialNumber", e.target.value)}
                  />
                </div>
                {hasIdentifier && (
                  <div className="col-span-2 rounded-md border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      IMEI: {imeiList.length} | Serial: {serialList.length} | Total:{" "}
                      {totalIdentifierCount}
                      {enteredQuantity > 0 ? (
                        <> / Required: {enteredQuantity}</>
                      ) : (
                        <span className="text-muted-foreground/80">
                          {" "}
                          — enter quantity below to match
                        </span>
                      )}
                    </p>
                    {enteredQuantity > 0 && !identifierCountMatchesQuantity && (
                      <p className="text-xs text-destructive mt-1">
                        Total IMEI + Serial must exactly match Quantity.
                      </p>
                    )}
                    {hasDuplicateIdentifiers && (
                      <p className="text-xs text-destructive mt-1">
                        Duplicate IMEI/Serial values are not allowed.
                      </p>
                    )}
                    {warnBothImeiAndSerialForSingleQuantity && (
                      <p
                        className="text-xs text-amber-700 dark:text-amber-400 mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5"
                        role="status"
                      >
                        For a single unit, use <span className="font-medium">either</span> IMEI{" "}
                        <span className="font-medium">or</span> serial—not both. Values in both
                        fields count as two separate units.
                      </p>
                    )}
                  </div>
                )}

                {/* Device Name */}
                <div className="col-span-2 space-y-1.5 mt-2">
                  <Label htmlFor="ap-device" className="text-sm font-medium">
                    Device Name
                  </Label>
                  <Input
                    id="ap-device"
                    placeholder="e.g. iPhone 12"
                    value={form.deviceName}
                    onChange={(e) => handleField("deviceName", e.target.value)}
                    disabled={!!selectedExisting}
                    className={
                      selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""
                    }
                  />
                </div>

                {/* Brand */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-brand" className="text-sm font-medium">
                    Brand
                  </Label>
                  <Input
                    id="ap-brand"
                    placeholder="e.g. Apple"
                    value={form.brand}
                    onChange={(e) => handleField("brand", e.target.value)}
                    disabled={!!selectedExisting}
                    className={
                      selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""
                    }
                  />
                </div>

                {/* Grade */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Grade</Label>
                  <Select
                    value={form.grade}
                    onValueChange={(v) => handleField("grade", v)}
                    disabled={!!selectedExisting}
                  >
                    <SelectTrigger
                      className={
                        selectedExisting
                          ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                          : ""
                      }
                    >
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => (
                        <SelectItem key={g} value={g}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center rounded text-xs font-bold border px-1.5 py-0.5 min-w-[1.5rem]",
                                GRADE_STYLES[g],
                              )}
                            >
                              {GRADE_BADGE_LABELS[g]}
                            </span>
                            {GRADE_LABELS[g]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Storage */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-storage" className="text-sm font-medium">
                    Storage
                  </Label>
                  <Input
                    id="ap-storage"
                    placeholder="e.g. 128GB"
                    value={form.storage}
                    onChange={(e) => handleField("storage", e.target.value)}
                    disabled={!!selectedExisting}
                    className={
                      selectedExisting ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""
                    }
                  />
                </div>

                {/* HST */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-hst" className="text-sm font-medium">
                    HST %
                  </Label>
                  <Input
                    id="ap-hst"
                    type="number"
                    placeholder="13"
                    value={form.hst}
                    onChange={(e) => handleField("hst", e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-qty" className="text-sm font-medium">
                    {selectedExisting ? "Units to Add" : "Quantity"}
                  </Label>
                  <Input
                    id="ap-qty"
                    type="number"
                    placeholder="0"
                    value={form.quantity}
                    onChange={(e) => handleField("quantity", e.target.value)}
                    min="1"
                  />
                </div>

                {/* Purchase Price */}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-pp" className="text-sm font-medium">
                    {selectedExisting ? "Purchase Price (this batch)" : "Total Purchase Price"}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ap-pp"
                      type="number"
                      placeholder="0.00"
                      value={form.purchasePrice}
                      onChange={(e) => handleField("purchasePrice", e.target.value)}
                      min="0"
                      step="0.01"
                      className="pl-6"
                    />
                  </div>
                </div>

                {/* Selling Price */}
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ap-sp" className="text-sm font-medium">
                    Selling Price (per unit)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="ap-sp"
                      type="number"
                      placeholder="0.00"
                      value={form.sellingPrice}
                      onChange={(e) => handleField("sellingPrice", e.target.value)}
                      min="0"
                      step="0.01"
                      className="pl-6"
                    />
                  </div>
                </div>
              </div>

              {/* ── Merge preview for restocking ──────────────────────────────── */}
              {selectedExisting && mergePreview && (
                <MergePreviewCard
                  mergePreview={mergePreview}
                  newQuantity={newQuantity}
                  newPurchasePrice={newPurchasePrice}
                  selectedExisting={selectedExisting}
                  selectedExistingEffective={selectedExistingEffective}
                />
              )}

              {/* ── Price/unit preview for new product ───────────────────────── */}
              {!selectedExisting &&
                computedPricePerUnit !== null &&
                newQuantity > 0 &&
                newPurchasePrice > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      Calculated Price / Unit (incl. HST)
                    </span>
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {formatPrice(computedPricePerUnit)}
                    </span>
                  </div>
                )}

              {/* ── Actions ──────────────────────────────────────────────────── */}
              <div className="flex gap-3 pt-1 pb-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleNextStep} disabled={!isFormValid}>
                  Review Details
                </Button>
              </div>
            </div>
          )}

          {mode === "single" && step === "review" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <h4 className="font-semibold text-sm">Product Overview</h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Device</dt>
                    <dd className="font-medium">{form.deviceName || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Brand</dt>
                    <dd className="font-medium">{form.brand || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Grade</dt>
                    <dd className="font-medium">{form.grade || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Storage</dt>
                    <dd className="font-medium">{form.storage || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground text-amber-600 dark:text-amber-500">
                      IMEI
                    </dt>
                    <dd className="font-medium">{imeiList.length || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Serial</dt>
                    <dd className="font-medium">{serialList.length || "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Quantity</dt>
                    <dd className="font-medium">{form.quantity}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Purchase Price</dt>
                    <dd className="font-medium">{formatPrice(Number(form.purchasePrice) || 0)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Selling Price</dt>
                    <dd className="font-medium">{formatPrice(Number(form.sellingPrice) || 0)}</dd>
                  </div>
                </dl>
                {warnBothImeiAndSerialForSingleQuantity && (
                  <p
                    className="text-xs text-amber-700 dark:text-amber-400 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                    role="status"
                  >
                    For a single unit, use either IMEI or serial—not both fields.
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("form")}
                  disabled={isSubmitting}
                >
                  Back to Edit
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setColourDialogOpen(true)}
                  disabled={isSubmitting}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  Confirm & Configure Colors
                </Button>
              </div>
            </div>
          )}

          {mode === "bulk" && (
            <BulkModePanel
              form={form}
              onField={handleField}
              bulkRows={bulkRows}
              bulkScanInput={bulkScanInput}
              setBulkScanInput={setBulkScanInput}
              bulkSummary={bulkSummary}
              isBulkReviewing={isBulkReviewing}
              isBulkSaving={isBulkSaving}
              onBulkScanKeyDown={handleBulkScanKeyDown}
              onBulkScanSubmit={handleBulkScanSubmit}
              onRemoveBulkRow={handleRemoveBulkRow}
              onResetBulkRows={handleResetBulkRows}
              onBulkReview={handleBulkReview}
              onBulkInsert={handleBulkInsert}
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>

      {/* Colour breakdown opens as a separate dialog on top */}
      <ColourBreakdownDialog
        open={colourDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) setColourDialogOpen(false);
        }}
        productName={form.deviceName || "this product"}
        totalQuantity={
          selectedExistingEffective && hasIdentifier
            ? selectedExistingEffective.quantity + 1
            : isLegacyRestock && mergePreview
              ? mergePreview.totalQty
              : newQuantity
        }
        initialColors={selectedExistingId ? existingColorRows : undefined}
        suggestedColors={suggestedColors}
        note={
          selectedExistingEffective && hasIdentifier
            ? `Covers all ${selectedExistingEffective.quantity + 1} units — ${selectedExistingEffective.quantity} existing + 1 new. Increment the colour that matches this unit.`
            : isLegacyRestock && mergePreview && selectedExistingEffective
              ? `Covers all ${mergePreview.totalQty} units — ${selectedExistingEffective.quantity} existing + ${newQuantity} new batch. Previously assigned colours are pre-filled.`
              : undefined
        }
        isLoadingInitialColors={isLoadingExistingColors}
        onConfirm={handleColourConfirm}
        isSaving={isSubmitting}
        confirmLabel={
          hasIdentifier
            ? "Next: Assign Colors to Units"
            : selectedExisting
              ? "Update Inventory"
              : "Add to Inventory"
        }
      />

      {/* IMEI-to-color mapping dialog — opens after colour breakdown when identifiers exist */}
      <ImeiColorMappingDialog
        open={imeiColorMappingOpen}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setImeiColorMappingOpen(false);
            // Re-open colour dialog so user can go back
            setColourDialogOpen(true);
          }
        }}
        productName={form.deviceName || "this product"}
        identifiers={(() => {
          const entries: IdentifierEntry[] = [];
          for (const imei of imeiList) {
            entries.push({ label: imei, imei, serialNumber: null });
          }
          for (const serial of serialList) {
            entries.push({ label: serial, imei: null, serialNumber: serial });
          }
          return entries;
        })()}
        colorBudgets={pendingColorRows
          .filter((r) => r.color.trim() && Number(r.quantity) > 0)
          .map((r) => ({ color: r.color.trim(), quantity: Number(r.quantity) }))}
        onConfirm={handleImeiColorMappingConfirm}
        isSaving={isSubmitting}
        confirmLabel={selectedExisting ? "Update Inventory" : "Add to Inventory"}
      />
    </Dialog>
  );
}
