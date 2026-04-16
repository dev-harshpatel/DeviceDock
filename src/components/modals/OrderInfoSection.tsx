import { formatDateTimeInOntario } from "@/lib/utils/formatters";
import type { Order } from "@/types/order";

interface OrderInfoSectionProps {
  order: Order;
  customerEmail: string | null;
}

export function OrderInfoSection({ order, customerEmail }: OrderInfoSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">Order Information</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Customer:</span>
          {order.isManualSale ? (
            <>
              <p className="font-medium text-foreground mt-1">
                {order.manualCustomerName || "Walk-in Customer"}
              </p>
              {order.manualCustomerEmail && (
                <p className="text-xs text-muted-foreground">{order.manualCustomerEmail}</p>
              )}
              {order.manualCustomerPhone && (
                <p className="text-xs text-muted-foreground">{order.manualCustomerPhone}</p>
              )}
            </>
          ) : (
            <p className="font-medium text-foreground mt-1">
              {customerEmail || order.userId.slice(0, 8) + "..."}
            </p>
          )}
        </div>

        <div>
          <span className="text-muted-foreground">Order Date:</span>
          <p className="font-medium text-foreground mt-1">
            {formatDateTimeInOntario(order.createdAt)}
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">Last Updated:</span>
          <p className="font-medium text-foreground mt-1">
            {formatDateTimeInOntario(order.updatedAt)}
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">Total Items:</span>
          <p className="font-medium text-foreground mt-1">
            {Array.isArray(order.items) ? order.items.length : 0} item(s)
          </p>
        </div>
      </div>
    </div>
  );
}
