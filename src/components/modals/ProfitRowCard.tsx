import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";

export interface ProfitRow {
  itemName: string;
  storage: string;
  grade: string;
  quantity: number;
  profit: number;
  sellingPerUnit: number;
  costPerUnit: number;
  revenue: number;
  cost: number;
  margin: number | null;
}

interface ProfitRowCardProps {
  row: ProfitRow;
}

export function ProfitRowCard({ row }: ProfitRowCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{row.itemName}</p>
          <p className="text-xs text-muted-foreground">
            {row.storage} • Grade {row.grade} • Qty {row.quantity}
          </p>
        </div>
        <p
          className={cn(
            "text-sm font-semibold",
            row.profit >= 0 ? "text-emerald-600" : "text-destructive",
          )}
        >
          {formatPrice(row.profit)}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-muted-foreground">Sell / unit</p>
          <p className="font-medium text-foreground">{formatPrice(row.sellingPerUnit)}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-muted-foreground">Cost / unit</p>
          <p className="font-medium text-foreground">{formatPrice(row.costPerUnit)}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-muted-foreground">Revenue</p>
          <p className="font-medium text-foreground">{formatPrice(row.revenue)}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-muted-foreground">Margin</p>
          <p className="font-medium text-foreground">
            {row.margin != null ? `${row.margin.toFixed(2)}%` : "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
