import { InventoryItem } from "@/data/inventory";
import { formatPrice } from "../utils/formatters";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadBlob } from "./download";
import { ONTARIO_TIMEZONE } from "../constants";

export const exportToPDF = (
  items: InventoryItem[],
  filename: string = "inventory"
) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Add title
    doc.setFontSize(18);
    doc.text("Inventory Report", pageWidth / 2, 15, { align: "center" });

    // Add date
    doc.setFontSize(10);
    const date = new Date().toLocaleDateString("en-US", {
      timeZone: ONTARIO_TIMEZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Generated on: ${date}`, pageWidth / 2, 22, { align: "center" });

    // Prepare table data
    const tableData = items.map((item) => [
      item.deviceName,
      item.brand,
      item.grade,
      item.storage,
      item.quantity.toString(),
      formatPrice(item.sellingPrice),
      item.lastUpdated,
    ]);

    // Add table
    autoTable(doc, {
      head: [
        [
          "Device Name",
          "Brand",
          "Grade",
          "Storage",
          "Qty",
          "Price",
          "Last Updated",
        ],
      ],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 58, 96], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 30, left: 10, right: 10 },
    });

    downloadBlob(doc.output("blob"), `${filename}.pdf`);

    return true;
  } catch (error) {
    return false;
  }
};
