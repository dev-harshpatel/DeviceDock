"use client";

import { type ReactNode, useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn, formatPrice } from "@/lib/utils";
import type { MonthlyOrderFlowPoint } from "@/lib/dashboard/order-flow-monthly-series";

type Variant = "purchase" | "selling";

const VARIANT_CONFIG: Record<
  Variant,
  { dataKey: keyof Pick<MonthlyOrderFlowPoint, "purchaseFlow" | "sellingFlow">; gradientId: string }
> = {
  purchase: { dataKey: "purchaseFlow", gradientId: "invPurchaseFill" },
  selling: { dataKey: "sellingFlow", gradientId: "invSellingFill" },
};

const chartConfig = {
  purchaseFlow: {
    label: "Purchase (est.)",
    color: "hsl(217 91% 55%)",
  },
  sellingFlow: {
    label: "Selling",
    color: "hsl(152 65% 38%)",
  },
} satisfies ChartConfig;

const ACCENT_BOX: Record<Variant, string> = {
  purchase: "bg-primary/10 text-primary",
  selling: "bg-success/10 text-success",
};

export interface InventoryValueSparklineCardProps {
  variant: Variant;
  title: string;
  description: string;
  value: string;
  series: MonthlyOrderFlowPoint[];
  icon: ReactNode;
  className?: string;
}

export const InventoryValueSparklineCard = ({
  variant,
  title,
  description,
  value,
  series,
  icon,
  className,
}: InventoryValueSparklineCardProps) => {
  const instanceId = useId().replace(/:/g, "");
  const { dataKey, gradientId } = VARIANT_CONFIG[variant];
  const fillGradientId = `${gradientId}-${instanceId}`;
  const strokeVar =
    variant === "purchase" ? "var(--color-purchaseFlow)" : "var(--color-sellingFlow)";

  return (
    <div
      className={cn(
        "relative flex w-full min-h-0 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-soft sm:p-5",
        "max-lg:min-h-[16rem]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className={cn("shrink-0 rounded-lg p-3", ACCENT_BOX[variant])}>{icon}</div>
      </div>

      <div className="relative isolate z-0 flex h-[9.5rem] w-full min-h-0 shrink-0 sm:h-[10rem] xl:h-auto xl:min-h-[7rem] xl:flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full !aspect-auto min-h-0">
          <AreaChart
            data={series}
            margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="8%" stopColor={strokeVar} stopOpacity={0.35} />
                <stop offset="95%" stopColor={strokeVar} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} className="stroke-border/40" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <ChartTooltip
              cursor={{ className: "stroke-border" }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  formatter={(val) => (
                    <span className="font-mono tabular-nums">{formatPrice(Number(val))}</span>
                  )}
                />
              }
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={strokeVar}
              strokeWidth={2}
              fill={`url(#${fillGradientId})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ChartContainer>
      </div>
      <p className="text-[10px] leading-tight text-muted-foreground">
        Last {series.length} months · order activity (monthly)
      </p>
    </div>
  );
};
