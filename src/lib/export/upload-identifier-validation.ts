import { parseIdentifierList } from "@/lib/inventory/parse-identifier-list";
import type { ParsedIdentifierEntry, ParsedProduct, UploadParseMode } from "@/types/upload";

const CHUNK = 80;

const isImeiTokenValid = (token: string): boolean => {
  const t = token.trim();
  return /^\d{14,17}$/.test(t);
};

const isSerialTokenValid = (token: string): boolean => {
  return token.trim().length > 0;
};

/**
 * Builds per-unit identifier rows from IMEI and Serial Number cells (same rules as manual add:
 * all IMEI tokens + all serial tokens; total count must equal quantity).
 */
export const buildIdentifiersFromUploadCells = (
  imeiCellRaw: string,
  serialCellRaw: string,
  quantity: number,
): { identifiers: ParsedIdentifierEntry[]; errors: string[] } => {
  const errors: string[] = [];
  const imeiTokens = parseIdentifierList(imeiCellRaw);
  const serialTokens = parseIdentifierList(serialCellRaw);

  for (const token of imeiTokens) {
    if (!isImeiTokenValid(token)) {
      errors.push(
        `Invalid IMEI "${token}": use 14–17 digits only (format Excel IMEI column as Text to avoid rounding).`,
      );
    }
  }

  for (const token of serialTokens) {
    if (!isSerialTokenValid(token)) {
      errors.push(`Invalid serial value "${token}".`);
    }
  }

  if (errors.length > 0) {
    return { identifiers: [], errors };
  }

  const identifiers: ParsedIdentifierEntry[] = [
    ...imeiTokens.map((imei) => ({
      imei: imei.trim(),
      serialNumber: null as string | null,
    })),
    ...serialTokens.map((serialNumber) => ({
      imei: null as string | null,
      serialNumber: serialNumber.trim(),
    })),
  ];

  if (identifiers.length !== quantity) {
    errors.push(
      `Identifier count (${identifiers.length}) must equal Quantity (${quantity}). Enter ${quantity} values across IMEI and Serial Number (comma or newline separated).`,
    );
    return { identifiers: [], errors };
  }

  const seen = new Set<string>();
  for (const row of identifiers) {
    const key = (row.imei ?? row.serialNumber ?? "").toLowerCase();
    if (seen.has(key)) {
      errors.push(`Duplicate IMEI/Serial in this row: ${row.imei ?? row.serialNumber}`);
      return { identifiers: [], errors };
    }
    seen.add(key);
  }

  return { identifiers, errors: [] };
};

/**
 * unit_row: quantity === 1 and exactly one identifier token (IMEI or serial) across both cells.
 * Otherwise legacy (comma-separated lists, quantity > 1, etc.).
 */
export const detectUploadParseMode = (
  quantity: number,
  imeiCellRaw: string,
  serialCellRaw: string,
): UploadParseMode => {
  const imeiTokens = parseIdentifierList(imeiCellRaw);
  const serialTokens = parseIdentifierList(serialCellRaw);
  if (quantity === 1 && imeiTokens.length + serialTokens.length === 1) {
    return "unit_row";
  }
  return "legacy_row";
};

/**
 * Single physical unit per spreadsheet row (one IMEI or one serial). Optional colour for that unit.
 */
export const buildIdentifiersForUnitRow = (
  imeiCellRaw: string,
  serialCellRaw: string,
  colorRaw: string | undefined,
): { identifiers: ParsedIdentifierEntry[]; errors: string[] } => {
  const errors: string[] = [];
  const imeiTokens = parseIdentifierList(imeiCellRaw);
  const serialTokens = parseIdentifierList(serialCellRaw);

  if (imeiTokens.length + serialTokens.length !== 1) {
    errors.push(
      "Unit-row format: use Quantity 1 and exactly one IMEI or one Serial (no comma-separated lists). For multiple units, add one row per device or use legacy format with Quantity and comma-separated identifiers.",
    );
    return { identifiers: [], errors };
  }

  for (const token of imeiTokens) {
    if (!isImeiTokenValid(token)) {
      errors.push(
        `Invalid IMEI "${token}": use 14–17 digits only (format Excel IMEI column as Text to avoid rounding).`,
      );
    }
  }

  for (const token of serialTokens) {
    if (!isSerialTokenValid(token)) {
      errors.push(`Invalid serial value "${token}".`);
    }
  }

  if (errors.length > 0) {
    return { identifiers: [], errors };
  }

  const colorTrimmed = colorRaw?.trim() ?? "";
  const color = colorTrimmed.length > 0 ? colorTrimmed : null;

  if (imeiTokens.length === 1) {
    return {
      identifiers: [{ imei: imeiTokens[0].trim(), serialNumber: null, color }],
      errors: [],
    };
  }

  return {
    identifiers: [{ imei: null, serialNumber: serialTokens[0].trim(), color }],
    errors: [],
  };
};

/**
 * Within each SKU group, Selling Price and HST must match for unit-row merge.
 */
export const applyUnitRowGroupPricingValidation = (products: ParsedProduct[]): ParsedProduct[] => {
  const keyToRows = new Map<string, ParsedProduct[]>();

  for (const p of products) {
    if (p.errors && p.errors.length > 0) continue;
    if (p.parseMode !== "unit_row") continue;
    const key = skuKeyForUploadProduct(p);
    const list = keyToRows.get(key) ?? [];
    list.push(p);
    keyToRows.set(key, list);
  }

  const priceMismatchKeys = new Set<string>();

  for (const [key, rows] of keyToRows) {
    if (rows.length < 2) continue;
    const first = rows[0];
    if (!first) continue;
    const sp = first.sellingPrice;
    const h = first.hst;
    const mismatch = rows.some((r) => r.sellingPrice !== sp || r.hst !== h);
    if (mismatch) priceMismatchKeys.add(key);
  }

  if (priceMismatchKeys.size === 0) return products;

  return products.map((p) => {
    if (p.parseMode !== "unit_row") return p;
    const key = skuKeyForUploadProduct(p);
    if (!priceMismatchKeys.has(key)) return p;
    return {
      ...p,
      errors: [
        ...(p.errors ?? []),
        "All rows for the same Device / Brand / Grade / Storage must have the same Selling Price and HST when merging unit rows.",
      ],
    };
  });
};

/** Stable key for grouping mergeable unit rows (company applied at insert). */
export const skuKeyForUploadProduct = (p: ParsedProduct): string => {
  return [
    p.brand.trim().toLowerCase(),
    p.deviceName.trim().toLowerCase(),
    p.grade,
    p.storage.trim().toLowerCase(),
  ].join("|");
};

type Occurrence = { rowNumber: number; kind: "imei" | "serial"; value: string };

/**
 * Marks rows when the same IMEI or serial appears more than once in the file (case-insensitive).
 */
export const applyFileLevelIdentifierDuplicateDetection = (
  products: ParsedProduct[],
): ParsedProduct[] => {
  const keyToOccurrences = new Map<string, Occurrence[]>();

  for (const product of products) {
    if (!product.rowNumber) continue;
    for (const ident of product.identifiers) {
      if (ident.imei) {
        const k = `i:${ident.imei.toLowerCase()}`;
        const list = keyToOccurrences.get(k) ?? [];
        list.push({ rowNumber: product.rowNumber, kind: "imei", value: ident.imei });
        keyToOccurrences.set(k, list);
      }
      if (ident.serialNumber) {
        const k = `s:${ident.serialNumber.toLowerCase()}`;
        const list = keyToOccurrences.get(k) ?? [];
        list.push({
          rowNumber: product.rowNumber,
          kind: "serial",
          value: ident.serialNumber,
        });
        keyToOccurrences.set(k, list);
      }
    }
  }

  const duplicateKeys = new Set<string>();
  for (const [key, list] of keyToOccurrences) {
    if (list.length > 1) duplicateKeys.add(key);
  }

  if (duplicateKeys.size === 0) return products;

  return products.map((product) => {
    const extra: string[] = [];
    for (const ident of product.identifiers) {
      if (ident.imei) {
        const k = `i:${ident.imei.toLowerCase()}`;
        if (duplicateKeys.has(k)) {
          extra.push(`IMEI ${ident.imei} appears more than once in this file (must be unique).`);
        }
      }
      if (ident.serialNumber) {
        const k = `s:${ident.serialNumber.toLowerCase()}`;
        if (duplicateKeys.has(k)) {
          extra.push(
            `Serial ${ident.serialNumber} appears more than once in this file (must be unique).`,
          );
        }
      }
    }
    if (extra.length === 0) return product;
    return {
      ...product,
      errors: [...(product.errors ?? []), ...extra],
    };
  });
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

/**
 * Adds validation errors when IMEI/serial already exist on active inventory_identifiers for this company.
 * Client is typed loosely because `inventory_identifiers` is not in generated `Database` yet.
 */
export const mergeDatabaseIdentifierConflicts = async (
  products: ParsedProduct[],
  companyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client + untyped table name
  supabase: any,
): Promise<ParsedProduct[]> => {
  const db = supabase;
  const imeiValues = new Set<string>();
  const serialValues = new Set<string>();

  for (const p of products) {
    if (p.errors && p.errors.length > 0) continue;
    for (const ident of p.identifiers) {
      if (ident.imei) imeiValues.add(ident.imei);
      if (ident.serialNumber) serialValues.add(ident.serialNumber);
    }
  }

  // Map of lowercase identifier → status; covers ALL statuses so sold devices
  // are blocked from being re-uploaded just like in-stock ones.
  const existingImei = new Map<string, string>();
  const existingSerial = new Map<string, string>();

  for (const batch of chunkArray([...imeiValues], CHUNK)) {
    if (batch.length === 0) continue;
    const { data, error: imeiQueryError } = await db
      .from("inventory_identifiers")
      .select("imei, status")
      .eq("company_id", companyId)
      .not("imei", "is", null)
      .in("imei", batch);

    if (imeiQueryError) {
      console.error("[upload] inventory_identifiers IMEI check failed:", imeiQueryError.message);
      throw new Error(`Could not verify IMEI uniqueness: ${imeiQueryError.message}`);
    }
    for (const row of data ?? []) {
      const r = row as { imei: string | null; status: string };
      if (r.imei) existingImei.set(r.imei.toLowerCase(), r.status);
    }
  }

  for (const batch of chunkArray([...serialValues], CHUNK)) {
    if (batch.length === 0) continue;
    const { data, error: serialQueryError } = await db
      .from("inventory_identifiers")
      .select("serial_number, status")
      .eq("company_id", companyId)
      .not("serial_number", "is", null)
      .in("serial_number", batch);

    if (serialQueryError) {
      console.error(
        "[upload] inventory_identifiers serial check failed:",
        serialQueryError.message,
      );
      throw new Error(`Could not verify serial uniqueness: ${serialQueryError.message}`);
    }
    for (const row of data ?? []) {
      const r = row as { serial_number: string | null; status: string };
      if (r.serial_number) existingSerial.set(r.serial_number.toLowerCase(), r.status);
    }
  }

  return products.map((product) => {
    if (product.errors && product.errors.length > 0) return product;
    const extra: string[] = [];
    for (const ident of product.identifiers) {
      if (ident.imei) {
        const status = existingImei.get(ident.imei.toLowerCase());
        if (status !== undefined) {
          extra.push(
            status === "sold"
              ? `IMEI ${ident.imei} has already been sold and cannot be re-added.`
              : `IMEI ${ident.imei} already exists in your inventory (${status}).`,
          );
        }
      }
      if (ident.serialNumber) {
        const status = existingSerial.get(ident.serialNumber.toLowerCase());
        if (status !== undefined) {
          extra.push(
            status === "sold"
              ? `Serial ${ident.serialNumber} has already been sold and cannot be re-added.`
              : `Serial ${ident.serialNumber} already exists in your inventory (${status}).`,
          );
        }
      }
    }
    if (extra.length === 0) return product;
    return {
      ...product,
      errors: [...(product.errors ?? []), ...extra],
    };
  });
};
