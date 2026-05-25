"use client";

import { Package } from "lucide-react";
import { ColourBreakdownDialog, type ColourRow } from "@/components/modals/ColourBreakdownDialog";
import {
  ImeiColorMappingDialog,
  type IdentifierEntry,
  type ImeiColorMapping,
} from "@/components/modals/ImeiColorMappingDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { BulkModePanel } from "@/components/modals/BulkModePanel";
import { ProductSearchCombobox } from "@/components/modals/ProductSearchCombobox";
import { useAddProduct } from "@/hooks/use-add-product";
import { InventoryMetaFields } from "@/components/modals/add-product/InventoryMetaFields";
import { GradeConditionSelector } from "@/components/modals/add-product/GradeConditionSelector";
import { PriceInputs } from "@/components/modals/add-product/PriceInputs";
import { ProductFormSummary } from "@/components/modals/add-product/ProductFormSummary";

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pre-select an existing inventory item (e.g. from Demand page restock flow) */
  initialItemId?: string;
  /** Called after a successful restock of an existing item */
  onRestockComplete?: (itemId: string) => void;
}

export function AddProductModal({
  open,
  onOpenChange,
  onSuccess,
  initialItemId,
  onRestockComplete,
}: AddProductModalProps) {
  const {
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

    // ── Setters ──
    setStep,
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
  } = useAddProduct({
    open,
    onOpenChange,
    onSuccess,
    initialItemId,
    onRestockComplete,
  });

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
                inventory={groupedInventory}
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
                <InventoryMetaFields
                  form={form}
                  handleField={handleField}
                  hasIdentifier={hasIdentifier}
                  imeiList={imeiList}
                  serialList={serialList}
                  totalIdentifierCount={totalIdentifierCount}
                  enteredQuantity={enteredQuantity}
                  identifierCountMatchesQuantity={identifierCountMatchesQuantity}
                  hasDuplicateIdentifiers={hasDuplicateIdentifiers}
                  warnBothImeiAndSerialForSingleQuantity={warnBothImeiAndSerialForSingleQuantity}
                  selectedExisting={selectedExisting}
                />

                <GradeConditionSelector
                  form={form}
                  handleField={handleField}
                  selectedExisting={selectedExisting}
                />

                <PriceInputs
                  form={form}
                  handleField={handleField}
                  selectedExisting={selectedExisting}
                  selectedExistingEffective={selectedExistingEffective}
                  newQuantity={newQuantity}
                  newPurchasePrice={newPurchasePrice}
                  hstValue={hstValue}
                  computedPricePerUnit={computedPricePerUnit}
                  mergePreview={mergePreview}
                />
              </div>

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
            <ProductFormSummary
              form={form}
              imeiList={imeiList}
              serialList={serialList}
              warnBothImeiAndSerialForSingleQuantity={warnBothImeiAndSerialForSingleQuantity}
              isSubmitting={isSubmitting}
              onBack={() => setStep("form")}
              onConfirm={() => setColourDialogOpen(true)}
            />
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
          hasIdentifier
            ? totalIdentifierCount
            : isLegacyRestock && mergePreview
              ? mergePreview.totalQty
              : newQuantity
        }
        initialColors={selectedExistingId && !hasIdentifier ? existingColorRows : undefined}
        suggestedColors={suggestedColors}
        note={
          selectedExistingEffective && hasIdentifier
            ? `Assign colours for this batch only — ${totalIdentifierCount} new unit${totalIdentifierCount !== 1 ? "s" : ""}. Existing SKU colours will be incremented automatically when you save.`
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
