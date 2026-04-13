"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { DeletedOrder } from "@/lib/supabase/queries";
import { cn, formatDateInOntario, formatPrice } from "@/lib/utils";
import { getStatusColor, getStatusLabel } from "@/lib/utils/status";

export interface DeletedOrderTableRowProps {
  customerLabel: string;
  index: number;
  order: DeletedOrder;
}

export const DeletedOrderTableRow = memo(function DeletedOrderTableRow({
  customerLabel,
  index,
  order,
}: DeletedOrderTableRowProps) {
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
      <td className="px-6 py-4 text-sm text-muted-foreground">
        {formatDateInOntario(order.deletedAt)}
      </td>
    </tr>
  );
});
