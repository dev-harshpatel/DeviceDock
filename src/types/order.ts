import { InventoryItem } from "@/data/inventory";

export type OrderStatus = "pending" | "approved" | "rejected" | "completed";

export interface OrderItem {
  item: InventoryItem;
  quantity: number;
  /** When set, this line sold a tracked unit; `inventory_identifiers` is updated on sale. */
  inventoryIdentifierId?: string;
  /** Human-readable IMEI or serial number shown in order history (stored at sale time). */
  identifierLabel?: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  taxRate: number | null;
  taxAmount: number | null;
  totalPrice: number;
  /** Gross profit snapshot (manual sale / RPC updates). */
  profit?: number | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string | null;
  rejectionComment?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  poNumber?: string | null;
  paymentTerms?: string | null;
  dueDate?: string | null;
  hstNumber?: string | null;
  invoiceNotes?: string | null;
  invoiceTerms?: string | null;
  invoiceConfirmed?: boolean;
  invoiceConfirmedAt?: string | null;
  discountAmount?: number;
  discountType?: "percentage" | "cad";
  shippingAmount?: number;
  // Addresses (full address string only)
  shippingAddress?: string | null;
  billingAddress?: string | null;
  // IMEI numbers keyed by item index (e.g. {"0": "123456789012345"})
  imeiNumbers?: Record<string, string> | null;
  // Manual sale fields (when admin records an off-platform sale)
  isManualSale?: boolean;
  manualCustomerName?: string | null;
  manualCustomerEmail?: string | null;
  manualCustomerPhone?: string | null;
}

// Extended order with user profile info (for display)
export interface OrderWithUser extends Order {
  userEmail?: string;
  userRole?: "user" | "admin";
}
