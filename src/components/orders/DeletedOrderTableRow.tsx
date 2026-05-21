"use client";

import { memo } from "react";
import { DeletedOrder } from "@/lib/supabase/queries";
import { cn, formatDateInOntario, formatPrice } from "@/lib/utils";

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
        <span className="font-medium text-foreground">#{order.id.slice(-8).toUpperCase()}</span>
      </td>
      <td className="px-4 py-4 text-sm text-foreground">{customerLabel}</td>
      <td className="px-4 py-4 text-right">
        <span className="font-semibold text-foreground">{formatPrice(order.totalPrice)}</span>
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
