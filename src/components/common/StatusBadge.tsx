import { memo } from "react";
import { getStockStatus, StockStatus } from "@/data/inventory";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  quantity: number;
  className?: string;
}

const statusConfig: Record<StockStatus, { label: string; className: string }> =
  {
    "in-stock": {
      label: "In Stock",
      className: "bg-success/10 text-success border-success/20",
    },
    "low-stock": {
      label: "Low Stock",
      className: "bg-warning/10 text-warning border-warning/20",
    },
    critical: {
      label: "Critical",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
    "out-of-stock": {
      label: "Out of Stock",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
  };

export const StatusBadge = memo(function StatusBadge({
  quantity,
  className,
}: StatusBadgeProps) {
  const status = getStockStatus(quantity);
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
});
