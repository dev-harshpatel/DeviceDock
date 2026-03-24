"use client";

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
import { Order } from "@/types/order";
import { formatPrice } from "@/lib/utils";

interface InvoiceConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  order: Order | null;
}

export function InvoiceConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  order,
}: InvoiceConfirmationDialogProps) {
  if (!order) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Invoice</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to confirm this invoice? Once confirmed, the
            customer will be able to download it.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {order.invoiceNumber && (
          <div className="py-4 space-y-2">
            <div className="text-sm">
              <span className="font-medium text-foreground">
                Invoice Number:
              </span>
              <span className="ml-2 text-muted-foreground">
                {order.invoiceNumber}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium text-foreground">Total Amount:</span>
              <span className="ml-2 text-muted-foreground">
                {formatPrice(order.totalPrice)}
              </span>
            </div>
            {order.invoiceDate && (
              <div className="text-sm">
                <span className="font-medium text-foreground">
                  Invoice Date:
                </span>
                <span className="ml-2 text-muted-foreground">
                  {new Date(order.invoiceDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!!order.invoiceConfirmed}
          >
            Confirm Invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
