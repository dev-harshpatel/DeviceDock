"use client";

import { Order } from "@/types/order";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GradeBadge } from "@/components/common/GradeBadge";
import { RejectionNote } from "@/components/common/RejectionNote";
import { cn } from "@/lib/utils";
import { formatDateInOntario } from "@/lib/utils";
import { getStatusColor, getStatusLabel } from "@/lib/utils/status";
import { Download, FileText, Loader2 } from "lucide-react";

interface OrderDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onDownloadInvoice?: (order: Order) => void;
  isDownloadingInvoice?: boolean;
}

export function OrderDetailSheet({
  open,
  onOpenChange,
  order,
  onDownloadInvoice,
  isDownloadingInvoice,
}: OrderDetailSheetProps) {
  if (!order) return null;

  const brands =
    Array.isArray(order.items) && order.items.length > 0
      ? Array.from(
          new Set(order.items.map((i) => i.item?.brand).filter(Boolean))
        ).join(", ")
      : "N/A";

  const itemCount = Array.isArray(order.items) ? order.items.length : 0;

  const total = !order.invoiceConfirmed
    ? formatPrice((order.subtotal || 0) + (order.taxAmount || 0))
    : formatPrice(order.totalPrice);

  const isRejected = order.status === "rejected";
  const hasDiscount =
    order.discountAmount != null &&
    order.discountAmount > 0 &&
    order.invoiceConfirmed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden"
      >
        {/* Header */}
        <SheetHeader className="text-left pb-4 border-b border-border">
          <SheetTitle className="text-lg font-semibold pr-8">
            Order #{order.id.slice(-8).toUpperCase()}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {/* Status + Total */}
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={cn("text-sm", getStatusColor(order.status))}
            >
              {getStatusLabel(order.status)}
            </Badge>
            <div className="text-right">
              {hasDiscount && (
                <p className="text-xs text-success">
                  Discount: -{formatPrice(order.discountAmount!)}
                </p>
              )}
              <span className="text-xl font-semibold text-foreground">
                {total}
              </span>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 py-4 border-y border-border">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Brand
              </span>
              <span className="font-medium text-foreground">{brands}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Items
              </span>
              <span className="font-medium text-foreground">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground block mb-1">
                Order Date
              </span>
              <span className="font-medium text-foreground">
                {formatDateInOntario(order.createdAt)}
              </span>
            </div>

            {/* Order items */}
            {Array.isArray(order.items) && order.items.length > 0 && (
              <div className="col-span-2 space-y-2">
                <span className="text-xs text-muted-foreground block mb-1">
                  Order Items
                </span>
                {order.items.map((orderItem, idx) => {
                  if (!orderItem?.item) return null;
                  const lineTotal =
                    (orderItem.item.sellingPrice ??
                      orderItem.item.pricePerUnit ??
                      0) * (orderItem.quantity || 0);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {orderItem.item.deviceName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {orderItem.item.grade && (
                            <GradeBadge grade={orderItem.item.grade} />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {orderItem.item.storage}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · Qty: {orderItem.quantity}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap shrink-0">
                        {formatPrice(lineTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Subtotal / Tax summary */}
            {(order.subtotal != null || order.taxAmount != null) && (
              <div className="col-span-2 space-y-1 pt-1 border-t border-border/60">
                {order.subtotal != null && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                )}
                {order.taxAmount != null && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      Tax {order.taxRate != null ? `(${order.taxRate}%)` : ""}
                    </span>
                    <span>{formatPrice(order.taxAmount)}</span>
                  </div>
                )}
                {hasDiscount && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Discount</span>
                    <span>-{formatPrice(order.discountAmount!)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border/60">
                  <span>Total</span>
                  <span>{total}</span>
                </div>
              </div>
            )}

            {/* Rejection note */}
            {isRejected &&
              (order.rejectionReason || order.rejectionComment) && (
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground block mb-1">
                    Rejection Reason
                  </span>
                  <RejectionNote
                    rejectionReason={order.rejectionReason}
                    rejectionComment={order.rejectionComment}
                  />
                </div>
              )}
          </div>

          {/* Action */}
          <div className="pt-2 pb-2">
            {order.invoiceConfirmed && onDownloadInvoice ? (
              <Button
                className="w-full h-12 gap-2"
                onClick={() => onDownloadInvoice(order)}
                disabled={isDownloadingInvoice}
              >
                {isDownloadingInvoice ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                {isDownloadingInvoice ? "Downloading…" : "Download Invoice"}
              </Button>
            ) : (
              <Button
                className="w-full h-12 gap-2"
                variant="outline"
                disabled
              >
                <FileText className="h-5 w-5" />
                Invoice Not Ready
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
