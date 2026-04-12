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

/**
 * Three unit-rows (Qty 1 each) for the same SKU — merge into one inventory line.
 * Purchase Price differs per row to show that total batch cost = sum ($500 + $510 + $490 = $1500).
 */
const SAMPLE_ROWS: (string | number)[][] = [
  ["Google Pixel 8", "Google", "A", "128GB", 1, 500, 699, 13, "123456789012341", "", "Black"],
  ["Google Pixel 8", "Google", "A", "128GB", 1, 510, 699, 13, "123456789012342", "", "Black"],
  ["Google Pixel 8", "Google", "A", "128GB", 1, 490, 699, 13, "123456789012343", "", "White"],
];

const INSTRUCTIONS_AOA: string[][] = [
  ["DeviceDock — Excel product upload"],
  [""],
  ["How totals are calculated"],
  [
    "Unit-row mode (multiple rows, same device): Each row’s Purchase Price is the cost for that one unit. After upload, those rows merge into one inventory item. Stored purchase price = SUM of those cells; quantity = number of rows; Price/Unit (with tax) is derived from total cost ÷ quantity and HST.",
  ],
  [""],
  [
    "Example on the Products sheet: three rows × $500 + $510 + $490 = $1500 total purchase for 3 units.",
  ],
  [""],
  ["Rules"],
  [
    "• Unit-row: Quantity = 1, exactly one IMEI or one Serial per row (no commas). Selling Price and HST must match across rows that merge.",
  ],
  ["• Optional Color column: per-unit colour; merged inventory gets aggregated colour counts."],
  [
    "• Legacy: one sheet row can have Quantity > 1 with comma-separated IMEIs/serials; Purchase Price = total line cost for that row.",
  ],
  [""],
  ["Format IMEI column as Text in Excel to avoid rounding."],
];

export const downloadSampleProductUploadTemplate = (): void => {
  const productsSheet = XLSX.utils.aoa_to_sheet([[...SAMPLE_HEADERS], ...SAMPLE_ROWS]);
  productsSheet["!cols"] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 6 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_AOA);
  instructionsSheet["!cols"] = [{ wch: 100 }];

  const workbook = XLSX.utils.book_new();
  // Products must be the first sheet — `parseExcelFile` reads SheetNames[0].
  XLSX.utils.book_append_sheet(workbook, productsSheet, "Products");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
  XLSX.writeFile(workbook, "devicedock-product-upload-sample.xlsx");
};
