"use client";

import { ParsedProduct } from "@/types/upload";
import { partitionParsedProductsForUpload } from "@/lib/export/upload-merge-groups";
import { formatPrice } from "@/lib/utils";
import { GradeBadge } from "@/components/common/GradeBadge";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface UploadPreviewTableProps {
  products: ParsedProduct[];
  className?: string;
}

export function UploadPreviewTable({ products, className }: UploadPreviewTableProps) {
  if (products.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No products to preview</div>;
  }

  const validProducts = products.filter((p) => !p.errors || p.errors.length === 0);
  const invalidProducts = products.filter((p) => p.errors && p.errors.length > 0);
  const { legacyRows, unitGroups } = partitionParsedProductsForUpload(validProducts);
  const inventoryLinesAfterUpload = legacyRows.length + unitGroups.length;
  const unitRowSheetCount = validProducts.filter((p) => p.parseMode === "unit_row").length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary */}
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-muted-foreground">
            Total: <span className="font-medium text-foreground">{products.length}</span> sheet row
            {products.length !== 1 ? "s" : ""}
          </span>
          <span className="text-success">
            Valid: <span className="font-medium">{validProducts.length}</span>
          </span>
          {invalidProducts.length > 0 && (
            <span className="text-destructive">
              Errors: <span className="font-medium">{invalidProducts.length}</span>
            </span>
          )}
        </div>
        {validProducts.length > 0 && (
          <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2">
            Upload will create{" "}
            <span className="font-semibold text-foreground">{inventoryLinesAfterUpload}</span>{" "}
            inventory line{inventoryLinesAfterUpload !== 1 ? "s" : ""}
            {unitRowSheetCount > 0 && (
              <>
                {" "}
                ({unitRowSheetCount} unit-row sheet row{unitRowSheetCount !== 1 ? "s" : ""} merge by
                device + brand + grade + storage)
              </>
            )}
            .
          </p>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Row
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Device Name
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Brand
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Grade
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Storage
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Quantity
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Units (IMEI / Serial)
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Purchase Price
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Selling Price
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  HST
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Color
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Row format
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product, index) => {
                const hasErrors = product.errors && product.errors.length > 0;

                return (
                  <tr
                    key={index}
                    className={cn(
                      "transition-colors",
                      index % 2 === 1 && "bg-table-zebra",
                      hasErrors && "bg-destructive/5 border-l-4 border-l-destructive",
                    )}
                  >
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {product.rowNumber || index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {product.deviceName}
                        </span>
                        {hasErrors && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold">Validation Errors:</p>
                                  <ul className="list-disc list-inside text-xs space-y-0.5">
                                    {product.errors?.map((error, i) => (
                                      <li key={i}>{error}</li>
                                    ))}
                                  </ul>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">{product.brand}</td>
                    <td className="px-4 py-4 text-center">
                      <GradeBadge grade={product.grade} />
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">{product.storage}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-semibold text-foreground text-sm">
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-foreground">
                      <span className="font-medium">
                        {(product.identifiers?.length ?? 0) === product.quantity
                          ? `${product.identifiers?.length ?? 0}`
                          : `${product.identifiers?.length ?? 0} / ${product.quantity}`}
                      </span>
                      <span className="text-muted-foreground block text-xs">identifiers</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-medium text-foreground text-sm">
                        {formatPrice(product.purchasePrice)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-medium text-foreground text-sm">
                        {formatPrice(product.sellingPrice)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-medium text-foreground text-sm">
                        {typeof product.hst === "number"
                          ? `${product.hst}%`
                          : `${Number(product.hst) || 0}%`}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {product.identifiers[0]?.color?.trim()
                        ? product.identifiers[0].color
                        : product.colorCellRaw?.trim() || "—"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-normal uppercase tracking-wide"
                      >
                        {product.parseMode === "unit_row" ? "Unit row" : "Legacy"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {products.map((product, index) => {
          const hasErrors = product.errors && product.errors.length > 0;

          return (
            <div
              key={index}
              className={cn(
                "p-4 bg-card rounded-lg border",
                hasErrors ? "border-destructive border-l-4 bg-destructive/5" : "border-border",
              )}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{product.deviceName}</h3>
                    {hasErrors && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold">Validation Errors:</p>
                              <ul className="list-disc list-inside text-xs space-y-0.5">
                                {product.errors?.map((error, i) => (
                                  <li key={i}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    Row {product.rowNumber || index + 1}
                  </span>
                </div>
              </div>

              {hasErrors && (
                <div className="mb-3 p-2 bg-destructive/10 rounded text-xs text-destructive">
                  <ul className="list-disc list-inside space-y-0.5">
                    {product.errors?.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Brand</span>
                  <span className="font-medium text-foreground">{product.brand}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Grade</span>
                  <GradeBadge grade={product.grade} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Storage</span>
                  <span className="font-medium text-foreground">{product.storage}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Quantity</span>
                  <span className="font-semibold text-foreground">{product.quantity}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Identifiers</span>
                  <span className="font-medium text-foreground">
                    {(product.identifiers?.length ?? 0) === product.quantity
                      ? `${product.identifiers?.length ?? 0} unit(s)`
                      : `${product.identifiers?.length ?? 0} / ${product.quantity}`}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Purchase Price</span>
                  <span className="font-medium text-foreground">
                    {formatPrice(product.purchasePrice)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Selling Price</span>
                  <span className="font-medium text-foreground">
                    {formatPrice(product.sellingPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">HST</span>
                  <span className="font-medium text-foreground">
                    {typeof product.hst === "number"
                      ? `${product.hst}%`
                      : `${Number(product.hst) || 0}%`}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Color</span>
                  <span className="font-medium text-foreground">
                    {product.identifiers[0]?.color?.trim()
                      ? product.identifiers[0].color
                      : product.colorCellRaw?.trim() || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Row format</span>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {product.parseMode === "unit_row" ? "Unit row" : "Legacy"}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
