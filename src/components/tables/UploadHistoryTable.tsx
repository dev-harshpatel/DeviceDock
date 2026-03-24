'use client'

import { UploadHistory } from '@/types/upload';
import { Badge } from '@/components/ui/badge';
import { cn, formatDateTimeInOntario } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UploadHistoryTableProps {
  history: UploadHistory[];
  className?: string;
}

const getStatusBadge = (status: UploadHistory['uploadStatus']) => {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'pending':
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
      <div className="text-center py-12 text-muted-foreground">
        No upload history available
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
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
              const hasErrors = item.errorMessage && item.errorMessage.trim() !== '';
              const successRate =
                item.totalProducts > 0
                  ? ((item.successfulInserts / item.totalProducts) * 100).toFixed(1)
                  : '0';

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'transition-colors hover:bg-table-hover',
                    index % 2 === 1 && 'bg-table-zebra'
                  )}
                >
                  <td className="px-6 py-4 text-sm text-foreground">
                    {formatDateTimeInOntario(item.createdAt)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{item.fileName}</span>
                      {hasErrors && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold">Error Details:</p>
                                <p className="text-xs">{item.errorMessage}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                      <span className="text-xs text-muted-foreground ml-1">
                        ({successRate}%)
                      </span>
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
