import * as XLSX from "xlsx";

/** Column order matches `parseExcelFile` in `parser.ts` (including IMEI / Serial Number). */
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
] as const;

const SAMPLE_EXAMPLE_ROW: (string | number)[] = [
  "Google Pixel 8",
  "Google",
  "A",
  "128GB",
  1,
  500,
  699,
  13,
  "123456789012345",
  "",
];

export const downloadSampleProductUploadTemplate = (): void => {
  const worksheet = XLSX.utils.aoa_to_sheet([[...SAMPLE_HEADERS], SAMPLE_EXAMPLE_ROW]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
  XLSX.writeFile(workbook, "devicedock-product-upload-sample.xlsx");
};
