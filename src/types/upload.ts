export interface UploadHistory {
  id: string;
  uploadedBy: string;
  fileName: string;
  totalProducts: number;
  successfulInserts: number;
  failedInserts: number;
  uploadStatus: 'pending' | 'completed' | 'failed';
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

import type { Grade } from "@/lib/constants/grades";

export interface ParsedProduct {
  deviceName: string;
  brand: string;
  grade: Grade;
  storage: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  hst: number;
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
