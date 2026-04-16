import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { InventoryItem } from "@/data/inventory";

interface ProductDeleteDialogProps {
  open: boolean;
  product: InventoryItem | null;
  orderCount: number | null;
  isChecking: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ProductDeleteDialog({
  open,
  product,
  orderCount,
  isChecking,
  isDeleting,
  onOpenChange,
  onConfirm,
}: ProductDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isChecking
              ? "Checking…"
              : orderCount && orderCount > 0
                ? "Cannot delete this product"
                : `Delete "${product?.deviceName}"?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {isChecking && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking for associated orders…</span>
                </div>
              )}

              {!isChecking && orderCount && orderCount > 0 ? (
                <>
                  <p>
                    This product appears in{" "}
                    <strong className="text-foreground">{orderCount}</strong> order
                    {orderCount !== 1 ? "s" : ""}. Deleting it would break those order records, so
                    it is blocked.
                  </p>
                  <p>
                    To remove this product from your inventory, you can{" "}
                    <strong className="text-foreground">unlist it</strong> using the toggle — it
                    will stay in order history but won&apos;t be visible to users.
                  </p>
                </>
              ) : !isChecking ? (
                <p>
                  This will permanently delete{" "}
                  <strong className="text-foreground">{product?.deviceName}</strong> along with all
                  its colour records and IMEI/serial entries. This cannot be undone.
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          {!isChecking && (!orderCount || orderCount === 0) && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </span>
              ) : (
                "Delete permanently"
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
