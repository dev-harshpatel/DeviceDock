"use client";

import { ManualSaleWizard } from "@/components/manual-sale/ManualSaleWizard";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ManualSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualSaleModal({ open, onOpenChange }: ManualSaleModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {open ? (
          <ManualSaleWizard
            key="manual-sale-modal"
            layout="modal"
            onDismiss={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
