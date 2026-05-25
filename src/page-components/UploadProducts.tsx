"use client";

import { useUploadProducts } from "@/hooks/use-upload-products";
import { UploadHistoryTable } from "@/components/tables/UploadHistoryTable";
import { Loader2, History, Upload as UploadIcon } from "lucide-react";
import { UploadStatsCards } from "@/components/upload/UploadStatsCards";
import { UploadFileCard } from "@/components/upload/UploadFileCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function UploadProducts() {
  const {
    activeTab,
    setActiveTab,
    selectedFile,
    parsedProducts,
    isParsing,
    isUploading,
    uploadHistory,
    isLoadingHistory,
    isDragging,
    totalProducts,
    totalUploads,
    lastUpload,
    totalSuccessful,
    totalFailed,
    successRate,
    validProductsCount,
    errorProductsCount,
    failedUploads,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    handleClear,
    handleUpload,
  } = useUploadProducts();

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
