"use client";

import { ShoppingBag } from "lucide-react";
import { useManualSaleWizard } from "@/hooks/use-manual-sale-wizard";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ManualSaleStepIndicator } from "@/components/manual-sale/ManualSaleStepIndicator";
import { Step1BrowseItems } from "@/components/manual-sale/Step1BrowseItems";
import { Step2ImeiAssignment } from "@/components/manual-sale/Step2ImeiAssignment";
import { Step3ReviewPrices } from "@/components/manual-sale/Step3ReviewPrices";
import { Step4CustomerDetails } from "@/components/manual-sale/Step4CustomerDetails";
import { Order } from "@/types/order";

export interface ManualSaleWizardProps {
  /** Called after cancel or successful submit (reset form first). */
  onDismiss: () => void;
  /** Full page gives the browse list more vertical room than the modal. */
  layout: "modal" | "page";
  mode?: "create" | "edit";
  /** When `mode` is `edit`, seed and submit against this order. */
  orderToEdit?: Order | null;
  /** Called after a successful edit (not used for create). */
  onManualOrderUpdated?: (order: Order) => void;
}

export function ManualSaleWizard({
  onDismiss,
  layout,
  mode = "create",
  orderToEdit = null,
  onManualOrderUpdated,
}: ManualSaleWizardProps) {
  const isPage = layout === "page";
  const w = useManualSaleWizard({ onDismiss, mode, orderToEdit, onManualOrderUpdated });

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      {isPage ? (
        <div className="px-6 pt-4 pb-3 border-b border-border flex-shrink-0">
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary shrink-0" aria-hidden />
            {w.isEdit ? "Edit Manual Sale" : "Record Manual Sale"}
          </h1>
          <ManualSaleStepIndicator step={w.step} />
        </div>
      ) : (
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary shrink-0" aria-hidden />
            {w.isEdit ? "Edit Manual Sale" : "Record Manual Sale"}
          </DialogTitle>
          <ManualSaleStepIndicator step={w.step} />
        </DialogHeader>
      )}

      {w.step === 1 && (
        <Step1BrowseItems
          identifierQuery={w.identifierQuery}
          onIdentifierQueryChange={w.setIdentifierQuery}
          identifierGroups={w.identifierGroups}
          identifierLookupLoading={w.identifierLookupLoading}
          onIdentifierLookup={() => void w.handleIdentifierLookup()}
          onRemoveIdentifierUnit={w.handleRemoveIdentifierUnit}
          searchQuery={w.searchQuery}
          onSearchQueryChange={w.setSearchQuery}
          availableItems={w.availableItems}
          selectedItems={w.selectedItems}
          selectedItemsList={w.selectedItemsList}
          scannedUnitsByInventoryId={w.scannedUnitsByInventoryId}
          scannedUnitCount={w.scannedUnitCount}
          subtotal={w.subtotal}
          getEffectiveStock={w.getEffectiveStock}
          getBrowseMaxQty={w.getBrowseMaxQty}
          onToggleItem={w.handleToggleItem}
          onQuantityChange={w.handleQuantityChange}
          onQuantityInput={w.handleQuantityInput}
          onClose={w.handleClose}
          onNext={() => void w.handleGoToStep2()}
        />
      )}

      {w.step === 2 && (
        <Step2ImeiAssignment
          selectedItemsList={w.selectedItemsList}
          identifiersLoading={w.identifiersLoading}
          availableIdentifiers={w.availableIdentifiers}
          pendingImeiSelections={w.pendingImeiSelections}
          onTogglePendingImei={w.handleTogglePendingImei}
          onNext={w.handleGoToStep3FromImei}
          onBack={w.handleBackFromStep2}
        />
      )}

      {w.step === 3 && (
        <Step3ReviewPrices
          selectedItemsList={w.selectedItemsList}
          identifierGroups={w.identifierGroups}
          sellingPrices={w.sellingPrices}
          sellingPricesIdentUnit={w.sellingPricesIdentUnit}
          subtotal={w.subtotal}
          getEffectiveUnitPriceIdent={w.getEffectiveUnitPriceIdent}
          onSellingPriceChange={w.handleSellingPriceChange}
          onSellingPriceBlur={w.handleSellingPriceBlur}
          onSellingPriceChangeIdentUnit={w.handleSellingPriceChangeIdentUnit}
          onSellingPriceBlurIdentUnit={w.handleSellingPriceBlurIdentUnit}
          onNext={w.handleGoToStep4}
          onBack={() => w.setStep(1)}
        />
      )}

      {w.step === 4 && (
        <Step4CustomerDetails
          customerName={w.customerName}
          onCustomerNameChange={w.setCustomerName}
          customerEmail={w.customerEmail}
          onCustomerEmailChange={w.setCustomerEmail}
          customerPhone={w.customerPhone}
          onCustomerPhoneChange={w.setCustomerPhone}
          billingAddress={w.billingAddress}
          onBillingAddressChange={w.setBillingAddress}
          shippingAddress={w.shippingAddress}
          onShippingAddressChange={w.setShippingAddress}
          sameAsShipping={w.sameAsShipping}
          onSameAsShippingChange={w.setSameAsShipping}
          notes={w.notes}
          onNotesChange={w.setNotes}
          paymentMethod={w.paymentMethod}
          onPaymentMethodChange={w.setPaymentMethod}
          hstPercent={w.hstPercent}
          onHstPercentChange={w.setHstPercent}
          selectedItemsList={w.selectedItemsList}
          identifierGroups={w.identifierGroups}
          subtotal={w.subtotal}
          hstAmount={w.hstAmount}
          total={w.total}
          getEffectivePrice={w.getEffectivePrice}
          getEffectiveUnitPriceIdent={w.getEffectiveUnitPriceIdent}
          isEdit={w.isEdit}
          isSubmitting={w.isSubmitting}
          submitFailed={w.submitFailed}
          onSubmit={() => void w.handleSubmit()}
          onBack={() => w.setStep(3)}
          onStartOver={w.handleClose}
        />
      )}
    </div>
  );
}
