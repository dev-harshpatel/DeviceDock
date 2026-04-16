import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPrice } from "@/lib/utils";

// Grade colors for charts
const GRADE_COLORS: Record<string, string> = {
  "Brand New Sealed": "hsl(160, 84%, 39%)",
  "Brand New Open Box": "hsl(174, 72%, 40%)",
  "Grade A": "hsl(142, 76%, 36%)",
  "Grade B": "hsl(38, 92%, 50%)",
  "Grade C": "hsl(217, 91%, 60%)",
  "Grade D": "hsl(0, 72%, 51%)",
};

const COLORS = [
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(217, 91%, 60%)",
  "hsl(0, 72%, 51%)",
];

const trendChartConfig = {
  orders: { label: "Orders", color: "hsl(245, 58%, 60%)" },
  units: { label: "Units", color: "hsl(38, 92%, 50%)" },
  value: { label: "Revenue ($)", color: "hsl(142, 76%, 36%)" },
} satisfies ChartConfig;

const valueByDeviceConfig = {
  value: { label: "Inventory Value", color: "hsl(245, 58%, 60%)" },
} satisfies ChartConfig;

const gradeChartConfig = {
  value: { label: "Units" },
} satisfies ChartConfig;

const orderStatusConfig = {
  value: { label: "Orders" },
} satisfies ChartConfig;

const revenueByStatusConfig = {
  value: { label: "Revenue", color: "hsl(142, 76%, 36%)" },
} satisfies ChartConfig;

interface TrendDataPoint {
  period: string;
  units: number;
  value: number;
  orders: number;
  sortKey: number;
}

interface NameValuePoint {
  name: string;
  value: number;
}

interface ValueByDevicePoint {
  name: string;
  value: number;
  units: number;
}

interface StockByStatusPoint {
  name: string;
  value: number;
  color: string;
  bg: string;
}

interface ReportsChartsGridProps {
  trendData: TrendDataPoint[];
  trendGrouping: "day" | "week" | "month";
  hasDateRangeFrom: boolean;
  valueByDevice: ValueByDevicePoint[];
  stockByGrade: NameValuePoint[];
  stockByStatus: StockByStatusPoint[];
  orderStatusDistribution: NameValuePoint[];
  revenueByStatus: NameValuePoint[];
}

export function ReportsChartsGrid({
  trendData,
  trendGrouping,
  hasDateRangeFrom,
  valueByDevice,
  stockByGrade,
  stockByStatus,
  orderStatusDistribution,
  revenueByStatus,
}: ReportsChartsGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Orders & Revenue Trend — full width */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-6 lg:col-span-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-5">
          <div>
            <h3 className="font-semibold text-foreground">Orders & Revenue Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {trendGrouping === "day" ? "Daily" : trendGrouping === "week" ? "Weekly" : "Monthly"}{" "}
              breakdown · orders, units sold, and revenue
              {!hasDateRangeFrom && (
                <span className="ml-1 italic">(select a date range to change granularity)</span>
              )}
            </p>
          </div>
          <span className="self-start sm:self-auto inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground shrink-0">
            {trendGrouping === "day" ? "By Day" : trendGrouping === "week" ? "By Week" : "By Month"}
          </span>
        </div>

        {trendData.length > 0 ? (
          <div className="h-72">
            <ChartContainer config={trendChartConfig} className="h-full w-full">
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-orders)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-orders)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillUnits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-units)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-units)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  fontSize={12}
                />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={12} width={32} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={48}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(label) => (
                        <span className="font-medium text-foreground">{label}</span>
                      )}
                    />
                  }
                />
                <Area
                  yAxisId="left"
                  type="natural"
                  dataKey="orders"
                  stroke="var(--color-orders)"
                  strokeWidth={2}
                  fill="url(#fillOrders)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Area
                  yAxisId="left"
                  type="natural"
                  dataKey="units"
                  stroke="var(--color-units)"
                  strokeWidth={2}
                  fill="url(#fillUnits)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Area
                  yAxisId="right"
                  type="natural"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  fill="url(#fillRevenue)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            No order data available for the selected filters
          </div>
        )}
      </div>

      {/* Value by Device */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-6">
        <h3 className="font-semibold text-foreground mb-4">Value by Device</h3>
        {valueByDevice.length > 0 ? (
          <div className="h-64">
            <ChartContainer config={valueByDeviceConfig} className="h-full w-full">
              <BarChart data={valueByDevice} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  fontSize={12}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatPrice(value as number)} />
                  }
                />
                <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        )}
      </div>

      {/* Units by Grade */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-6">
        <h3 className="font-semibold text-foreground mb-4">Units by Grade</h3>
        {stockByGrade.length > 0 ? (
          <div className="h-64 flex items-center justify-center">
            <ChartContainer config={gradeChartConfig} className="h-full w-full">
              <PieChart>
                <Pie
                  data={stockByGrade}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {stockByGrade.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={GRADE_COLORS[entry.name] || COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
              </PieChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        )}
      </div>

      {/* Order Status Distribution */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-6">
        <h3 className="font-semibold text-foreground mb-4">Order Status Distribution</h3>
        {orderStatusDistribution.length > 0 ? (
          <div className="h-64 flex items-center justify-center">
            <ChartContainer config={orderStatusConfig} className="h-full w-full">
              <PieChart>
                <Pie
                  data={orderStatusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {orderStatusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
              </PieChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No orders found
          </div>
        )}
      </div>

      {/* Revenue by Status */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-6">
        <h3 className="font-semibold text-foreground mb-4">Revenue by Status</h3>
        {revenueByStatus.length > 0 ? (
          <div className="h-64">
            <ChartContainer config={revenueByStatusConfig} className="h-full w-full">
              <BarChart data={revenueByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatPrice(value as number)} />
                  }
                />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No revenue data
          </div>
        )}
      </div>

      {/* Stock Status Distribution — full width */}
      <div className="bg-card rounded-lg border border-border shadow-soft p-6 lg:col-span-2">
        <h3 className="font-semibold text-foreground mb-4">Stock Status Distribution</h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {stockByStatus.map((status) => (
            <div
              key={status.name}
              className="text-center p-2 sm:p-4 rounded-lg"
              style={{ backgroundColor: status.bg }}
            >
              <p className="text-2xl sm:text-3xl font-bold" style={{ color: status.color }}>
                {status.value}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-tight">
                {status.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
