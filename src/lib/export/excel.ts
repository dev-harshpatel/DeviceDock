import { InventoryItem } from "@/data/inventory";
import { writeFile, utils } from "xlsx";

export const exportToExcel = (
  items: InventoryItem[],
  filename: string = "inventory"
) => {
  try {
    // Prepare data for Excel (excluding Price Change and Last Updated)
    const data = items.map((item) => ({
      "Device Name": item.deviceName,
      Brand: item.brand,
      Grade: item.grade,
      Storage: item.storage,
      Quantity: item.quantity,
      "Price (CAD)": item.sellingPrice,
    }));

    // Create workbook and worksheet
    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Inventory");

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

    // Generate Excel file
    writeFile(workbook, `${filename}.xlsx`);
    return true;
  } catch (error) {
    return false;
  }
};
