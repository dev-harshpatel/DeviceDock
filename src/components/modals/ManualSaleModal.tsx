"use client";

import { ManualSaleWizardDynamic } from "@/components/manual-sale/ManualSaleWizardDynamic";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Order } from "@/types/order";

interface ManualSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  orderToEdit?: Order | null;
  onManualOrderUpdated?: (order: Order) => void;
}

export function ManualSaleModal({
  open,
  onOpenChange,
  mode = "create",
  orderToEdit = null,
  onManualOrderUpdated,
}: ManualSaleModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {open ? (
          <ManualSaleWizardDynamic
            key={mode === "edit" && orderToEdit ? `edit-${orderToEdit.id}` : "manual-sale-modal"}
            layout="modal"
            onDismiss={() => onOpenChange(false)}
            mode={mode}
            orderToEdit={orderToEdit}
            onManualOrderUpdated={onManualOrderUpdated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
