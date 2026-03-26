import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { cn } from "@/lib/utils";
import { InventoryItem } from "@/data/inventory";

interface ExportActionsProps {
  data?: InventoryItem[];
  onFetchAllData?: () => Promise<InventoryItem[]>;
  filename?: string;
  className?: string;
  companyName?: string;
}

export function ExportActions({
  data = [],
  onFetchAllData,
  filename = "inventory",
  className,
  companyName,
}: ExportActionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const getExportData = async (): Promise<InventoryItem[] | null> => {
    if (onFetchAllData) {
      try {
        const allData = await onFetchAllData();
        if (allData.length === 0) {
          toast.error(TOAST_MESSAGES.EXPORT_NO_DATA, {
            description: "Please ensure there are items to export",
          });
          return null;
        }
        return allData;
      } catch {
        toast.error(TOAST_MESSAGES.EXPORT_FAILED, {
          description: "Failed to fetch data for export",
        });
        return null;
      }
    }

    if (data.length === 0) {
      toast.error("No data to export", {
        description: "Please ensure there are items to export",
      });
      return null;
    }
    return data;
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const exportData = await getExportData();
      if (!exportData) return;

      await yieldToBrowser();
      const { exportToExcel } = await import("@/lib/export/excel");
      exportToExcel(exportData, filename, companyName);
      toast.success(TOAST_MESSAGES.EXPORT_SUCCESS, {
        description: "Your Excel file has been downloaded",
      });
    } catch {
      toast.error("Export failed", {
        description: "There was an error exporting to Excel",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const exportData = await getExportData();
      if (!exportData) return;

      await yieldToBrowser();
      const { exportToPDF } = await import("@/lib/export/pdf");
      exportToPDF(exportData, filename, companyName);
      toast.success(TOAST_MESSAGES.EXPORT_SUCCESS, {
        description: "Your PDF file has been downloaded",
      });
    } catch {
      toast.error("Export failed", {
        description: "There was an error exporting to PDF",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        className="border-border"
        onClick={handleExportExcel}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-2" />
        )}
        <span className="hidden sm:inline">Export to Excel</span>
        <span className="sm:hidden">Excel</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="border-border"
        onClick={handleExportPDF}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        <span className="hidden sm:inline">Export to PDF</span>
        <span className="sm:hidden">PDF</span>
      </Button>
    </div>
  );
}
