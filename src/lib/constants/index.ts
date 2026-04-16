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
export const PAYMENT_METHODS = ["EMT", "WIRE", "CHQ", "CASH", "CREDIT", "DEBIT"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Inventory Sort Order
export const INVENTORY_SORT_ORDER = {
  created_at: { ascending: true },
  id: { ascending: true },
} as const;

// IMEI label stock: DYMO 30252 — 3-1/2" × 1-1/8" (width × height, landscape strip)
const MM_PER_IN = 25.4;
const DYMO_30252_WIDTH_IN = 3.5;
const DYMO_30252_HEIGHT_IN = 1.125;

export const IMEI_LABEL_WIDTH_MM = DYMO_30252_WIDTH_IN * MM_PER_IN;
export const IMEI_LABEL_HEIGHT_MM = DYMO_30252_HEIGHT_IN * MM_PER_IN;
export const IMEI_BARCODE_HEIGHT = 48; // barcode height in pixels for canvas rendering

// Bulk Label Sheet Layout (reserved for future multi-up layouts; bulk print uses per-page below)
export const BULK_LABEL_COLUMNS = 3; // labels per row on the print sheet
export const BULK_LABEL_GAP_MM = 4; // gap between labels in millimeters

// Per-page label (one label per page) — same stock as single print (DYMO 30252)
export const IMEI_PAGE_LABEL_WIDTH_MM = IMEI_LABEL_WIDTH_MM;
export const IMEI_PAGE_LABEL_HEIGHT_MM = IMEI_LABEL_HEIGHT_MM;
