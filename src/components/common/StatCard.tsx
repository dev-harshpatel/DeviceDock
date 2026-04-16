import { memo } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: { value: string; positive: boolean };
  icon: React.ReactNode;
  accent?: "primary" | "success" | "warning" | "destructive";
  description?: string;
  /** When true, card fills height and vertically centers the row (e.g. dashboard metric tiles). */
  fillHeight?: boolean;
  className?: string;
}

const accentStyles = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export const StatCard = memo(function StatCard({
  title,
  value,
  change,
  icon,
  accent = "primary",
  description,
  fillHeight,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6 shadow-soft",
        fillHeight && "flex min-h-0 flex-col justify-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex justify-between gap-3",
          description || change ? "items-start" : "items-center",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="stat-card-title text-sm text-muted-foreground">{title}</p>
          <p className="stat-card-value mt-1 min-w-0 break-words text-2xl font-semibold tabular-nums leading-tight text-foreground sm:break-normal sm:whitespace-nowrap">
            {value}
          </p>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          {change && (
            <div className="flex items-center gap-1 mt-2 text-sm">
              {change.positive ? (
                <ArrowUpRight className="h-4 w-4 text-success" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              )}
              <span className={change.positive ? "text-success" : "text-destructive"}>
                {change.value}
              </span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-lg flex-shrink-0", accentStyles[accent])}>{icon}</div>
      </div>
    </div>
  );
});
