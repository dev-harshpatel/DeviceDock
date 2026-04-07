/**
 * Application-wide constants
 * Centralized constants to avoid hardcoded values throughout the codebase
 */

// Timezone
export const ONTARIO_TIMEZONE = "America/Toronto";

// Company Information (fallback defaults)
export const DEFAULT_COMPANY_NAME = "HARI OM TRADERS LTD.";
export const DEFAULT_COMPANY_ADDRESS = "48 Pickard Lane, Brampton, ON, L6Y 2M5";

// Search & Debounce
export const SEARCH_DEBOUNCE_MS = 300;

// Blob Cleanup Timeout
export const BLOB_CLEANUP_TIMEOUT_MS = 200;

// Bulk Operations
export const BULK_INSERT_BATCH_SIZE = 50;

// Payment Methods
export const PAYMENT_METHODS = ["EMT", "WIRE", "CHQ", "CASH"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Inventory Sort Order
export const INVENTORY_SORT_ORDER = {
  created_at: { ascending: true },
  id: { ascending: true },
} as const;

// IMEI Label Dimensions (in millimeters) — adjust values as needed
export const IMEI_LABEL_WIDTH_MM = 50;
export const IMEI_LABEL_HEIGHT_MM = 25;
export const IMEI_BARCODE_HEIGHT = 50; // barcode height in pixels for canvas rendering

// Bulk Label Sheet Layout
export const BULK_LABEL_COLUMNS = 3; // labels per row on the print sheet
export const BULK_LABEL_GAP_MM = 4; // gap between labels in millimeters
