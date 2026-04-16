"use client";

import { UseFormReturn } from "react-hook-form";
import { rateToPercent } from "@/lib/tax";
import { formatPrice } from "@/data/inventory";
import { GRADE_LABELS } from "@/lib/constants/grades";
import type { Order } from "@/types/order";
import type { InvoiceFormData } from "@/types/invoice";

interface InvoiceOrderSidebarProps {
  order: Order;
  form: UseFormReturn<InvoiceFormData>;
  customerInfo: { businessName?: string | null; businessAddress?: string | null } | null;
  imeiNumbers: Record<string, string>;
}

export function InvoiceOrderSidebar({
  order,
  form,
  customerInfo,
  imeiNumbers,
}: InvoiceOrderSidebarProps) {
  return (
    <div className="md:w-72 lg:w-80 md:flex-shrink-0 md:min-h-0 md:overflow-y-auto space-y-6">
      {/* Order Summary */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4 shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Order Summary</h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer:</span>
            <span className="font-medium text-foreground">
              {customerInfo?.businessName || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Date:</span>
            <span className="font-medium text-foreground">
              {new Date(order.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items:</span>
            <span className="font-medium text-foreground">
              {Array.isArray(order.items) ? order.items.length : 0}
            </span>
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          {/* Subtotal */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium text-foreground">{formatPrice(order.subtotal)}</span>
          </div>
          {(() => {
            const discountType = form.watch("discountType") || "cad";
            const discountValue = parseFloat(form.watch("discountAmount") || "0") || 0;
            const shippingValue = parseFloat(form.watch("shippingAmount") || "0") || 0;
            const currentDiscount = order.discountAmount || 0;
            const currentShipping = order.shippingAmount || 0;

            let calculatedDiscount = 0;
            if (discountValue > 0) {
              if (discountType === "percentage") {
                calculatedDiscount = (order.subtotal * discountValue) / 100;
              } else {
                calculatedDiscount = discountValue;
              }
            }

            const displayDiscount = calculatedDiscount > 0 ? calculatedDiscount : currentDiscount;
            const displayShipping = shippingValue > 0 ? shippingValue : currentShipping;

            const result = order.subtotal - displayDiscount + displayShipping;

            const taxRate = order.taxRate || 0;
            const calculatedTax = result * taxRate;
            const currentTax = order.taxAmount || 0;
            const displayTax =
              (calculatedDiscount > 0 && calculatedDiscount !== currentDiscount) ||
              (shippingValue > 0 && shippingValue !== currentShipping)
                ? calculatedTax
                : currentTax;

            const calculatedTotal = result + displayTax;

            return (
              <>
                {displayDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="font-medium text-success">
                      -{formatPrice(displayDiscount)}
                      {discountValue > 0 && discountType === "percentage" && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({discountValue}%)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {displayShipping > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping:</span>
                    <span className="font-medium text-foreground">
                      {formatPrice(displayShipping)}
                    </span>
                  </div>
                )}
                {(displayDiscount > 0 || displayShipping > 0) && (
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-muted-foreground font-medium">Result:</span>
                    <span className="font-semibold text-foreground">{formatPrice(result)}</span>
                  </div>
                )}
                {order.taxRate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Tax ({rateToPercent(order.taxRate).toFixed(2)}%):
                    </span>
                    <span className="font-medium text-foreground">{formatPrice(displayTax)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-semibold text-foreground">Total:</span>
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(Math.max(0, calculatedTotal))}
                  </span>
                </div>
                {(calculatedDiscount > 0 && calculatedDiscount !== currentDiscount) ||
                (shippingValue > 0 && shippingValue !== currentShipping) ? (
                  <p className="text-xs text-muted-foreground italic">
                    * Total will update after saving
                  </p>
                ) : null}
              </>
            );
          })()}
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4 shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Order Items</h2>
        <div className="max-h-[320px] overflow-y-auto -mr-2 pr-2 space-y-0">
          {Array.isArray(order.items) && order.items.length > 0 ? (
            order.items.map((orderItem, index) => {
              if (!orderItem?.item) return null;
              const itemKey = String(index);
              return (
                <div key={index} className="py-3 border-b border-border last:border-b-0 space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-medium text-foreground truncate">
                        {orderItem.item.deviceName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {GRADE_LABELS[orderItem.item.grade as keyof typeof GRADE_LABELS] ??
                          orderItem.item.grade}{" "}
                        • {orderItem.item.storage} • Qty: {orderItem.quantity}
                      </p>
                    </div>
                    <p className="font-medium text-foreground text-sm shrink-0">
                      {formatPrice(orderItem.item.pricePerUnit * orderItem.quantity)}
                    </p>
                  </div>
                  {imeiNumbers[itemKey] && (
                    <div className="mt-1">
                      <p className="text-xs text-muted-foreground mb-1">IMEI</p>
                      <p className="text-xs font-mono text-foreground">{imeiNumbers[itemKey]}</p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground py-2">No items</p>
          )}
        </div>
      </div>
    </div>
  );
}
