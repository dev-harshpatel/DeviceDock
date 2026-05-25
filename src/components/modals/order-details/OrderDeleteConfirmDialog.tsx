"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrderDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (text: string) => void;
  isDeleting: boolean;
  onDelete: () => void;
}

export function OrderDeleteConfirmDialog({
  open,
  onOpenChange,
  deleteConfirmText,
  setDeleteConfirmText,
  isDeleting,
  onDelete,
}: OrderDeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isDeleting) return;
        onOpenChange(next);
        if (!next) setDeleteConfirmText("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Order</DialogTitle>
          <DialogDescription>
            Order is confirmed still you want to delete it? This will remove the order and restore
            stock back to inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Type <span className="font-semibold text-foreground">confirm</span> to continue.
          </p>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type confirm"
            disabled={isDeleting}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setDeleteConfirmText("");
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting || deleteConfirmText.trim().toLowerCase() !== "confirm"}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
