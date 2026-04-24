import { InventoryItem, calculatePricePerUnit, getStockStatus } from "@/data/inventory";
import { removeTax } from "@/lib/tax";
import { formatPrice } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { GradeBadge } from "@/components/common/GradeBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ColorBreakdownPopover } from "@/components/common/ColorBreakdownPopover";
import { ClickableGradeBadge } from "@/components/common/ClickableGradeBadge";
import { cn } from "@/lib/utils";

const formatPriceWithoutCurrencySuffix = (value: number): string => {
  return formatPrice(value).replace(/\s*CAD$/i, "");
};

const getPricePerUnitWithoutTax = (item: InventoryItem): number => {
  if (item.quantity > 0 && item.purchasePrice != null) {
    return item.purchasePrice / item.quantity;
  }
  if (item.hst != null && item.hst > 0) {
    return removeTax(item.pricePerUnit, item.hst);
  }
  return item.pricePerUnit;
};

const getPricePerUnitWithTax = (item: InventoryItem): number => {
  if (item.quantity > 0 && item.purchasePrice != null) {
    return calculatePricePerUnit(item.purchasePrice, item.quantity, item.hst ?? 0);
  }
  return item.pricePerUnit;
};

interface InventoryTableProps {
  items: InventoryItem[];
  className?: string;
  hasActiveFilters?: boolean;
  showColorBreakdown?: boolean;
}

export function InventoryTable({
  items,
  className,
  hasActiveFilters,
  showColorBreakdown,
}: InventoryTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? "No inventory found" : "Inventory is empty"}
        description={
          hasActiveFilters
            ? "Try adjusting your search or filter criteria to find what you're looking for."
            : "Add your first product using the 'Add Product' button above to get started."
        }
      />
    );
  }

  return (
    <>
      {/* Desktop Table — shown at lg+ to account for the admin sidebar width */}
      <div
        className={cn(
          "hidden lg:flex lg:flex-col rounded-lg border border-border bg-card h-full overflow-hidden",
          className,
        )}
      >
        <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full border-collapse">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                  Device Name
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                  Grade
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                  Storage
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                  Qty
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                  Purchase Price / Unit
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                  HST %
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                  Price/Unit (With Tax)
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                  Price/Unit (Without Tax)
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                  Selling Price
                </th>
                <th className="sticky top-0 z-10 bg-muted border-b border-border text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item, index) => {
                const status = getStockStatus(item.quantity);
                const isLowStock = status === "low-stock" || status === "critical";

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "transition-colors hover:bg-table-hover",
                      index % 2 === 1 && "bg-table-zebra",
                      isLowStock && "bg-destructive/[0.02]",
                    )}
                  >
                    <td className="px-4 py-2.5 text-center align-middle">
                      <span className="font-medium text-foreground text-sm">{item.deviceName}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      <ClickableGradeBadge
                        grade={item.grade}
                        inventoryId={item.id}
                        deviceName={item.deviceName}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle text-sm text-foreground">
                      {item.storage}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={cn(
                            "font-semibold text-sm",
                            status === "critical" && "text-destructive",
                            status === "low-stock" && "text-warning",
                            status === "in-stock" && "text-foreground",
                          )}
                        >
                          {item.quantity}
                        </span>
                        {showColorBreakdown && (
                          <ColorBreakdownPopover
                            inventoryIds={item.inventoryIds ?? [item.id]}
                            stockQuantity={item.quantity}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle font-medium text-foreground text-sm">
                      {item.purchasePrice != null && item.quantity > 0
                        ? formatPriceWithoutCurrencySuffix(item.purchasePrice / item.quantity)
                        : item.purchasePrice != null
                          ? formatPriceWithoutCurrencySuffix(item.purchasePrice)
                          : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle font-medium text-foreground text-sm">
                      {item.hst != null ? `${item.hst}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle font-medium text-muted-foreground text-sm">
                      {formatPriceWithoutCurrencySuffix(getPricePerUnitWithTax(item))}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle font-medium text-muted-foreground text-sm">
                      {formatPriceWithoutCurrencySuffix(getPricePerUnitWithoutTax(item))}
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle font-medium text-foreground text-sm">
                      {formatPriceWithoutCurrencySuffix(item.sellingPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-center align-middle">
                      <StatusBadge quantity={item.quantity} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile / Tablet Cards — shown below lg */}
      <div className={cn("lg:hidden space-y-2 pb-2", className)}>
        {items.map((item) => {
          const status = getStockStatus(item.quantity);
          const isLowStock = status === "low-stock" || status === "critical";

          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col gap-1.5 p-2 bg-card rounded-lg border border-border",
                isLowStock && "border-destructive/20 bg-destructive/[0.02]",
              )}
            >
              {/* Row 1: Device name */}
              <span className="font-medium text-sm text-foreground line-clamp-2">
                {item.deviceName}
              </span>

              {/* Row 2: Grade, Storage, Qty, Status, Selling Price */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <ClickableGradeBadge
                    grade={item.grade}
                    inventoryId={item.id}
                    deviceName={item.deviceName}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{item.storage}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={cn(
                        "font-semibold text-xs",
                        status === "critical" && "text-destructive",
                        status === "low-stock" && "text-warning",
                        status === "in-stock" && "text-foreground",
                      )}
                    >
                      ×{item.quantity}
                    </span>
                    {showColorBreakdown && (
                      <ColorBreakdownPopover
                        inventoryIds={item.inventoryIds ?? [item.id]}
                        stockQuantity={item.quantity}
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge quantity={item.quantity} />
                  <span className="font-semibold text-sm text-foreground">
                    {formatPriceWithoutCurrencySuffix(item.sellingPrice)}
                  </span>
                </div>
              </div>

              {/* Row 3: Admin details (purchase price, HST, price/unit) */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/60 pt-1.5">
                <span>
                  Buy:{" "}
                  <span className="text-foreground font-medium">
                    {item.purchasePrice != null && item.quantity > 0
                      ? formatPriceWithoutCurrencySuffix(item.purchasePrice / item.quantity)
                      : item.purchasePrice != null
                        ? formatPriceWithoutCurrencySuffix(item.purchasePrice)
                        : "—"}
                  </span>
                </span>
                <span>
                  HST:{" "}
                  <span className="text-foreground font-medium">
                    {item.hst != null ? `${item.hst}%` : "—"}
                  </span>
                </span>
                <span>
                  /unit (w tax):{" "}
                  <span className="text-foreground font-medium">
                    {formatPriceWithoutCurrencySuffix(getPricePerUnitWithTax(item))}
                  </span>
                </span>
                <span>
                  /unit (w/o tax):{" "}
                  <span className="text-foreground font-medium">
                    {formatPriceWithoutCurrencySuffix(getPricePerUnitWithoutTax(item))}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
