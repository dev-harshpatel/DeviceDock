"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Loader } from "@/components/common/Loader";
import { RoleGuard } from "@/components/common/RoleGuard";
import { ManualSaleWizardDynamic } from "@/components/manual-sale/ManualSaleWizardDynamic";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/contexts/CompanyContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useOrders } from "@/contexts/OrdersContext";
import { supabase } from "@/lib/supabase/client";
import { dbRowToOrder, ORDER_FIELDS } from "@/lib/supabase/queries";
import { Order } from "@/types/order";
import { toast } from "sonner";

export default function EditManualSalePage() {
  const router = useRouter();
  const params = useParams();
  const companySlug = typeof params.companySlug === "string" ? params.companySlug : "";
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const { companyId, canWrite, slug } = useCompany();
  const ordersListPath = `/${slug}/orders`;
  const { refreshOrders } = useOrders();
  const { refreshInventory } = useInventory();

  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  const handleDismiss = useCallback(() => {
    if (companySlug) {
      router.push(`/${companySlug}/orders`);
      return;
    }
    router.push("/");
  }, [companySlug, router]);

  const handleManualOrderUpdated = useCallback(() => {
    void refreshOrders();
    void refreshInventory();
  }, [refreshInventory, refreshOrders]);

  useEffect(() => {
    if (!orderId) {
      toast.error("Invalid order.");
      router.replace(ordersListPath);
      return;
    }
    if (!companyId) {
      return;
    }
    if (!canWrite) {
      toast.error("You do not have permission to edit this order.");
      router.replace(ordersListPath);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoadState("loading");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("orders") as any)
        .select(ORDER_FIELDS)
        .eq("id", orderId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        toast.error("Order not found.");
        setLoadState("error");
        router.replace(ordersListPath);
        return;
      }

      const o = dbRowToOrder(data);

      if (!o.isManualSale) {
        toast.error("This order is not a manual sale.");
        setLoadState("error");
        router.replace(ordersListPath);
        return;
      }

      if (o.status !== "approved" && o.status !== "completed") {
        toast.error("This order cannot be edited.");
        setLoadState("error");
        router.replace(ordersListPath);
        return;
      }

      if (o.invoiceConfirmed === true) {
        toast.error("Invoice is confirmed; this order cannot be edited.");
        setLoadState("error");
        router.replace(ordersListPath);
        return;
      }

      setOrderToEdit(o);
      setLoadState("ready");
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [canWrite, companyId, orderId, ordersListPath, router]);

  return (
    <RoleGuard allowedRoles={["owner", "manager", "inventory_admin"]}>
      <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden px-4 pt-3 pb-5 md:px-8">
        <div className="flex-shrink-0 mb-2 max-w-7xl w-full mx-auto">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2" asChild>
            <Link href={companySlug ? `/${companySlug}/orders` : "/"}>
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to orders
            </Link>
          </Button>
        </div>

        {loadState === "loading" ? (
          <div className="flex-1 flex items-center justify-center min-h-[40vh]">
            <Loader />
          </div>
        ) : orderToEdit ? (
          <div className="flex-1 flex flex-col min-h-0 max-w-7xl w-full mx-auto rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <ManualSaleWizardDynamic
              key={`edit-page-${orderToEdit.id}`}
              layout="page"
              mode="edit"
              onDismiss={handleDismiss}
              onManualOrderUpdated={handleManualOrderUpdated}
              orderToEdit={orderToEdit}
            />
          </div>
        ) : null}
      </div>
    </RoleGuard>
  );
}
