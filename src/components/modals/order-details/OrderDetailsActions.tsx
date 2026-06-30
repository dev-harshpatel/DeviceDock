"use client";

import { Download, FileText, Loader2, ShoppingBag, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderDetailsActionsProps {
  isAdmin: boolean;
  canCreateEditInvoice: boolean;
  canDownloadInvoice: boolean;
  canEditManualSale: boolean;
  canDeleteOrder: boolean;
  canReject: boolean;
  isRejecting: boolean;
  isDownloading: boolean;
  isDeleting: boolean;
  hasInvoice: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadInvoice: () => void;
  onCreateEditInvoice: () => void;
  onPrefetchInvoice: () => void;
  onEditManualSale: () => void;
  onDeleteClick: () => void;
  onRejectClick: () => void;
}

export function OrderDetailsActions({
  isAdmin,
  canCreateEditInvoice,
  canDownloadInvoice,
  canEditManualSale,
  canDeleteOrder,
  canReject,
  isRejecting,
  isDownloading,
  isDeleting,
  hasInvoice,
  onOpenChange,
  onDownloadInvoice,
  onCreateEditInvoice,
  onPrefetchInvoice,
  onEditManualSale,
  onDeleteClick,
  onRejectClick,
}: OrderDetailsActionsProps) {
  return (
    <div className="border-t border-border bg-background pt-4 space-y-3 shrink-0">
      {isAdmin && (canCreateEditInvoice || canDownloadInvoice) && (
        <div className="flex gap-2 pb-3 border-b border-border">
          {canCreateEditInvoice && (
            <Button
              variant="outline"
              onClick={onCreateEditInvoice}
              onMouseEnter={onPrefetchInvoice}
              onFocus={onPrefetchInvoice}
              disabled={isRejecting}
            >
              <FileText className="mr-2 h-4 w-4" />
              {hasInvoice ? "Edit Invoice" : "Create Invoice"}
            </Button>
          )}
          {canDownloadInvoice && (
            <Button
              variant="outline"
              onClick={onDownloadInvoice}
              disabled={isDownloading || isRejecting}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Invoice
                </>
              )}
            </Button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isRejecting || isDeleting}
        >
          Close
        </Button>
        {canEditManualSale && (
          <Button variant="outline" onClick={onEditManualSale} disabled={isRejecting || isDeleting}>
            <ShoppingBag className="mr-2 h-4 w-4" />
            Edit manual sale
          </Button>
        )}
        {canDeleteOrder && (
          <Button
            variant="destructive"
            onClick={onDeleteClick}
            disabled={isRejecting || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Order
          </Button>
        )}
        {canReject && (
          <Button
            variant="destructive"
            onClick={onRejectClick}
            disabled={isRejecting || isDeleting}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject Order
          </Button>
        )}
      </div>
    </div>
  );
}
