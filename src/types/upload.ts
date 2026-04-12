export interface UploadHistory {
  id: string;
  uploadedBy: string;
  fileName: string;
  totalProducts: number;
  successfulInserts: number;
  failedInserts: number;
  uploadStatus: "pending" | "completed" | "failed";
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

import type { Grade } from "@/lib/constants/grades";

export interface ParsedIdentifierEntry {
  imei: string | null;
  serialNumber: string | null;
  /** Per-unit colour (Excel unit-row mode); stored on `inventory_identifiers.color` */
  color?: string | null;
}

/** One spreadsheet row = one physical unit (mergeable); legacy = comma-separated IMEIs in one row */
export type UploadParseMode = "unit_row" | "legacy_row";

export interface ParsedProduct {
  deviceName: string;
  brand: string;
  grade: Grade;
  storage: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  hst: number;
  /** Raw IMEI column text (spreadsheet cell) for preview */
  imeiCellRaw: string;
  /** Raw Serial Number column text */
  serialCellRaw: string;
  /** Raw Color column (optional) */
  colorCellRaw?: string;
  /** Per-unit rows for `inventory_identifiers` (IMEI list + serial list, count = quantity) */
  identifiers: ParsedIdentifierEntry[];
  /** unit_row: one IMEI or serial per row, qty 1 — rows merge by SKU; legacy: multi-unit per row */
  parseMode: UploadParseMode;
  lastUpdated?: string;
  rowNumber?: number; // For error reporting
  errors?: string[]; // Validation errors
}

export interface BulkInsertResult {
  success: number;
  failed: number;
  errors: string[];
  /** IDs of successfully inserted inventory rows (populated on insert) */
  insertedIds?: string[];
}
