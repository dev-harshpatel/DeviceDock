import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { format } from "date-fns";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { SalesHSTRow } from "@/types/hst";

const hstTimelineConfig = {
  hstPaid: { label: "HST Paid (ITC)", color: "hsl(217, 91%, 60%)" },
  hstCollected: { label: "HST Collected", color: "hsl(142, 76%, 36%)" },
} satisfies ChartConfig;

const formatPct = (v: number) => `${v.toFixed(2)}%`;

const parseDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

interface TimelineDataPoint {
  period: string;
  hstPaid: number;
  hstCollected: number;
}

interface HSTTimelineSectionProps {
  timelineData: TimelineDataPoint[];
  rateMismatches: SalesHSTRow[];
  avgPurchaseRate: number;
}

export function HSTTimelineSection({
  timelineData,
  rateMismatches,
  avgPurchaseRate,
}: HSTTimelineSectionProps) {
  return (
    <>
      {timelineData.length > 0 && (
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <h3 className="font-semibold text-foreground mb-1">HST Paid vs Collected by Period</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Compare your Input Tax Credits (paid on purchases) with HST collected from sales over
            time.
          </p>
          <div className="h-72">
            <ChartContainer config={hstTimelineConfig} className="h-full w-full">
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" fontSize={12} />
                <YAxis
                  fontSize={12}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatPrice(value as number)} />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="hstPaid" fill="var(--color-hstPaid)" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="hstCollected"
                  fill="var(--color-hstCollected)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      )}

      {rateMismatches.length > 0 && (
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <h3 className="font-semibold text-foreground mb-1">Rate Difference Analysis</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Orders where the applied tax rate was below your average purchase HST rate of{" "}
            <span className="font-medium text-foreground">{formatPct(avgPurchaseRate)}</span>. A
            lower collected rate means less remittance to CRA.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 text-muted-foreground font-medium">Order</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">Subtotal</th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">
                    Applied Rate
                  </th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">
                    HST Collected
                  </th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">
                    At {formatPct(avgPurchaseRate)}
                  </th>
                  <th className="text-right pb-2 text-muted-foreground font-medium">Saving</th>
                </tr>
              </thead>
              <tbody>
                {rateMismatches.map((row) => {
                  const atStdRate = row.subtotal * (avgPurchaseRate / 100);
                  const saving = atStdRate - row.hstCollected;
                  return (
                    <tr key={row.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-foreground">
                        <div className="font-medium">
                          {row.invoiceNumber ?? `#${row.id.slice(-8).toUpperCase()}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {parseDate(row.date) ? format(parseDate(row.date)!, "MMM dd, yyyy") : "—"}
                        </div>
                      </td>
                      <td className="py-2 text-right text-foreground">
                        {formatPrice(row.subtotal)}
                      </td>
                      <td className="py-2 text-right">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {formatPct(row.taxRatePercent)}
                        </span>
                      </td>
                      <td className="py-2 text-right text-foreground">
                        {formatPrice(row.hstCollected)}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {formatPrice(atStdRate)}
                      </td>
                      <td className="py-2 text-right font-medium text-success">
                        -{formatPrice(saving)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="pt-2 text-muted-foreground text-xs" colSpan={6}>
                    "Saving" = reduction in your CRA remittance vs if all sales were at{" "}
                    {formatPct(avgPurchaseRate)} HST
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
