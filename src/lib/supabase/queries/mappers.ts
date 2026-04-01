/**
 * Database row to model mappers
 * Converts Supabase database rows to application models
 */

import { InventoryItem } from "@/data/inventory";
import type { Grade } from "@/lib/constants/grades";
import { Database } from "@/lib/types/database";
import { Order, OrderItem } from "@/types/order";
import { UserProfile } from "@/types/user";

type InventoryRow = Database["public"]["Tables"]["inventory"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];

type StoredInventoryItem = Partial<{
  brand: string | null;
  deviceName: string | null;
  device_name: string | null;
  grade: string | null;
  hst: number | string | null;
  id: string | number | null;
  item_id: string | number | null;
  lastUpdated: string | null;
  last_updated: string | null;
  priceChange: string | null;
  pricePerUnit: number | string | null;
  price_change: string | null;
  price_per_unit: number | string | null;
  purchasePrice: number | string | null;
  purchase_price: number | string | null;
  quantity: number | string | null;
  sellingPrice: number | string | null;
  selling_price: number | string | null;
  storage: string | null;
  imei: string | null;
  serialNumber: string | null;
  serial_number: string | null;
  status: string | null;
}>;

const coerceFiniteNumber = (value: number | string): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readNumber = (value: number | string | null | undefined): number => {
  if (value == null) return 0;
  return coerceFiniteNumber(value) ?? 0;
};

const readNullableNumber = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  return coerceFiniteNumber(value);
};

const readString = (value: string | number | null | undefined): string =>
  value == null ? "" : String(value);

const VALID_GRADES: Grade[] = ["Brand New Sealed", "Brand New Open Box", "A", "B", "C", "D"];

const readGrade = (value: string | null | undefined): Grade =>
  value && VALID_GRADES.includes(value as Grade) ? (value as Grade) : "A";

const readPriceChange = (value: string | null | undefined): "up" | "down" | "stable" | undefined =>
  value === "up" || value === "down" || value === "stable" ? value : undefined;

export const dbRowToInventoryItem = (row: InventoryRow): InventoryItem => ({
  id: row.id,
  deviceName: row.device_name,
  brand: row.brand,
  grade: row.grade as Grade,
  storage: row.storage,
  quantity: row.quantity,
  pricePerUnit: Number(row.price_per_unit),
  purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
  hst: row.hst != null ? Number(row.hst) : null,
  sellingPrice: row.selling_price != null ? Number(row.selling_price) : Number(row.price_per_unit),
  lastUpdated: row.last_updated,
  priceChange: (row.price_change ?? undefined) as "up" | "down" | "stable" | undefined,
  isActive: (row as any).is_active ?? true,
  imei: (row as any).imei ?? null,
  serialNumber: (row as any).serial_number ?? null,
  status: (row as any).status ?? "in_stock",
});

export const dbRowToOrder = (row: OrderRow): Order => {
  let items: OrderItem[] = [];

  if (row.items) {
    try {
      if (typeof row.items === "string") {
        const parsed = JSON.parse(row.items);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } else if (Array.isArray(row.items)) {
        items = row.items as unknown as OrderItem[];
      } else if (typeof row.items === "object" && row.items !== null) {
        if ("item" in row.items && "quantity" in row.items) {
          items = [row.items as unknown as OrderItem];
        } else {
          const values = Object.values(row.items);
          if (values.length > 0 && Array.isArray(values[0])) {
            items = values[0] as unknown as OrderItem[];
          } else {
            items = values.filter(
              (v) => typeof v === "object" && v !== null && "item" in v && "quantity" in v,
            ) as unknown as OrderItem[];
          }
        }
      }
    } catch {
      items = [];
    }
  }

  items = items.filter(
    (item): item is OrderItem =>
      item !== null &&
      typeof item === "object" &&
      "item" in item &&
      "quantity" in item &&
      item.item !== null &&
      typeof item.item === "object",
  );

  // Normalize each item's product so the app always sees camelCase (deviceName, sellingPrice, etc.)
  const normalizedItems: OrderItem[] = items.map((oi) => {
    const raw: StoredInventoryItem = oi.item;
    const quantity = typeof oi.quantity === "number" ? oi.quantity : 1;
    const pricePerUnit = readNumber(raw.pricePerUnit ?? raw.price_per_unit);
    return {
      quantity,
      ...(typeof (oi as any).inventoryIdentifierId === "string" && {
        inventoryIdentifierId: (oi as any).inventoryIdentifierId as string,
      }),
      ...(typeof (oi as any).identifierLabel === "string" && {
        identifierLabel: (oi as any).identifierLabel as string,
      }),
      item: {
        id: readString(raw.id ?? raw.item_id),
        deviceName: readString(raw.deviceName ?? raw.device_name),
        brand: readString(raw.brand),
        grade: readGrade(raw.grade),
        storage: readString(raw.storage),
        quantity: readNumber(raw.quantity),
        pricePerUnit,
        purchasePrice: readNullableNumber(raw.purchasePrice ?? raw.purchase_price),
        hst: readNullableNumber(raw.hst),
        sellingPrice: readNumber(
          raw.sellingPrice ?? raw.selling_price ?? raw.pricePerUnit ?? raw.price_per_unit,
        ),
        lastUpdated: readString(raw.lastUpdated ?? raw.last_updated),
        priceChange: readPriceChange(raw.priceChange ?? raw.price_change),
        imei: readString(raw.imei),
        serialNumber: readString(raw.serialNumber ?? raw.serial_number),
        status: readString(raw.status) || "in_stock",
      },
    };
  });

  return {
    id: row.id,
    userId: row.user_id,
    items: normalizedItems,
    subtotal: Number((row as any).subtotal ?? row.total_price),
    taxRate: (row as any).tax_rate ? Number((row as any).tax_rate) : null,
    taxAmount: (row as any).tax_amount ? Number((row as any).tax_amount) : null,
    totalPrice: Number(row.total_price),
    status: row.status as Order["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rejectionReason: (row as any).rejection_reason ?? null,
    rejectionComment: (row as any).rejection_comment ?? null,
    invoiceNumber: (row as any).invoice_number ?? null,
    invoiceDate: (row as any).invoice_date ?? null,
    poNumber: (row as any).po_number ?? null,
    paymentTerms: (row as any).payment_terms ?? null,
    dueDate: (row as any).due_date ?? null,
    hstNumber: (row as any).hst_number ?? null,
    invoiceNotes: (row as any).invoice_notes ?? null,
    invoiceTerms: (row as any).invoice_terms ?? null,
    invoiceConfirmed: (row as any).invoice_confirmed ?? false,
    invoiceConfirmedAt: (row as any).invoice_confirmed_at ?? null,
    discountAmount: (row as any).discount_amount ? Number((row as any).discount_amount) : 0,
    discountType: (row as any).discount_type as "percentage" | "cad" | undefined,
    shippingAmount: (row as any).shipping_amount ? Number((row as any).shipping_amount) : 0,
    shippingAddress: (row as any).shipping_address ?? null,
    billingAddress: (row as any).billing_address ?? null,
    imeiNumbers:
      (row as any).imei_numbers != null &&
      typeof (row as any).imei_numbers === "object" &&
      !Array.isArray((row as any).imei_numbers)
        ? ((row as any).imei_numbers as Record<string, string>)
        : null,
    isManualSale: (row as any).is_manual_sale ?? false,
    manualCustomerName: (row as any).manual_customer_name ?? null,
    manualCustomerEmail: (row as any).manual_customer_email ?? null,
    manualCustomerPhone: (row as any).manual_customer_phone ?? null,
  };
};

export const dbRowToUserProfile = (row: UserProfileRow): UserProfile => ({
  id: row.id,
  userId: row.user_id,
  role: row.role,
  approvalStatus: row.approval_status,
  approvalStatusUpdatedAt: row.approval_status_updated_at,
  firstName: row.first_name,
  lastName: row.last_name,
  phone: row.phone,
  businessName: row.business_name,
  businessAddress: row.business_address,
  businessAddressComponents: row.business_address_components as Record<string, any> | null,
  businessState: row.business_state,
  businessCity: row.business_city,
  businessCountry: row.business_country,
  businessYears: row.business_years,
  businessWebsite: row.business_website,
  businessEmail: row.business_email,
  // Shipping Address
  shippingAddress: (row as any).shipping_address ?? null,
  shippingAddressComponents:
    ((row as any).shipping_address_components as Record<string, any> | null) ?? null,
  shippingCity: (row as any).shipping_city ?? null,
  shippingState: (row as any).shipping_state ?? null,
  shippingCountry: (row as any).shipping_country ?? null,
  shippingPostalCode: (row as any).shipping_postal_code ?? null,
  // Billing Address
  billingAddress: (row as any).billing_address ?? null,
  billingAddressComponents:
    ((row as any).billing_address_components as Record<string, any> | null) ?? null,
  billingCity: (row as any).billing_city ?? null,
  billingState: (row as any).billing_state ?? null,
  billingCountry: (row as any).billing_country ?? null,
  billingPostalCode: (row as any).billing_postal_code ?? null,
  // Flags
  shippingSameAsBusiness: (row as any).shipping_same_as_business ?? false,
  billingSameAsBusiness: (row as any).billing_same_as_business ?? false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
