"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Loader2 } from "lucide-react";

export interface InsufficientStockItem {
  deviceName: string;
  requestedQty: number;
  availableQty: number;
}

interface OutOfStockWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insufficientItems: InsufficientStockItem[];
  onCancel: () => void;
  onReject: () => void;
  onApproveAnyway: () => void;
  isApproving?: boolean;
}

export function OutOfStockWarningDialog({
  open,
  onOpenChange,
  insufficientItems,
  onCancel,
  onReject,
  onApproveAnyway,
  isApproving,
}: OutOfStockWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <AlertDialogTitle>Insufficient Stock</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            The following items do not have enough stock to fulfil this order:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="my-2 space-y-1 text-sm">
          {insufficientItems.map((item, i) => (
            <li key={i} className="flex justify-between rounded bg-muted px-3 py-2">
              <span className="font-medium">{item.deviceName}</span>
              <span className="text-muted-foreground">
                Requested: <strong>{item.requestedQty}</strong> &nbsp;|&nbsp; Available:{" "}
                <strong className="text-destructive">{item.availableQty}</strong>
              </span>
            </li>
          ))}
        </ul>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={onReject}>
            Reject Order
          </Button>
          <Button variant="destructive" onClick={onApproveAnyway} disabled={isApproving}>
            {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve Anyway
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
