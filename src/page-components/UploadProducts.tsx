"use client";

import { useState, useEffect, useCallback } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/hooks/use-toast";
import { parseExcelFile, mapToInventoryItem } from "@/lib/export/parser";
import { ParsedProduct, UploadHistory } from "@/types/upload";
import { InventoryItem } from "@/data/inventory";
import { UploadPreviewTable } from "@/components/tables/UploadPreviewTable";
import { UploadHistoryTable } from "@/components/tables/UploadHistoryTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client/browser";
import { cn } from "@/lib/utils";

export default function UploadProducts() {
  const {
    inventory,
    bulkInsertProducts,
    getUploadHistory,
    isLoading: inventoryLoading,
  } = useInventory();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Load upload history on mount
  useEffect(() => {
    loadUploadHistory();
  }, []);

  const loadUploadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const history = await getUploadHistory();
      setUploadHistory(history);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load upload history.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      // Validate file type
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
      ];
      const validExtensions = [".xlsx", ".xls"];

      const fileExtension = file.name
        .toLowerCase()
        .substring(file.name.lastIndexOf("."));
      const isValidType =
        validTypes.includes(file.type) ||
        validExtensions.includes(fileExtension);

      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: "Please upload an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setIsParsing(true);

      try {
        const products = await parseExcelFile(file);
        setParsedProducts(products);
      } catch (error) {
        toast({
          title: "Error parsing file",
          description:
            error instanceof Error
              ? error.message
              : "Failed to parse Excel file",
          variant: "destructive",
        });
        setSelectedFile(null);
        setParsedProducts([]);
      } finally {
        setIsParsing(false);
      }
    },
    [toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setParsedProducts([]);
  };

  const handleUpload = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to upload products.",
        variant: "destructive",
      });
      return;
    }

    // Filter out products with errors
    const validProducts = parsedProducts.filter(
      (p) => !p.errors || p.errors.length === 0
    );

    if (validProducts.length === 0) {
      toast({
        title: "No valid products",
        description: "Please fix validation errors before uploading.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create upload history record (pending status)
      const { data: uploadRecord, error: uploadError } = await (
        supabase.from("product_uploads") as any
      )
        .insert({
          uploaded_by: user.id,
          file_name: selectedFile?.name || "unknown.xlsx",
          total_products: parsedProducts.length,
          successful_inserts: 0,
          failed_inserts: 0,
          upload_status: "pending",
        })
        .select()
        .single();

      if (uploadError) {
        throw new Error(
          `Failed to create upload record: ${uploadError.message}`
        );
      }

      // Map parsed products to InventoryItem format
      const inventoryItems: InventoryItem[] = validProducts.map(
        (parsed, index) => {
          const mapped = mapToInventoryItem(parsed);
          return {
            id: `temp-${index}`, // Temporary ID, will be generated by database
            deviceName: mapped.device_name,
            brand: mapped.brand,
            grade: mapped.grade as "A" | "B" | "C" | "D",
            storage: mapped.storage,
            quantity: mapped.quantity,
            pricePerUnit: mapped.price_per_unit,
            purchasePrice: mapped.purchase_price,
            hst: mapped.hst,
            sellingPrice: mapped.selling_price,
            lastUpdated: mapped.last_updated,
          };
        }
      );

      // Bulk insert products
      const result = await bulkInsertProducts(inventoryItems);

      // Update upload history record
      const errorMessages: string[] = [];
      if (result.errors.length > 0) {
        errorMessages.push(...result.errors);
      }
      if (result.failed > 0 && result.errors.length === 0) {
        errorMessages.push(`${result.failed} products failed to insert`);
      }

      const { error: updateError } = await (
        supabase.from("product_uploads") as any
      )
        .update({
          successful_inserts: result.success,
          failed_inserts: result.failed,
          upload_status: result.failed === 0 ? "completed" : "failed",
          error_message:
            errorMessages.length > 0 ? errorMessages.join("; ") : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", uploadRecord.id);

      if (updateError) {
        throw new Error(
          `Failed to update upload record: ${updateError.message}`
        );
      }

      // Refresh history
      await loadUploadHistory();

      // Show success toast
      toast({
        title: "Upload successful",
        description: `${result.success} products uploaded successfully${
          result.failed > 0 ? `, ${result.failed} failed` : ""
        }.`,
      });

      // Clear form
      handleClear();
    } catch (error) {
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Failed to upload products",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Calculate statistics
  const totalProducts = inventory.length;
  const totalUploads = uploadHistory.length;
  const lastUpload = uploadHistory[0];
  const totalSuccessful = uploadHistory.reduce(
    (sum, h) => sum + h.successfulInserts,
    0
  );
  const totalFailed = uploadHistory.reduce(
    (sum, h) => sum + h.failedInserts,
    0
  );
  const successRate =
    totalSuccessful + totalFailed > 0
      ? ((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(1)
      : "100";

  const validProductsCount = parsedProducts.filter(
    (p) => !p.errors || p.errors.length === 0
  ).length;
  const errorProductsCount = parsedProducts.length - validProductsCount;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background pb-4 space-y-4 border-b border-border mb-4 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-4 lg:pt-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Upload Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload products to the database via Excel files
          </p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6 space-y-6">
        {/* Section 1: Overview/Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Products
              </CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
              <p className="text-xs text-muted-foreground">In database</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Uploads
              </CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUploads}</div>
              <p className="text-xs text-muted-foreground">Uploads performed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground">
                {totalSuccessful} successful, {totalFailed} failed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Upload</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {lastUpload
                  ? new Date(lastUpload.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {lastUpload
                  ? `${lastUpload.successfulInserts} products`
                  : "No uploads yet"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: File Upload & Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
            <CardDescription>
              Upload an Excel file (.xlsx or .xls) with product data. Required
              columns: Device Name, Brand, Grade, Storage, Quantity, Purchase
              Price, Selling Price, HST
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Parsing Excel file...
                    </p>
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
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground mt-4">
                      Supported formats: .xlsx, .xls
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleClear}>
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
                        <Button
                          variant="outline"
                          onClick={handleClear}
                          disabled={isUploading}
                        >
                          Clear
                        </Button>
                        <Button
                          onClick={handleUpload}
                          disabled={isUploading || validProductsCount === 0}
                        >
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

        {/* Section 3: Upload History */}
        <Card>
          <CardHeader>
            <CardTitle>Upload History</CardTitle>
            <CardDescription>
              View past product uploads and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <UploadHistoryTable history={uploadHistory} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
