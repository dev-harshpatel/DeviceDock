"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RoleGuard } from "@/components/common/RoleGuard";
import { ManualSaleWizardDynamic } from "@/components/manual-sale/ManualSaleWizardDynamic";
import { Button } from "@/components/ui/button";

export default function ManualSalePage() {
  const router = useRouter();
  const params = useParams();
  const companySlug = typeof params.companySlug === "string" ? params.companySlug : "";

  const handleDismiss = () => {
    if (companySlug) router.push(`/${companySlug}/orders`);
    else router.push("/");
  };

  return (
    <RoleGuard allowedRoles={["owner", "manager"]}>
      <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden px-4 pt-3 pb-5 md:px-8">
        <div className="flex-shrink-0 mb-2 max-w-5xl w-full mx-auto">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2" asChild>
            <Link href={companySlug ? `/${companySlug}/orders` : "/"}>
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to orders
            </Link>
          </Button>
        </div>
        <div className="flex-1 flex flex-col min-h-0 max-w-5xl w-full mx-auto rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <ManualSaleWizardDynamic layout="page" onDismiss={handleDismiss} />
        </div>
      </div>
    </RoleGuard>
  );
}
