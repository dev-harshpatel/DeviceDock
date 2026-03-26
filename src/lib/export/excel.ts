import { InventoryItem } from "@/data/inventory";
import { writeFile, utils } from "xlsx";

export const exportToExcel = (
  items: InventoryItem[],
  filename: string = "inventory",
  companyName?: string,
) => {
  try {
    const title = companyName ? `${companyName} : Inventory Report` : "Inventory Report";

    const data = items.map((item) => ({
      "Device Name": item.deviceName,
      Brand: item.brand,
      Grade: item.grade,
      Storage: item.storage,
      Quantity: item.quantity,
      "Price (CAD)": item.sellingPrice,
    }));

    // Build empty worksheet, inject title in A1, then add data from A2
    const worksheet = utils.aoa_to_sheet([[title]]);
    utils.sheet_add_json(worksheet, data, { origin: "A2", skipHeader: false });

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Inventory Report");

    // Set column widths
    const columnWidths = [
      { wch: 30 }, // Device Name
      { wch: 12 }, // Brand
      { wch: 8 }, // Grade
      { wch: 12 }, // Storage
      { wch: 10 }, // Quantity
      { wch: 15 }, // Price/Unit
    ];
    worksheet["!cols"] = columnWidths;

    writeFile(workbook, `${filename}.xlsx`);
    return true;
  } catch (error) {
    return false;
  }
};
