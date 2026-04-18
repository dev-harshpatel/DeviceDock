"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/hooks/use-toast";
import { mergeDatabaseIdentifierConflicts } from "@/lib/export/upload-identifier-validation";
import {
  mapMergedUnitGroupToInventoryItem,
  mapToInventoryItem,
  parseExcelFile,
} from "@/lib/export/parser";
import {
  aggregateColorsFromUnitGroup,
  partitionParsedProductsForUpload,
} from "@/lib/export/upload-merge-groups";
import { replaceInventoryColors } from "@/lib/inventory/inventory-colors";
import { ParsedProduct, UploadHistory } from "@/types/upload";
import { InventoryItem } from "@/data/inventory";
import { UploadHistoryTable } from "@/components/tables/UploadHistoryTable";
import { Loader2, History, Upload as UploadIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client/browser";
import { UploadStatsCards } from "@/components/upload/UploadStatsCards";
import { UploadFileCard } from "@/components/upload/UploadFileCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function UploadProducts() {
  const {
    inventory,
    addInventoryIdentifier,
    bulkInsertProducts,
    getUploadHistory,
    isLoading: inventoryLoading,
  } = useInventory();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"upload" | "history">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  /** Bumps after each successful parse so IMEI/serial can be checked against the database. */
  const [dbValidateTick, setDbValidateTick] = useState(0);
  /** Prevents stale async DB checks from overwriting state after clear or re-parse. */
  const parseGenerationRef = useRef(0);
  const parsedProductsRef = useRef<ParsedProduct[]>([]);
  parsedProductsRef.current = parsedProducts;

  // Load upload history on mount
  useEffect(() => {
    loadUploadHistory();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const snapshot = parsedProductsRef.current;
    if (snapshot.length === 0) return;

    let cancelled = false;
    const generation = parseGenerationRef.current;

    void (async () => {
      try {
        const merged = await mergeDatabaseIdentifierConflicts(snapshot, companyId, supabase);
        if (!cancelled && generation === parseGenerationRef.current) {
          setParsedProducts(merged);
        }
      } catch (error) {
        if (!cancelled && generation === parseGenerationRef.current) {
          toast({
            title: "Could not verify identifiers",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, dbValidateTick, toast]);

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
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      const validExtensions = [".xlsx", ".xls"];

      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
      const isValidType = validTypes.includes(file.type) || validExtensions.includes(fileExtension);

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
        parseGenerationRef.current += 1;
        setParsedProducts(products);
        setDbValidateTick((t) => t + 1);
      } catch (error) {
        toast({
          title: "Error parsing file",
          description: error instanceof Error ? error.message : "Failed to parse Excel file",
          variant: "destructive",
        });
        setSelectedFile(null);
        setParsedProducts([]);
      } finally {
        setIsParsing(false);
      }
    },
    [toast],
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
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setParsedProducts([]);
    setDbValidateTick(0);
    parseGenerationRef.current = 0;
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
    if (!companyId) {
      toast({
        title: "Error",
        description: "Select a company before uploading.",
        variant: "destructive",
      });
      return;
    }

    const validProducts = parsedProducts.filter((p) => !p.errors || p.errors.length === 0);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product_uploads not in generated Database
      const { data: uploadRecord, error: uploadError } = await (
        supabase.from("product_uploads") as any
      )
        .insert({
          company_id: companyId,
          uploaded_by: user.id,
          file_name: selectedFile?.name || "unknown.xlsx",
          total_products: parsedProducts.length,
          successful_inserts: 0,
          failed_inserts: 0,
          upload_status: "pending",
        })
        .select()
        .single();

      if (uploadError) throw new Error(`Failed to create upload record: ${uploadError.message}`);

      let successCount = 0;
      let failedCount = 0;
      const rowErrors: string[] = [];

      const toInventoryItem = (mapped: ReturnType<typeof mapToInventoryItem>): InventoryItem => ({
        id: "temp-upload-row",
        deviceName: mapped.device_name,
        brand: mapped.brand,
        grade: mapped.grade as InventoryItem["grade"],
        storage: mapped.storage,
        quantity: mapped.quantity,
        pricePerUnit: mapped.price_per_unit,
        purchasePrice: mapped.purchase_price,
        hst: mapped.hst,
        sellingPrice: mapped.selling_price,
        lastUpdated: mapped.last_updated,
      });

      const { legacyRows, unitGroups } = partitionParsedProductsForUpload(validProducts);

      const processInsert = async (
        parsed: ParsedProduct,
        mapped: ReturnType<typeof mapToInventoryItem>,
      ): Promise<boolean> => {
        const inventoryItem = toInventoryItem(mapped);
        const insertResult = await bulkInsertProducts([inventoryItem]);
        if (insertResult.success !== 1 || !insertResult.insertedIds?.[0]) {
          rowErrors.push(
            `Row ${parsed.rowNumber ?? "?"}: ${insertResult.errors[0] ?? "Inventory insert failed"}`,
          );
          return false;
        }
        const inventoryId = insertResult.insertedIds[0];
        try {
          for (const ident of parsed.identifiers) {
            await addInventoryIdentifier(
              inventoryId,
              ident.imei,
              ident.serialNumber,
              ident.color ?? undefined,
              ident.damageNote ?? parsed.damageNote ?? undefined,
            );
          }
          return true;
        } catch (identError) {
          await supabase
            .from("inventory")
            .delete()
            .eq("id", inventoryId)
            .eq("company_id", companyId);
          rowErrors.push(
            `Row ${parsed.rowNumber ?? "?"}: ${identError instanceof Error ? identError.message : "Identifier save failed"}`,
          );
          return false;
        }
      };

      for (const parsed of legacyRows) {
        const mapped = mapToInventoryItem(parsed);
        const ok = await processInsert(parsed, mapped);
        if (ok) successCount += 1;
        else failedCount += 1;
      }

      for (const group of unitGroups) {
        const rowLabel = group.map((p) => p.rowNumber ?? "?").join(", ");
        try {
          const mapped = mapMergedUnitGroupToInventoryItem(group);
          const inventoryItem = toInventoryItem(mapped);
          const insertResult = await bulkInsertProducts([inventoryItem]);
          if (insertResult.success !== 1 || !insertResult.insertedIds?.[0]) {
            failedCount += 1;
            rowErrors.push(
              `Rows ${rowLabel}: ${insertResult.errors[0] ?? "Inventory insert failed"}`,
            );
            continue;
          }
          const inventoryId = insertResult.insertedIds[0];
          try {
            for (const parsed of group) {
              const ident = parsed.identifiers[0];
              if (!ident) throw new Error("Missing identifier for unit row");
              await addInventoryIdentifier(
                inventoryId,
                ident.imei,
                ident.serialNumber,
                ident.color ?? undefined,
                ident.damageNote ?? parsed.damageNote ?? undefined,
              );
            }
            const colorRows = aggregateColorsFromUnitGroup(group);
            if (colorRows.length > 0)
              await replaceInventoryColors(supabase, inventoryId, colorRows);
            successCount += 1;
          } catch (innerError) {
            await supabase
              .from("inventory")
              .delete()
              .eq("id", inventoryId)
              .eq("company_id", companyId);
            failedCount += 1;
            rowErrors.push(
              `Rows ${rowLabel}: ${innerError instanceof Error ? innerError.message : "Save failed"}`,
            );
          }
        } catch (groupError) {
          failedCount += 1;
          rowErrors.push(
            `Rows ${rowLabel}: ${groupError instanceof Error ? groupError.message : "Merge failed"}`,
          );
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product_uploads not in generated Database
      const { error: updateError } = await (supabase.from("product_uploads") as any)
        .update({
          successful_inserts: successCount,
          failed_inserts: failedCount,
          upload_status: failedCount === 0 ? "completed" : "failed",
          error_message: rowErrors.length > 0 ? rowErrors.join("; ") : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", uploadRecord.id);

      if (updateError) throw new Error(`Failed to update upload record: ${updateError.message}`);

      await loadUploadHistory();

      const countSummary = `${successCount} inventory line(s) created${failedCount > 0 ? `, ${failedCount} failed` : ""} (${parsedProducts.length} sheet row${parsedProducts.length !== 1 ? "s" : ""}).`;
      const errorPreview =
        rowErrors.length > 0
          ? rowErrors.length <= 2
            ? rowErrors.join(" | ")
            : `${rowErrors.slice(0, 2).join(" | ")} … and ${rowErrors.length - 2} more (see Upload History)`
          : "";
      toast({
        title: failedCount === 0 ? "Upload successful" : "Upload finished with errors",
        description: errorPreview ? `${countSummary} ${errorPreview}` : countSummary,
        variant: failedCount > 0 ? "destructive" : "default",
      });

      handleClear();
      setActiveTab("history");
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload products",
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
  const totalSuccessful = uploadHistory.reduce((sum, h) => sum + h.successfulInserts, 0);
  const totalFailed = uploadHistory.reduce((sum, h) => sum + h.failedInserts, 0);
  const successRate =
    totalSuccessful + totalFailed > 0
      ? ((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(1)
      : "100";

  const validProductsCount = parsedProducts.filter(
    (p) => !p.errors || p.errors.length === 0,
  ).length;
  const errorProductsCount = parsedProducts.length - validProductsCount;

  const failedUploads = uploadHistory.filter((h) => h.uploadStatus === "failed").length;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "upload" | "history")}
      className="flex flex-col h-full"
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border mb-4 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-3 lg:pt-4 pb-3">
        <div className="flex items-baseline gap-3 mb-3">
          <h1 className="text-2xl font-semibold text-foreground">Upload Products</h1>
          <p className="text-sm text-muted-foreground">
            {activeTab === "upload"
              ? "Upload inventory via Excel"
              : `${uploadHistory.length} upload${uploadHistory.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <TabsList className="bg-muted/60 w-full sm:w-auto">
          <TabsTrigger value="upload" className="gap-2 flex-1 sm:flex-none">
            <UploadIcon className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 flex-1 sm:flex-none">
            <History className="h-3.5 w-3.5" />
            History
            {failedUploads > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[11px] font-semibold rounded-full bg-destructive/15 text-destructive"
              >
                {failedUploads > 99 ? "99+" : failedUploads}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Upload Tab */}
      <TabsContent
        value="upload"
        className="flex-1 overflow-y-auto min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6 space-y-6 mt-0"
      >
        <UploadStatsCards
          totalProducts={totalProducts}
          totalUploads={totalUploads}
          successRate={successRate}
          totalSuccessful={totalSuccessful}
          totalFailed={totalFailed}
          lastUpload={lastUpload}
        />

        <UploadFileCard
          selectedFile={selectedFile}
          parsedProducts={parsedProducts}
          isParsing={isParsing}
          isUploading={isUploading}
          isDragging={isDragging}
          validProductsCount={validProductsCount}
          errorProductsCount={errorProductsCount}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onFileInputChange={handleFileInputChange}
          onClear={handleClear}
          onUpload={handleUpload}
        />
      </TabsContent>

      {/* History Tab */}
      <TabsContent
        value="history"
        className="flex-1 overflow-y-auto min-h-0 -mx-4 lg:-mx-6 px-4 lg:px-6 mt-0"
      >
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <UploadHistoryTable history={uploadHistory} />
        )}
      </TabsContent>
    </Tabs>
  );
}
