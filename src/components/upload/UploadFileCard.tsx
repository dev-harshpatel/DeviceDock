"use client";

import { useState } from "react";

import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

import { UploadPreviewTable } from "@/components/tables/UploadPreviewTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadSampleProductUploadTemplateLegacy,
  downloadSampleProductUploadTemplateUnitRow,
} from "@/lib/export/sample-upload-template";
import { cn } from "@/lib/utils";
import type { ParsedProduct } from "@/types/upload";

interface UploadFileCardProps {
  selectedFile: File | null;
  parsedProducts: ParsedProduct[];
  isParsing: boolean;
  isUploading: boolean;
  isDragging: boolean;
  validProductsCount: number;
  errorProductsCount: number;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onUpload: () => void;
}

export function UploadFileCard({
  selectedFile,
  parsedProducts,
  isParsing,
  isUploading,
  isDragging,
  validProductsCount,
  errorProductsCount,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputChange,
  onClear,
  onUpload,
}: UploadFileCardProps) {
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);

  const handleDownloadUnitRowSample = () => {
    downloadSampleProductUploadTemplateUnitRow();
    setSampleDialogOpen(false);
  };

  const handleDownloadLegacySample = () => {
    downloadSampleProductUploadTemplateLegacy();
    setSampleDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>
            Include the required columns (device details, quantity, pricing, HST, IMEI, serial). You
            can upload in unit-row mode or legacy mode — see the sample file for examples. Format
            IMEI as Text in Excel to avoid rounding.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          onClick={() => setSampleDialogOpen(true)}
        >
          <Download className="h-4 w-4" />
          Download sample Excel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={sampleDialogOpen} onOpenChange={setSampleDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Download sample Excel</DialogTitle>
              <DialogDescription>
                Pick a template. Both use the same columns; the example rows show how each mode
                works.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 pt-1">
              <button
                type="button"
                onClick={handleDownloadUnitRowSample}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-sm font-semibold text-foreground">Unit-row mode</span>
                <span className="text-xs text-muted-foreground">
                  One row per device (Quantity 1). Best when each unit has its own IMEI or serial.
                </span>
                <span className="text-xs font-medium text-primary pt-1">Download .xlsx</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadLegacySample}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-sm font-semibold text-foreground">Legacy mode</span>
                <span className="text-xs text-muted-foreground">
                  One sheet row per SKU with Quantity &gt; 1 and comma-separated IMEIs or serials.
                </span>
                <span className="text-xs font-medium text-primary pt-1">Download .xlsx</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {!selectedFile ? (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            )}
          >
            {isParsing ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Parsing Excel file...</p>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium text-foreground mb-2">
                  Drag and drop your Excel file here
                </p>
                <p className="text-xs text-muted-foreground mb-4">or</p>
                <label htmlFor="file-upload">
                  <Button asChild variant="outline">
                    <span>Browse Files</span>
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={onFileInputChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-4">Supported formats: .xlsx, .xls</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {parsedProducts.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {validProductsCount} products ready to upload
                      {errorProductsCount > 0 && (
                        <span className="text-destructive ml-2">
                          ({errorProductsCount} with errors)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={onClear} disabled={isUploading}>
                      Clear
                    </Button>
                    <Button onClick={onUpload} disabled={isUploading || validProductsCount === 0}>
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload to Database
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <UploadPreviewTable products={parsedProducts} />
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
