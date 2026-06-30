"use client";

import { KeyboardEvent, useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/utils/toast-helpers";
import { calculatePricePerUnit } from "@/data/inventory";
import type { InventoryItem } from "@/data/inventory";
import { parseIdentifierList } from "@/lib/inventory/parse-identifier-list";
import { replaceInventoryColors } from "@/lib/inventory/inventory-colors";
import { useInventory } from "@/contexts/InventoryContext";
import { useAuth } from "@/lib/auth/context";
import { useCompany } from "@/contexts/CompanyContext";
import { createNotificationEvent } from "@/lib/notifications/client";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";
import {
  fetchColorSuggestionsByInventoryIdsQuery,
  fetchColorRowsByItemIdQuery,
  fetchInventoryQuantityQuery,
  checkDuplicateIdentifiersQuery,
  checkDuplicateInventoryQuery,
} from "@/lib/supabase/queries";
import { type Grade } from "@/lib/constants/grades";
import type { ColourRow } from "@/components/modals/ColourBreakdownDialog";
import type { ImeiColorMapping } from "@/components/modals/ImeiColorMappingDialog";

export interface ProductForm {
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
  damageNote: string;
}

export type BulkRowStatus = "pending" | "valid" | "invalid";

export interface BulkScanRow {
  id: string;
  identifier: string;
  imei: string | null;
  serialNumber: string | null;
  status: BulkRowStatus;
  reason?: string;
}

export const defaultForm: ProductForm = {
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
  damageNote: "",
};

interface UseAddProductProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialItemId?: string;
  onRestockComplete?: (itemId: string) => void;
}

export function useAddProduct({
  open,
  onOpenChange,
  onSuccess,
  initialItemId,
  onRestockComplete,
}: UseAddProductProps) {
  const { inventory, groupedInventory, updateProduct, bulkInsertProducts, addInventoryIdentifier } =
    useInventory();
  const { user } = useAuth();
  const { companyId } = useCompany();

  // ── Form & Core States ───────────────────────────────────────────────────
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Color Configuration States ───────────────────────────────────────────
  const [colourDialogOpen, setColourDialogOpen] = useState(false);
  const [existingColorRows, setExistingColorRows] = useState<ColourRow[]>([]);
  const [isLoadingExistingColors, setIsLoadingExistingColors] = useState(false);
  const [liveInventoryQuantity, setLiveInventoryQuantity] = useState<number | null>(null);
  const [suggestedColors, setSuggestedColors] = useState<string[]>([]);
  const [imeiColorMappingOpen, setImeiColorMappingOpen] = useState(false);
  const [pendingColorRows, setPendingColorRows] = useState<ColourRow[]>([]);

  // ── Bulk Entry States ────────────────────────────────────────────────────
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

  const handleClose = useCallback(() => {
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
  }, [isSubmitting, onOpenChange]);

  // ── Memoized Value Derivations ──────────────────────────────────────────
  const imeiList = useMemo(() => parseIdentifierList(form.imei), [form.imei]);
  const serialList = useMemo(() => parseIdentifierList(form.serialNumber), [form.serialNumber]);
  const totalIdentifierCount = imeiList.length + serialList.length;
  const hasIdentifier = totalIdentifierCount > 0;

  const selectedExisting = useMemo(
    () =>
      selectedExistingId ? (inventory.find((i) => i.id === selectedExistingId) ?? null) : null,
    [inventory, selectedExistingId],
  );

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

  const identifierCountMatchesQuantity =
    !hasIdentifier || enteredQuantity <= 0 || totalIdentifierCount === enteredQuantity;

  const hasDuplicateIdentifiers = useMemo(() => {
    const normalized = [...imeiList, ...serialList].map((identifier) => identifier.toLowerCase());
    return new Set(normalized).size !== normalized.length;
  }, [imeiList, serialList]);

  const warnBothImeiAndSerialForSingleQuantity =
    enteredQuantity === 1 && imeiList.length > 0 && serialList.length > 0;

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

  const computedPricePerUnit = useMemo(() => {
    if (!newPurchasePrice || !newQuantity) return null;
    return calculatePricePerUnit(newPurchasePrice, newQuantity, hstValue);
  }, [newPurchasePrice, newQuantity, hstValue]);

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

  // ── Database & Cache Loading Side Effects ───────────────────────────────

  // Fetch unique color suggestions for suggestions select.
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

    void (async () => {
      const unique = await fetchColorSuggestionsByInventoryIdsQuery(sameDeviceIds);
      setSuggestedColors(unique);
    })();
  }, [colourDialogOpen, form.brand, form.deviceName, inventory]);

  // Load existing colors for legacy restock colors.
  useEffect(() => {
    if (!colourDialogOpen || !selectedExistingId || hasIdentifier) {
      setIsLoadingExistingColors(false);
      if (hasIdentifier) {
        setExistingColorRows([]);
      }
      return;
    }

    setIsLoadingExistingColors(true);
    void (async () => {
      const rows = await fetchColorRowsByItemIdQuery(selectedExistingId);
      setExistingColorRows(rows.map((r) => ({ color: r.color, quantity: String(r.quantity) })));
      setIsLoadingExistingColors(false);
    })();
  }, [colourDialogOpen, selectedExistingId, hasIdentifier]);

  // Pre-select item when initialItemId is provided.
  useEffect(() => {
    if (open && initialItemId) {
      const item = inventory.find((i) => i.id === initialItemId);
      if (item) {
        handleSelectExisting(item);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItemId]);

  // Sync and fetch authoritative live quantity from DB.
  useEffect(() => {
    if (!open || !selectedExistingId || !companyId) {
      setLiveInventoryQuantity(null);
      return;
    }

    let cancelled = false;

    const loadLiveQuantity = async () => {
      const quantity = await fetchInventoryQuantityQuery(selectedExistingId, companyId);
      if (cancelled) return;
      setLiveInventoryQuantity(quantity);
    };

    void loadLiveQuantity();

    return () => {
      cancelled = true;
    };
  }, [open, selectedExistingId, companyId]);

  // ── Action Handlers ──────────────────────────────────────────────────────

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
      damageNote: "",
    });
    setComboboxOpen(false);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedExistingId(null);
    setForm(defaultForm);
  }, []);

  const handleField = useCallback((field: keyof ProductForm, value: string) => {
    if (field === "deviceName") {
      setSelectedExistingId(null);
    }
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
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
  }, []);

  // ── Bulk Processing Callbacks ──────────────────────────────────────────

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

    let existingImeiSet = new Set<string>();
    let existingSerialSet = new Set<string>();

    if (companyId && (imeis.length > 0 || serialNumbers.length > 0)) {
      const duplicates = await checkDuplicateInventoryQuery(companyId, imeis, serialNumbers);
      existingImeiSet = duplicates.existingImeis;
      existingSerialSet = duplicates.existingSerials;
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
    handleClose,
  ]);

  // ── Step Management & Submit Pipelines ─────────────────────────────────

  const handleNextStep = useCallback(() => {
    if (!isFormValid) return;
    setStep("review");
  }, [isFormValid]);

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

      // Pre-validate identifiers against database.
      if (identifiers.length > 0 && companyId) {
        const imeiValues = identifiers.filter((i) => i.imei).map((i) => i.imei as string);
        const serialValues = identifiers
          .filter((i) => i.serialNumber)
          .map((i) => i.serialNumber as string);

        const { existingImeis, existingSerials } = await checkDuplicateIdentifiersQuery(
          companyId,
          imeiValues,
          serialValues,
        );

        const alreadyExists: string[] = [
          ...imeiValues.filter((v) => existingImeis.has(v.toLowerCase())),
          ...serialValues.filter((v) => existingSerials.has(v.toLowerCase())),
        ];

        if (alreadyExists.length > 0) {
          throw new Error(
            `${alreadyExists.join(", ")} ${alreadyExists.length === 1 ? "is" : "are"} already registered in inventory. Remove the duplicate${alreadyExists.length === 1 ? "" : "s"} and try again.`,
          );
        }
      }

      const damageNoteValue = form.damageNote.trim() || null;

      if (selectedExisting && hasIdentifier) {
        const perUnitPrice = calculatePricePerUnit(newPurchasePrice, effectiveQuantity, hstValue);
        const perUnitPurchase = effectiveQuantity > 0 ? newPurchasePrice / effectiveQuantity : 0;
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
            pricePerUnit: perUnitPrice,
            sellingPrice,
            lastUpdated: "Just now",
            priceChange: "stable",
            isActive: true,
          },
        ]);

        savedInventoryId = result.insertedIds?.[0] ?? null;

        if (result.success === 0) {
          throw new Error(result.errors?.[0] ?? "Failed to save product to inventory.");
        }

        if (savedInventoryId) {
          for (const identifier of identifiers) {
            await addInventoryIdentifier(
              savedInventoryId,
              identifier.imei,
              identifier.serialNumber,
              getColorForIdentifier(identifier.imei, identifier.serialNumber),
              damageNoteValue,
              perUnitPurchase,
            );
          }
        }

        toast.success(
          `${form.deviceName} — ${identifiers.length} unit${identifiers.length !== 1 ? "s" : ""} added as a separate inventory row`,
        );
        onRestockComplete?.(savedInventoryId ?? selectedExisting.id);
      } else if (selectedExisting && mergePreview && !hasIdentifier) {
        let currentQty = selectedExisting.quantity;
        if (companyId) {
          const liveQty = await fetchInventoryQuantityQuery(selectedExisting.id, companyId);
          if (liveQty !== null) currentQty = liveQty;
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
        const pricePerUnit = calculatePricePerUnit(newPurchasePrice, effectiveQuantity, hstValue);
        const perUnitPurchaseNew = effectiveQuantity > 0 ? newPurchasePrice / effectiveQuantity : 0;
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

        if (result.success === 0) {
          throw new Error(result.errors?.[0] ?? "Failed to save product to inventory.");
        }

        if (identifiers.length > 0 && savedInventoryId) {
          for (const identifier of identifiers) {
            await addInventoryIdentifier(
              savedInventoryId,
              identifier.imei,
              identifier.serialNumber,
              getColorForIdentifier(identifier.imei, identifier.serialNumber),
              damageNoteValue,
              perUnitPurchaseNew,
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

      const inventoryId = savedInventoryId;
      if (inventoryId && colorRows.length > 0) {
        const rows = colorRows
          .filter((r) => r.color.trim() && Number(r.quantity) > 0)
          .map((r) => ({
            color: r.color.trim(),
            quantity: Number(r.quantity),
          }));

        if (rows.length > 0) {
          await replaceInventoryColors(null, inventoryId, rows);
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

  const handleColourConfirm = useCallback(
    async (colorRows: ColourRow[]) => {
      const enteredImeiList = parseIdentifierList(form.imei);
      const enteredSerialList = parseIdentifierList(form.serialNumber);
      const hasAnyIdentifiers = enteredImeiList.length > 0 || enteredSerialList.length > 0;
      const hasValidColors = colorRows.some((r) => r.color.trim() && Number(r.quantity) > 0);

      if (hasAnyIdentifiers && hasValidColors) {
        setPendingColorRows(colorRows);
        setColourDialogOpen(false);
        setImeiColorMappingOpen(true);
        return;
      }

      await handleSubmit(colorRows);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      form.imei,
      form.serialNumber,
      form.quantity,
      form.purchasePrice,
      form.sellingPrice,
      form.deviceName,
      form.brand,
      form.grade,
      form.storage,
      selectedExistingId,
    ],
  );

  const handleImeiColorMappingConfirm = useCallback(
    async (mappings: ImeiColorMapping[]) => {
      await handleSubmit(pendingColorRows, mappings);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pendingColorRows,
      form.imei,
      form.serialNumber,
      form.quantity,
      form.purchasePrice,
      form.sellingPrice,
      form.deviceName,
      form.brand,
      form.grade,
      form.storage,
      selectedExistingId,
    ],
  );

  return {
    // ── Form States ──
    form,
    selectedExistingId,
    comboboxOpen,
    isSubmitting,
    selectedExisting,
    selectedExistingEffective,
    groupedInventory,

    // ── Color States ──
    colourDialogOpen,
    existingColorRows,
    isLoadingExistingColors,
    suggestedColors,
    imeiColorMappingOpen,
    pendingColorRows,

    // ── Bulk States ──
    mode,
    step,
    bulkRows,
    bulkScanInput,
    isBulkReviewing,
    isBulkSaving,
    bulkSummary,

    // ── Memoized Metrics ──
    imeiList,
    serialList,
    totalIdentifierCount,
    hasIdentifier,
    isLegacyRestock,
    newQuantity,
    enteredQuantity,
    effectiveQuantity,
    newPurchasePrice,
    hstValue,
    sellingPrice,
    identifierCountMatchesQuantity,
    hasDuplicateIdentifiers,
    warnBothImeiAndSerialForSingleQuantity,
    mergePreview,
    computedPricePerUnit,
    isFormValid,
    isBulkConfigValid,

    // ── Setters ──
    setStep,
    setMode,
    setComboboxOpen,
    setColourDialogOpen,
    setImeiColorMappingOpen,
    setBulkScanInput,

    // ── Actions ──
    handleSelectExisting,
    handleClearSelection,
    handleField,
    handleBulkScanKeyDown,
    handleBulkScanSubmit,
    handleRemoveBulkRow,
    handleResetBulkRows,
    handleBulkReview,
    handleBulkInsert,
    handleNextStep,
    handleColourConfirm,
    handleImeiColorMappingConfirm,
    handleClose,
  };
}
