"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadPreviewTable } from "@/components/tables/UploadPreviewTable";
import { downloadSampleProductUploadTemplate } from "@/lib/export/sample-upload-template";
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
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>
            Required: Device Name, Brand, Grade, Storage, Quantity, Purchase Price, Selling Price,
            HST, IMEI, Serial Number. Optional: Color (per unit).{" "}
            <strong className="text-foreground font-medium">Unit-row mode</strong> (recommended for
            multiple units of the same SKU): use Quantity{" "}
            <span className="font-mono text-xs">1</span>, one IMEI or one serial per row, same
            Selling Price and HST for every row that merges — matching rows combine into a single
            inventory line with summed purchase cost and aggregated colours.{" "}
            <strong className="text-foreground font-medium">Legacy mode</strong>: Quantity can be
            &gt; 1 with comma- or newline-separated IMEI/serial values in the cells; one inventory
            line per sheet row. Format IMEI as Text in Excel to avoid rounding.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          onClick={() => downloadSampleProductUploadTemplate()}
        >
          <Download className="h-4 w-4" />
          Download sample Excel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
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
