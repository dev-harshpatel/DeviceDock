import * as XLSX from "xlsx";
import { ParsedProduct } from "@/types/upload";
import { calculatePricePerUnit } from "@/data/inventory";
import { GRADES, normalizeGrade } from "@/lib/constants/grades";
import {
  applyFileLevelIdentifierDuplicateDetection,
  applyUnitRowGroupPricingValidation,
  buildIdentifiersForUnitRow,
  buildIdentifiersFromUploadCells,
  detectUploadParseMode,
} from "@/lib/export/upload-identifier-validation";

/**
 * Normalize a spreadsheet cell to a trimmed string (IMEI as Text avoids Excel rounding).
 */
const cellToString = (cell: unknown): string => {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") {
    if (Number.isInteger(cell) && Math.abs(cell) >= 1e15) {
      try {
        return String(BigInt(Math.trunc(cell)));
      } catch {
        return String(cell);
      }
    }
    return String(cell);
  }
  return String(cell).trim();
};

/**
 * Parse Excel file and extract product data (including IMEI / Serial Number columns).
 * @param file - Excel file (.xlsx or .xls)
 * @returns Array of parsed products with validation errors
 */
export async function parseExcelFile(file: File): Promise<ParsedProduct[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read file"));
          return;
        }

        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          reject(new Error("Excel file is empty or has no sheets"));
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        }) as unknown[][];

        if (jsonData.length < 2) {
          reject(new Error("Excel file must have at least a header row and one data row"));
          return;
        }

        const headers = (jsonData[0] ?? []).map((h) =>
          String(h ?? "")
            .trim()
            .toLowerCase(),
        );

        const deviceNameIndex = findColumnIndex(headers, ["device name", "devicename", "device"]);
        const brandIndex = findColumnIndex(headers, ["brand"]);
        const gradeIndex = findColumnIndex(headers, ["grade"]);
        const storageIndex = findColumnIndex(headers, ["storage"]);
        const quantityIndex = findColumnIndex(headers, ["quantity", "qty"]);
        const purchasePriceIndex = findColumnIndex(headers, [
          "purchase price",
          "purchaseprice",
          "purchase_price",
        ]);
        const sellingPriceIndex = findColumnIndex(headers, [
          "selling price",
          "sellingprice",
          "selling_price",
          "price per unit",
          "price",
          "priceperunit",
          "price_per_unit",
        ]);
        const hstIndex = findColumnIndex(headers, ["hst", "tax"]);
        const lastUpdatedIndex = findColumnIndex(headers, [
          "last updated",
          "lastupdated",
          "last_updated",
          "updated",
        ]);
        const imeiIndex = findColumnIndex(headers, ["imei"]);
        const serialIndex = findColumnIndex(headers, [
          "serial number",
          "serialnumber",
          "serial",
          "serial_no",
        ]);
        const colorIndex = findColumnIndex(headers, ["color", "colour", "device color"]);
        const damageNoteIndex = findColumnIndex(headers, [
          "damage note",
          "damagenote",
          "damage_note",
          "damage",
        ]);

        const missingColumns: string[] = [];
        if (deviceNameIndex === -1) missingColumns.push("Device Name");
        if (brandIndex === -1) missingColumns.push("Brand");
        if (gradeIndex === -1) missingColumns.push("Grade");
        if (storageIndex === -1) missingColumns.push("Storage");
        if (quantityIndex === -1) missingColumns.push("Quantity");
        if (purchasePriceIndex === -1) missingColumns.push("Purchase Price");
        if (sellingPriceIndex === -1) missingColumns.push("Selling Price");
        if (hstIndex === -1) missingColumns.push("HST");
        if (imeiIndex === -1) missingColumns.push("IMEI");
        if (serialIndex === -1) missingColumns.push("Serial Number");

        if (missingColumns.length > 0) {
          reject(new Error(`Missing required columns: ${missingColumns.join(", ")}`));
          return;
        }

        const products: ParsedProduct[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] ?? [];
          const rowNumber = i + 1;

          const rowCells = row.map((c) => cellToString(c));
          if (rowCells.every((c) => c === "")) {
            continue;
          }

          const rawGrade = String(row[gradeIndex] ?? "").trim();
          const normalizedGrade = normalizeGrade(rawGrade);
          const quantity = parseNumber(row[quantityIndex]);

          const imeiCellRaw = cellToString(row[imeiIndex]);
          const serialCellRaw = cellToString(row[serialIndex]);
          const colorCellRaw = colorIndex >= 0 ? cellToString(row[colorIndex]) : "";
          const damageNoteCellRaw = damageNoteIndex >= 0 ? cellToString(row[damageNoteIndex]) : "";

          const parseMode = detectUploadParseMode(quantity, imeiCellRaw, serialCellRaw);

          const product: ParsedProduct = {
            deviceName: cellToString(row[deviceNameIndex]),
            brand: cellToString(row[brandIndex]),
            grade: normalizedGrade ?? "A",
            storage: cellToString(row[storageIndex]),
            quantity,
            purchasePrice: parseNumber(row[purchasePriceIndex]),
            sellingPrice: parseNumber(row[sellingPriceIndex]),
            hst: parseNumber(row[hstIndex]),
            imeiCellRaw,
            serialCellRaw,
            colorCellRaw: colorIndex >= 0 ? colorCellRaw : undefined,
            damageNote: damageNoteCellRaw || null,
            identifiers: [],
            parseMode,
            lastUpdated: lastUpdatedIndex >= 0 ? cellToString(row[lastUpdatedIndex]) : undefined,
            rowNumber,
            errors: [],
          };

          const idBundle =
            parseMode === "unit_row"
              ? buildIdentifiersForUnitRow(
                  imeiCellRaw,
                  serialCellRaw,
                  colorCellRaw,
                  damageNoteCellRaw,
                )
              : buildIdentifiersFromUploadCells(imeiCellRaw, serialCellRaw, quantity);
          product.identifiers = idBundle.identifiers;
          const rowErrors: string[] = [...idBundle.errors];

          const validation = validateProductData(product);
          if (!validation.valid) {
            rowErrors.push(...validation.errors);
          }

          product.errors = rowErrors.length > 0 ? rowErrors : undefined;
          products.push(product);
        }

        const withDupes = applyFileLevelIdentifierDuplicateDetection(products);
        resolve(applyUnitRowGroupPricingValidation(withDupes));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Failed to parse Excel file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Find column index by matching header names (case-insensitive)
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const name of possibleNames) {
    const index = normalizedHeaders.indexOf(name.toLowerCase().trim());
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Parse number from cell value
 */
function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "");
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Validate product data
 * @param data - Product data to validate
 * @returns Validation result with errors
 */
export function validateProductData(data: Partial<ParsedProduct>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.deviceName || data.deviceName.trim() === "") {
    errors.push("Device Name is required");
  }

  if (!data.brand || data.brand.trim() === "") {
    errors.push("Brand is required");
  }

  if (!data.grade) {
    errors.push("Grade is required");
  } else {
    const normalized = normalizeGrade(data.grade);
    if (!normalized || !GRADES.includes(normalized)) {
      errors.push(`Grade must be one of: ${GRADES.join(", ")}`);
    }
  }

  if (!data.storage || data.storage.trim() === "") {
    errors.push("Storage is required");
  }

  if (data.quantity === undefined || data.quantity === null) {
    errors.push("Quantity is required");
  } else if (typeof data.quantity !== "number" || Number.isNaN(data.quantity)) {
    errors.push("Quantity must be a valid number");
  } else if (data.quantity < 1) {
    errors.push("Quantity must be at least 1");
  }

  if (data.purchasePrice === undefined || data.purchasePrice === null) {
    errors.push("Purchase Price is required");
  } else if (typeof data.purchasePrice !== "number" || Number.isNaN(data.purchasePrice)) {
    errors.push("Purchase Price must be a valid number");
  } else if (data.purchasePrice < 0) {
    errors.push("Purchase Price must be >= 0");
  }

  if (data.sellingPrice === undefined || data.sellingPrice === null) {
    errors.push("Selling Price is required");
  } else if (typeof data.sellingPrice !== "number" || Number.isNaN(data.sellingPrice)) {
    errors.push("Selling Price must be a valid number");
  } else if (data.sellingPrice <= 0) {
    errors.push("Selling Price must be > 0");
  }

  if (data.hst === undefined || data.hst === null) {
    errors.push("HST is required");
  } else if (typeof data.hst !== "number" || Number.isNaN(data.hst)) {
    errors.push("HST must be a valid number");
  } else if (data.hst < 0) {
    errors.push("HST must be >= 0");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Map parsed product to database format
 * @param parsed - Parsed product from Excel
 * @returns Object ready for database insertion
 */
export function mapToInventoryItem(parsed: ParsedProduct): {
  device_name: string;
  brand: string;
  grade: string;
  storage: string;
  quantity: number;
  price_per_unit: number;
  purchase_price: number;
  selling_price: number;
  hst: number;
  last_updated: string;
} {
  let lastUpdated = "Just now";
  if (parsed.lastUpdated && parsed.lastUpdated.trim() !== "") {
    try {
      const date = new Date(parsed.lastUpdated);
      if (!Number.isNaN(date.getTime())) {
        lastUpdated = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } else {
        lastUpdated = parsed.lastUpdated;
      }
    } catch {
      lastUpdated = parsed.lastUpdated;
    }
  }

  const pricePerUnit = calculatePricePerUnit(parsed.purchasePrice, parsed.quantity, parsed.hst);

  return {
    device_name: parsed.deviceName,
    brand: parsed.brand,
    grade: parsed.grade,
    storage: parsed.storage,
    quantity: parsed.quantity,
    price_per_unit: pricePerUnit,
    purchase_price: parsed.purchasePrice,
    selling_price: parsed.sellingPrice,
    hst: parsed.hst,
    last_updated: lastUpdated,
  };
}

/**
 * Merged SKU from multiple unit-row `ParsedProduct`s (same device/brand/grade/storage).
 */
export function mapMergedUnitGroupToInventoryItem(group: ParsedProduct[]): {
  device_name: string;
  brand: string;
  grade: string;
  storage: string;
  quantity: number;
  price_per_unit: number;
  purchase_price: number;
  selling_price: number;
  hst: number;
  last_updated: string;
} {
  const first = group[0];
  if (!first) {
    throw new Error("Cannot merge an empty unit group");
  }
  const totalQty = group.length;
  const totalPP = group.reduce((sum, p) => sum + (p.purchasePrice ?? 0), 0);
  const pricePerUnit = calculatePricePerUnit(totalPP, totalQty, first.hst);

  let lastUpdated = "Just now";
  if (first.lastUpdated && first.lastUpdated.trim() !== "") {
    try {
      const date = new Date(first.lastUpdated);
      if (!Number.isNaN(date.getTime())) {
        lastUpdated = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } else {
        lastUpdated = first.lastUpdated;
      }
    } catch {
      lastUpdated = first.lastUpdated;
    }
  }

  return {
    device_name: first.deviceName,
    brand: first.brand,
    grade: first.grade,
    storage: first.storage,
    quantity: totalQty,
    price_per_unit: pricePerUnit,
    purchase_price: totalPP,
    selling_price: first.sellingPrice,
    hst: first.hst,
    last_updated: lastUpdated,
  };
}
