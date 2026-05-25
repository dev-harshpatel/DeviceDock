"use client";

import Link from "next/link";
import { ArrowLeft, Layers, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColourBreakdownDialog } from "@/components/modals/ColourBreakdownDialog";
import { useBulkProductsForm } from "@/hooks/use-bulk-products-form";
import { BulkProductRowCollapsed } from "@/components/inventory/BulkProductRowCollapsed";
import { BulkProductRowExpanded } from "@/components/inventory/BulkProductRowExpanded";

const MAX_ROWS = 50;

export default function AddMultipleProducts() {
  const {
    rows,
    lineCollapsed,
    isSubmitting,
    comboboxOpenIndex,
    setComboboxOpenIndex,
    colorDialogState,
    setColorDialogState,
    isLoadingColorRows,
    productsPath,
    uploadPath,
    handleCancel,
    handleFieldChange,
    handleSelectInventoryItem,
    handleLineDone,
    handleLineExpand,
    handleAddRow,
    handleRemoveRow,
    openColorDialog,
    handleColorDialogConfirm,
    handleSubmit,
    canSubmit,
    hasPartialRow,
    activeColorDialogRow,
    activeColorDialogExisting,
    inventory,
  } = useBulkProductsForm();

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <header className="shrink-0 border-b border-border bg-background px-4 sm:px-6 lg:px-10 xl:px-12 py-2.5 sm:py-3">
        <div className="w-full max-w-[1920px] mx-auto flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            className="w-fit -ml-2 gap-2 h-9 px-2 text-muted-foreground hover:text-foreground"
            onClick={handleCancel}
            disabled={isSubmitting}
            aria-label="Back to inventory"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back to inventory
          </Button>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Layers className="h-4 w-4 text-primary" />
              </span>
              Add multiple products
            </h1>
            <p className="text-sm text-muted-foreground max-w-4xl leading-relaxed">
              Add several new SKUs in one go. Colour breakdown can be set later in{" "}
              <Link
                href={productsPath}
                className="text-primary underline underline-offset-2 font-medium"
              >
                Product Management
              </Link>
              .{" "}
              <Link
                href={uploadPath}
                className="text-primary underline underline-offset-2 font-medium"
              >
                Import from spreadsheet
              </Link>{" "}
              for large lists.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
              Up to {MAX_ROWS} lines. Tap Done on a line to collapse it and save space, then Add row
              for the next SKU. Purchase price is the batch total; previews show landed cost and
              margin.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0 self-start sm:self-center"
              onClick={handleAddRow}
              disabled={rows.length >= MAX_ROWS || isSubmitting}
              aria-label="Add another product row"
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>

          {hasPartialRow ? (
            <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
              Finish all fields on each non-empty row, or clear unused rows.
            </p>
          ) : null}

          <div className="space-y-2.5">
            {rows.map((row, index) => {
              const isCollapsed = lineCollapsed[index] ?? false;

              if (isCollapsed) {
                return (
                  <BulkProductRowCollapsed
                    key={index}
                    index={index}
                    row={row}
                    isSubmitting={isSubmitting}
                    onExpand={() => handleLineExpand(index)}
                    onRemove={() => handleRemoveRow(index)}
                  />
                );
              }

              return (
                <BulkProductRowExpanded
                  key={index}
                  index={index}
                  row={row}
                  inventory={inventory}
                  isSubmitting={isSubmitting}
                  isLoadingColorRows={isLoadingColorRows}
                  comboboxOpenIndex={comboboxOpenIndex}
                  setComboboxOpenIndex={setComboboxOpenIndex}
                  onFieldChange={handleFieldChange}
                  onSelectInventoryItem={handleSelectInventoryItem}
                  onLineDone={handleLineDone}
                  onRemove={handleRemoveRow}
                  onOpenColorDialog={openColorDialog}
                />
              );
            })}
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-background px-4 sm:px-6 lg:px-10 xl:px-12 py-2.5 sm:py-3">
        <div className="w-full max-w-[1920px] mx-auto flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="gap-2 min-w-[10rem]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Add to inventory"
            )}
          </Button>
        </div>
      </footer>

      <ColourBreakdownDialog
        open={colorDialogState.open}
        onOpenChange={(open) => {
          if (open) return;
          setColorDialogState({
            open: false,
            rowIndex: null,
            initialRows: [],
            existingFullyAssigned: false,
            suggestedColors: [],
          });
        }}
        productName={activeColorDialogRow?.deviceName || "this product"}
        totalQuantity={
          activeColorDialogRow
            ? colorDialogState.existingFullyAssigned
              ? Number(activeColorDialogRow.quantity) || 0
              : (activeColorDialogExisting?.quantity ?? 0) +
                (Number(activeColorDialogRow.quantity) || 0)
            : 0
        }
        initialColors={colorDialogState.initialRows}
        suggestedColors={colorDialogState.suggestedColors}
        isLoadingInitialColors={isLoadingColorRows}
        onConfirm={handleColorDialogConfirm}
        confirmLabel="Save colours"
      />
    </div>
  );
}
