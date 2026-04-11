"use client";

import { Layers, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddProductChoiceModalProps {
  onNavigateUpload: () => void;
  onOpenChange: (open: boolean) => void;
  onSelectMultiple: () => void;
  onSelectSingle: () => void;
  open: boolean;
  /** Which navigation is currently in progress */
  navigatingTo?: "multiple" | "upload" | null;
}

export const AddProductChoiceModal = ({
  onNavigateUpload,
  onOpenChange,
  onSelectMultiple,
  onSelectSingle,
  open,
  navigatingTo,
}: AddProductChoiceModalProps) => {
  const isNavigating = !!navigatingTo;

  return (
    <Dialog open={open} onOpenChange={isNavigating ? undefined : onOpenChange}>
      <DialogContent className="max-w-xl w-[calc(100%-1rem)] mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Package className="h-4 w-4 text-primary" />
            </div>
            Add products
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Choose how you want to add inventory. You can switch approach any time by closing and
            opening Add Product again.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full min-w-0 flex-col items-start gap-2 whitespace-normal py-4 px-4 text-left border-border hover:bg-muted/50"
            onClick={onSelectSingle}
            disabled={isNavigating}
            aria-label="Add a single product with colour breakdown"
          >
            <Package className="h-5 w-5 text-primary shrink-0" aria-hidden />
            <span className="w-full min-w-0 text-left font-semibold text-foreground">
              Single product
            </span>
            <span className="w-full min-w-0 text-left text-xs font-normal leading-snug text-muted-foreground [text-wrap:pretty]">
              Search or create one SKU, then set colour breakdown.
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full min-w-0 flex-col items-start gap-2 whitespace-normal py-4 px-4 text-left border-border hover:bg-muted/50"
            onClick={onSelectMultiple}
            disabled={isNavigating}
            aria-label="Add multiple products at once"
          >
            {navigatingTo === "multiple" ? (
              <Loader2 className="h-5 w-5 text-primary shrink-0 animate-spin" aria-hidden />
            ) : (
              <Layers className="h-5 w-5 text-primary shrink-0" aria-hidden />
            )}
            <span className="w-full min-w-0 text-left font-semibold text-foreground">
              {navigatingTo === "multiple" ? "Opening form…" : "Multiple products"}
            </span>
            <span className="w-full min-w-0 text-left text-xs font-normal leading-snug text-muted-foreground [text-wrap:pretty]">
              Opens a full-page form to add several lines at once. Set colours later in Product
              Management.
            </span>
          </Button>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <p className="text-xs text-muted-foreground text-center">
            Prefer a spreadsheet?{" "}
            <button
              type="button"
              className="text-primary underline underline-offset-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isNavigating}
              onClick={() => {
                onOpenChange(false);
                onNavigateUpload();
              }}
            >
              {navigatingTo === "upload" ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Opening…
                </span>
              ) : (
                "Import from spreadsheet"
              )}
            </button>
          </p>
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto self-center"
            onClick={() => onOpenChange(false)}
            disabled={isNavigating}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
