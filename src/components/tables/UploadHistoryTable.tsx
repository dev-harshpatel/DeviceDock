"use client";

import { UploadHistory } from "@/types/upload";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTimeInOntario } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface UploadHistoryTableProps {
  history: UploadHistory[];
  className?: string;
}

const getStatusBadge = (status: UploadHistory["uploadStatus"]) => {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="bg-destructive/10 text-destructive border-destructive/20"
        >
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export function UploadHistoryTable({ history, className }: UploadHistoryTableProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">No upload history available</div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                Date/Time
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                File Name
              </th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                Total Products
              </th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                Successful
              </th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                Failed
              </th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((item, index) => {
              const hasErrors = item.errorMessage && item.errorMessage.trim() !== "";
              const successRate =
                item.totalProducts > 0
                  ? ((item.successfulInserts / item.totalProducts) * 100).toFixed(1)
                  : "0";

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "transition-colors hover:bg-table-hover",
                    index % 2 === 1 && "bg-table-zebra",
                  )}
                >
                  <td className="px-6 py-4 text-sm text-foreground">
                    {formatDateTimeInOntario(item.createdAt)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        {hasErrors && (
                          <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                        )}
                        <span className="font-medium text-foreground">{item.fileName}</span>
                      </div>
                      {hasErrors && (
                        <ul className="space-y-0.5">
                          {item.errorMessage!.split("; ").map((msg, i) => (
                            <li key={i} className="text-xs text-destructive leading-snug">
                              {msg}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-foreground">
                    {item.totalProducts}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm font-medium text-success">
                      {item.successfulInserts}
                    </span>
                    {item.totalProducts > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">({successRate}%)</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {item.failedInserts > 0 ? (
                      <span className="text-sm font-medium text-destructive">
                        {item.failedInserts}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">{getStatusBadge(item.uploadStatus)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
