"use client";

import { Order } from "@/types/order";
import { OrderItemCard } from "@/components/modals/OrderItemCard";

interface OrderItemsSectionProps {
  order: Order;
  colorAssignments: Record<string, { color: string; quantity: number }[]>;
  fetchedIdentifierLabels: Record<string, string>;
  fetchedIdentifierColors: Record<string, string>;
  fetchedIdentifierDamageNotes: Record<string, string>;
  isAdmin: boolean;
}

export function OrderItemsSection({
  order,
  colorAssignments,
  fetchedIdentifierLabels,
  fetchedIdentifierColors,
  fetchedIdentifierDamageNotes,
  isAdmin,
}: OrderItemsSectionProps) {
  const orderItems = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">Order Items</h3>
      {orderItems.length > 0 ? (
        <div className="space-y-3">
          {orderItems.map((oi, i) =>
            oi?.item ? (
              <OrderItemCard
                key={i}
                orderItem={oi}
                colorAssignments={isAdmin ? colorAssignments : undefined}
                fetchedIdentifierLabels={isAdmin ? fetchedIdentifierLabels : undefined}
                fetchedIdentifierColors={isAdmin ? fetchedIdentifierColors : undefined}
                fetchedIdentifierDamageNotes={isAdmin ? fetchedIdentifierDamageNotes : undefined}
              />
            ) : null,
          )}
        </div>
      ) : (
        <p className="p-4 text-center text-sm text-muted-foreground">No items in this order</p>
      )}
    </div>
  );
}
