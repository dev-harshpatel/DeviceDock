import * as XLSX from "xlsx";

/** Column order matches `parseExcelFile` in `parser.ts` (IMEI / Serial / optional Color). */
const SAMPLE_HEADERS = [
  "Device Name",
  "Brand",
  "Grade",
  "Storage",
  "Quantity",
  "Purchase Price",
  "Selling Price",
  "HST",
  "IMEI",
  "Serial Number",
  "Color",
] as const;

const COLUMN_WIDTHS = [
  { wch: 22 },
  { wch: 12 },
  { wch: 8 },
  { wch: 10 },
  { wch: 10 },
  { wch: 16 },
  { wch: 14 },
  { wch: 6 },
  { wch: 36 },
  { wch: 16 },
  { wch: 12 },
];

/**
 * Three unit-rows (Qty 1 each) for the same SKU — merge into one inventory line.
 * Purchase Price differs per row to show that total batch cost = sum ($500 + $510 + $490 = $1500).
 */
const UNIT_ROW_SAMPLE_ROWS: (string | number)[][] = [
  ["Google Pixel 8", "Google", "A", "128GB", 1, 500, 699, 13, "123456789012341", "", "Black"],
  ["Google Pixel 8", "Google", "A", "128GB", 1, 510, 699, 13, "123456789012342", "", "Black"],
  ["Google Pixel 8", "Google", "A", "128GB", 1, 490, 699, 13, "123456789012343", "", "White"],
];

/** One sheet row, Quantity 3, comma-separated IMEIs (legacy). */
const LEGACY_SAMPLE_ROWS: (string | number)[][] = [
  [
    "Google Pixel 8",
    "Google",
    "A",
    "128GB",
    3,
    1500,
    699,
    13,
    "123456789012341, 123456789012342, 123456789012343",
    "",
    "Black",
  ],
];

const INSTRUCTIONS_UNIT_ROW: string[][] = [
  ["DeviceDock — Sample (unit-row mode)"],
  [""],
  [
    "Use Quantity 1 per row. Put exactly one IMEI or one serial per row (same Selling Price and HST for rows that merge).",
  ],
  [""],
  [
    "Purchase Price on each row is the cost for that single unit. Matching SKU rows combine into one inventory line with summed cost.",
  ],
  [""],
  ["Format the IMEI column as Text in Excel to avoid rounding."],
];

const INSTRUCTIONS_LEGACY: string[][] = [
  ["DeviceDock — Sample (legacy mode)"],
  [""],
  [
    "One sheet row can list Quantity greater than 1. Enter multiple IMEIs or serials in the cells, separated by commas or new lines.",
  ],
  [""],
  ["Purchase Price is the total line cost for that row."],
  [""],
  ["Format the IMEI column as Text in Excel to avoid rounding."],
];

const appendWorkbookSheets = (
  productsRows: (string | number)[][],
  instructionsAoa: string[][],
  fileName: string,
): void => {
  const productsSheet = XLSX.utils.aoa_to_sheet([[...SAMPLE_HEADERS], ...productsRows]);
  productsSheet["!cols"] = COLUMN_WIDTHS;

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsAoa);
  instructionsSheet["!cols"] = [{ wch: 100 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, productsSheet, "Products");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
  XLSX.writeFile(workbook, fileName);
};

/** Recommended: one row per device, Quantity 1. */
export const downloadSampleProductUploadTemplateUnitRow = (): void => {
  appendWorkbookSheets(
    UNIT_ROW_SAMPLE_ROWS,
    INSTRUCTIONS_UNIT_ROW,
    "devicedock-upload-sample-unit-row.xlsx",
  );
};

/** One row per SKU with Quantity & comma-separated identifiers. */
export const downloadSampleProductUploadTemplateLegacy = (): void => {
  appendWorkbookSheets(
    LEGACY_SAMPLE_ROWS,
    INSTRUCTIONS_LEGACY,
    "devicedock-upload-sample-legacy.xlsx",
  );
};

/** @deprecated Prefer `downloadSampleProductUploadTemplateUnitRow` or `downloadSampleProductUploadTemplateLegacy`. */
export const downloadSampleProductUploadTemplate = downloadSampleProductUploadTemplateUnitRow;
