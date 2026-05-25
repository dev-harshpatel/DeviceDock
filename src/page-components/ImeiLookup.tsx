"use client";

import { List, Printer, ScanLine, Search } from "lucide-react";
import { useImeiLookup } from "@/hooks/use-imei-lookup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeLabelDialog } from "@/components/imei-lookup/BarcodeLabelDialog";
import { BulkBarcodeLabelDialog } from "@/components/imei-lookup/BulkBarcodeLabelDialog";
import { ImeiListTab } from "@/components/imei-lookup/ImeiListTab";
import { SingleLookupTab } from "@/components/imei-lookup/SingleLookupTab";
import { BulkPrintTab } from "@/components/imei-lookup/BulkPrintTab";

export default function ImeiLookup() {
  const {
    companyId,
    storageOptions,
    activeTab,
    setActiveTab,
    query,
    setQuery,
    result,
    searched,
    isLoading,
    showBarcode,
    setShowBarcode,
    bulkInputRef,
    bulkInput,
    setBulkInput,
    bulkEntries,
    isBulkLoading,
    showBulkBarcode,
    setShowBulkBarcode,
    handleSearch,
    handleKeyDown,
    handleAddBulkImeis,
    handleBulkKeyDown,
    handleRemoveBulkEntry,
    handleClearBulk,
    bulkCount,
    hasBulkEntries,
    bulkDialogEntries,
  } = useImeiLookup();

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Header */}
      <div className="shrink-0 space-y-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <ScanLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">IMEI Lookup</h1>
            <p className="text-sm text-muted-foreground">
              Search for a device or print barcode labels in bulk
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <TabsList className="bg-muted/60 shrink-0 w-fit justify-start">
          <TabsTrigger value="single" className="gap-2 flex-1 sm:flex-none">
            <Search className="h-3.5 w-3.5" />
            Single Lookup
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2 flex-1 sm:flex-none">
            <Printer className="h-3.5 w-3.5" />
            Bulk Print
            {hasBulkEntries && (
              <span className="ml-1 min-w-[20px] h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {bulkCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2 flex-1 sm:flex-none">
            <List className="h-3.5 w-3.5" />
            All IMEIs
          </TabsTrigger>
        </TabsList>

        {/* Single Lookup Tab */}
        <TabsContent value="single" className="mt-4 flex-1 min-h-0">
          <SingleLookupTab
            query={query}
            setQuery={setQuery}
            handleKeyDown={handleKeyDown}
            handleSearch={handleSearch}
            isLoading={isLoading}
            searched={searched}
            result={result}
            setShowBarcode={setShowBarcode}
          />
        </TabsContent>

        {/* Bulk Print Tab */}
        <TabsContent value="bulk" className="mt-4 flex-1 min-h-0">
          <BulkPrintTab
            bulkInputRef={bulkInputRef}
            bulkInput={bulkInput}
            setBulkInput={setBulkInput}
            handleBulkKeyDown={handleBulkKeyDown}
            isBulkLoading={isBulkLoading}
            handleAddBulkImeis={handleAddBulkImeis}
            hasBulkEntries={hasBulkEntries}
            bulkCount={bulkCount}
            handleClearBulk={handleClearBulk}
            bulkEntries={bulkEntries}
            handleRemoveBulkEntry={handleRemoveBulkEntry}
            setShowBulkBarcode={setShowBulkBarcode}
          />
        </TabsContent>

        {/* All IMEIs Tab */}
        <TabsContent
          value="all"
          className="mt-4 flex flex-1 flex-col min-h-0 overflow-hidden outline-none data-[state=inactive]:hidden"
        >
          {companyId && <ImeiListTab companyId={companyId} storageOptions={storageOptions} />}
        </TabsContent>
      </Tabs>

      {/* Single barcode dialog */}
      {result?.imei && (
        <BarcodeLabelDialog
          open={showBarcode}
          onOpenChange={setShowBarcode}
          imei={result.imei}
          deviceName={result.item?.deviceName}
          storage={result.item?.storage}
          grade={result.item?.grade}
          sellingPrice={result.item?.sellingPrice}
        />
      )}

      {/* Bulk barcode dialog */}
      {hasBulkEntries && (
        <BulkBarcodeLabelDialog
          open={showBulkBarcode}
          onOpenChange={setShowBulkBarcode}
          entries={bulkDialogEntries}
        />
      )}
    </div>
  );
}
