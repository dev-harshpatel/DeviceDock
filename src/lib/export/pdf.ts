import { InventoryItem } from "@/data/inventory";
import { formatPrice } from "../utils/formatters";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadBlob } from "./download";
import { ONTARIO_TIMEZONE } from "../constants";

const ACCENT_BLUE: [number, number, number] = [59, 130, 246]; // sky-ish accent
const BG_BLUE: [number, number, number] = [239, 246, 255]; // very light blue
const ROW_ALT_BLUE: [number, number, number] = [219, 234, 254]; // light blue
const TEXT_DARK: [number, number, number] = [15, 23, 42]; // slate-900-ish
const TEXT_MUTED: [number, number, number] = [71, 85, 105]; // slate-600-ish
const HEADER_HEIGHT = 34;
const ACCENT_LINE_HEIGHT = 4;

export const exportToPDF = (
  items: InventoryItem[],
  filename: string = "inventory",
  companyName?: string,
) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Soft header background + accent line (keeps theme without being too "blue blue")
    doc.setFillColor(...BG_BLUE);
    doc.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");
    doc.setFillColor(...ACCENT_BLUE);
    doc.rect(0, 0, pageWidth, ACCENT_LINE_HEIGHT, "F");

    const safeCompanyName = companyName?.trim();

    // Header typography (two-line lockup)
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(safeCompanyName || "Inventory", pageWidth / 2, 18, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Inventory Report", pageWidth / 2, 26, { align: "center" });

    // Generated date below band
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(9.5);
    const date = new Date().toLocaleDateString("en-US", {
      timeZone: ONTARIO_TIMEZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Generated on: ${date}`, pageWidth / 2, HEADER_HEIGHT + 8, {
      align: "center",
    });

    // Prepare table data
    const tableData = items.map((item) => [
      item.deviceName,
      item.brand,
      item.grade,
      item.storage,
      item.quantity.toString(),
      formatPrice(item.sellingPrice),
    ]);

    // Add themed table
    autoTable(doc, {
      head: [["Device Name", "Brand", "Grade", "Storage", "Qty", "Price"]],
      body: tableData,
      startY: HEADER_HEIGHT + 14,
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        textColor: TEXT_DARK,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: ACCENT_BLUE,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: ROW_ALT_BLUE },
      margin: { top: HEADER_HEIGHT + 14, left: 10, right: 10 },
      didDrawPage: (data) => {
        const pageCount = (doc.internal as any).getNumberOfPages();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth - 10,
          doc.internal.pageSize.getHeight() - 8,
          { align: "right" },
        );
      },
    });

    downloadBlob(doc.output("blob"), `${filename}.pdf`);

    return true;
  } catch (error) {
    return false;
  }
};
