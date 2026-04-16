import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UploadHistory } from "@/types/upload";

interface UploadStatsCardsProps {
  totalProducts: number;
  totalUploads: number;
  successRate: string;
  totalSuccessful: number;
  totalFailed: number;
  lastUpload: UploadHistory | undefined;
}

export function UploadStatsCards({
  totalProducts,
  totalUploads,
  successRate,
  totalSuccessful,
  totalFailed,
  lastUpload,
}: UploadStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProducts}</div>
          <p className="text-xs text-muted-foreground">In database</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
          <Upload className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUploads}</div>
          <p className="text-xs text-muted-foreground">Uploads performed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{successRate}%</div>
          <p className="text-xs text-muted-foreground">
            {totalSuccessful} successful, {totalFailed} failed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Upload</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {lastUpload
              ? new Date(lastUpload.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "N/A"}
          </div>
          <p className="text-xs text-muted-foreground">
            {lastUpload ? `${lastUpload.successfulInserts} products` : "No uploads yet"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
