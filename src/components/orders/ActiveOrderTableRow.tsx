"use client";

import { memo } from "react";
import { Eye } from "lucide-react";
import { RejectionNote } from "@/components/common/RejectionNote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Order } from "@/types/order";
import { cn, formatDateInOntario, formatPrice } from "@/lib/utils";
import { getStatusColor, getStatusLabel } from "@/lib/utils/status";

export interface ActiveOrderTableRowProps {
  brands: string;
  customerLabel: string;
  index: number;
  itemCount: number;
  onView: (order: Order) => void;
  order: Order;
}

export const ActiveOrderTableRow = memo(function ActiveOrderTableRow({
  brands,
  customerLabel,
  index,
  itemCount,
  onView,
  order,
}: ActiveOrderTableRowProps) {
  return (
    <tr
      className={cn("transition-colors hover:bg-table-hover", index % 2 === 1 && "bg-table-zebra")}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">#{order.id.slice(-8).toUpperCase()}</span>
          {order.isManualSale && (
            <Badge
              variant="outline"
              className="border-orange-300 bg-orange-50 px-1.5 py-0 text-xs text-orange-600 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400"
            >
              Manual
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-foreground">{customerLabel}</td>
      <td className="px-4 py-4 text-sm text-foreground">{brands}</td>
      <td className="px-4 py-4 text-center text-sm text-foreground">{itemCount} item(s)</td>
      <td className="px-4 py-4 text-right">
        <span className="font-semibold text-foreground">{formatPrice(order.totalPrice)}</span>
      </td>
      <td className="px-4 py-4 text-center">
        <Badge variant="outline" className={cn("text-xs", getStatusColor(order.status))}>
          {getStatusLabel(order.status)}
        </Badge>
      </td>
      <td className="px-4 py-4 text-sm text-muted-foreground">
        {formatDateInOntario(order.createdAt)}
      </td>
      <td className="px-4 py-4">
        {order.status === "rejected" ? (
          <RejectionNote
            rejectionReason={order.rejectionReason}
            rejectionComment={order.rejectionComment}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-6 py-4 text-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onView(order)}
          className="h-8 w-8"
          aria-label={`View order ${order.id.slice(-8).toUpperCase()}`}
        >
          <Eye className="h-4 w-4" aria-hidden />
        </Button>
      </td>
    </tr>
  );
});
