import { rateToPercent } from "@/lib/tax";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/types/order";

interface OrderTotalSectionProps {
  order: Order;
}

export function OrderTotalSection({ order }: OrderTotalSectionProps) {
  const discount = order.discountAmount || 0;
  const shipping = order.shippingAmount || 0;
  const showResult = discount > 0 || shipping > 0;
  const result = (order.subtotal || 0) - discount + shipping;

  return (
    <div className="border-t border-border pt-4 space-y-2">
      {order.subtotal !== undefined && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal:</span>
          <span className="font-medium text-foreground">{formatPrice(order.subtotal)}</span>
        </div>
      )}

      {discount > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Discount:</span>
          <span className="font-medium text-success">-{formatPrice(discount)}</span>
        </div>
      )}

      {shipping > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Shipping:</span>
          <span className="font-medium text-foreground">{formatPrice(shipping)}</span>
        </div>
      )}

      {showResult && (
        <div className="flex items-center justify-between text-sm pt-1">
          <span className="text-muted-foreground font-medium">Result:</span>
          <span className="font-semibold text-foreground">{formatPrice(result)}</span>
        </div>
      )}

      {order.taxAmount && order.taxRate && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Tax ({rateToPercent(order.taxRate).toFixed(2)}%):
          </span>
          <span className="font-medium text-foreground">{formatPrice(order.taxAmount)}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-base sm:text-lg font-semibold text-foreground">Total:</span>
        <span className="text-xl sm:text-2xl font-bold text-primary">
          {formatPrice(order.totalPrice)}
        </span>
      </div>
    </div>
  );
}
