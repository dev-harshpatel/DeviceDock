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
}

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
  /** Per-unit rows for `inventory_identifiers` (IMEI list + serial list, count = quantity) */
  identifiers: ParsedIdentifierEntry[];
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
