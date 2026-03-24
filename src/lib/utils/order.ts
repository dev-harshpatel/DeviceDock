/**
 * Order Utilities
 * Helper functions for order-related calculations
 */

import { Order, OrderItem, OrderStatus } from "@/types/order";
import { InventoryItem } from "@/data/inventory";

/**
 * Calculate the quantity of an item that is reserved in pending orders for a user
 * Only counts orders with status 'pending' - approved/rejected/completed orders don't reserve inventory
 */
export const getReservedQuantityInPendingOrders = (
  itemId: string,
  userId: string,
  orders: Order[]
): number => {
  // Filter to only pending orders for this user
  const pendingOrders = orders.filter(
    (order) => order.userId === userId && order.status === "pending"
  );

  let reservedQuantity = 0;

  for (const order of pendingOrders) {
    if (!Array.isArray(order.items)) continue;

    for (const orderItem of order.items) {
      if (orderItem.item?.id === itemId) {
        reservedQuantity += orderItem.quantity || 0;
      }
    }
  }

  return reservedQuantity;
};

/**
 * Calculate the quantity of an item that is in the user's cart
 */
export const getQuantityInCart = (
  itemId: string,
  cartItems: Array<{ item: InventoryItem; quantity: number }>
): number => {
  const cartItem = cartItems.find((cartItem) => cartItem.item.id === itemId);
  return cartItem?.quantity || 0;
};

/**
 * Calculate available quantity for a user to order
 * Takes into account:
 * - Total inventory quantity
 * - Items already in user's cart
 * - Items in user's pending orders
 */
export const getAvailableQuantityForUser = (
  item: InventoryItem,
  userId: string | null,
  orders: Order[],
  cartItems: Array<{ item: InventoryItem; quantity: number }>
): number => {
  const totalInventory = item.quantity;

  // If no user, only check cart
  if (!userId) {
    const cartQuantity = getQuantityInCart(item.id, cartItems);
    return Math.max(0, totalInventory - cartQuantity);
  }

  // Calculate reserved quantities
  const reservedInPendingOrders = getReservedQuantityInPendingOrders(
    item.id,
    userId,
    orders
  );
  const cartQuantity = getQuantityInCart(item.id, cartItems);

  // Available = total - reserved in pending orders - in cart
  const available = totalInventory - reservedInPendingOrders - cartQuantity;

  return Math.max(0, available);
};
