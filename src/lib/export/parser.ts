import * as XLSX from "xlsx";
import { ParsedProduct } from "@/types/upload";
import { calculatePricePerUnit } from "@/data/inventory";
import {
  GRADES,
  normalizeGrade,
} from "@/lib/constants/grades";

/**
 * Parse Excel file and extract product data
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

        // Convert sheet to JSON array
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        }) as any[][];

        if (jsonData.length < 2) {
          reject(
            new Error(
              "Excel file must have at least a header row and one data row"
            )
          );
          return;
        }

        // Get header row (first row)
        const headers = jsonData[0].map((h: any) =>
          String(h).trim().toLowerCase()
        );

        // Find column indices
        const deviceNameIndex = findColumnIndex(headers, [
          "device name",
          "devicename",
          "device",
        ]);
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

        // Validate required columns
        const missingColumns: string[] = [];
        if (deviceNameIndex === -1) missingColumns.push("Device Name");
        if (brandIndex === -1) missingColumns.push("Brand");
        if (gradeIndex === -1) missingColumns.push("Grade");
        if (storageIndex === -1) missingColumns.push("Storage");
        if (quantityIndex === -1) missingColumns.push("Quantity");
        if (purchasePriceIndex === -1) missingColumns.push("Purchase Price");
        if (sellingPriceIndex === -1) missingColumns.push("Selling Price");
        if (hstIndex === -1) missingColumns.push("HST");

        if (missingColumns.length > 0) {
          reject(
            new Error(`Missing required columns: ${missingColumns.join(", ")}`)
          );
          return;
        }

        // Parse data rows (skip header row)
        const products: ParsedProduct[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNumber = i + 1; // 1-indexed for user display

          // Skip empty rows
          if (row.every((cell: any) => !cell || String(cell).trim() === "")) {
            continue;
          }

          const rawGrade = String(row[gradeIndex] || "").trim();
          const normalizedGrade = normalizeGrade(rawGrade);
          const product: ParsedProduct = {
            deviceName: String(row[deviceNameIndex] || "").trim(),
            brand: String(row[brandIndex] || "").trim(),
            grade: normalizedGrade ?? "A",
            storage: String(row[storageIndex] || "").trim(),
            quantity: parseNumber(row[quantityIndex]),
            purchasePrice: parseNumber(row[purchasePriceIndex]),
            sellingPrice: parseNumber(row[sellingPriceIndex]),
            hst: parseNumber(row[hstIndex]),
            lastUpdated:
              lastUpdatedIndex >= 0
                ? String(row[lastUpdatedIndex] || "").trim()
                : undefined,
            rowNumber,
            errors: [],
          };

          // Validate product data
          const validation = validateProductData(product);
          if (!validation.valid) {
            product.errors = validation.errors;
          }

          products.push(product);
        }

        resolve(products);
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Failed to parse Excel file")
        );
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
function parseNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Remove currency symbols, commas, and whitespace
    const cleaned = value.replace(/[$,\s]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
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

  // Required fields
  if (!data.deviceName || data.deviceName.trim() === "") {
    errors.push("Device Name is required");
  }

  if (!data.brand || data.brand.trim() === "") {
    errors.push("Brand is required");
  }

  // Grade validation
  if (!data.grade) {
    errors.push("Grade is required");
  } else {
    const normalized = normalizeGrade(data.grade);
    if (!normalized || !GRADES.includes(normalized)) {
      errors.push(
        `Grade must be one of: ${GRADES.join(", ")}`
      );
    }
  }

  if (!data.storage || data.storage.trim() === "") {
    errors.push("Storage is required");
  }

  // Quantity validation
  if (data.quantity === undefined || data.quantity === null) {
    errors.push("Quantity is required");
  } else if (typeof data.quantity !== "number" || isNaN(data.quantity)) {
    errors.push("Quantity must be a valid number");
  } else if (data.quantity < 0) {
    errors.push("Quantity must be >= 0");
  }

  // Purchase Price validation
  if (data.purchasePrice === undefined || data.purchasePrice === null) {
    errors.push("Purchase Price is required");
  } else if (
    typeof data.purchasePrice !== "number" ||
    isNaN(data.purchasePrice)
  ) {
    errors.push("Purchase Price must be a valid number");
  } else if (data.purchasePrice < 0) {
    errors.push("Purchase Price must be >= 0");
  }

  // Selling Price validation
  if (data.sellingPrice === undefined || data.sellingPrice === null) {
    errors.push("Selling Price is required");
  } else if (
    typeof data.sellingPrice !== "number" ||
    isNaN(data.sellingPrice)
  ) {
    errors.push("Selling Price must be a valid number");
  } else if (data.sellingPrice <= 0) {
    errors.push("Selling Price must be > 0");
  }

  // HST validation
  if (data.hst === undefined || data.hst === null) {
    errors.push("HST is required");
  } else if (typeof data.hst !== "number" || isNaN(data.hst)) {
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
  // Format last updated date
  let lastUpdated = "Just now";
  if (parsed.lastUpdated && parsed.lastUpdated.trim() !== "") {
    try {
      // Try to parse and format the date
      const date = new Date(parsed.lastUpdated);
      if (!isNaN(date.getTime())) {
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

  // Auto-calculate price per unit: (purchasePrice / quantity) * (1 + hst/100)
  const pricePerUnit = calculatePricePerUnit(
    parsed.purchasePrice,
    parsed.quantity,
    parsed.hst
  );

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
