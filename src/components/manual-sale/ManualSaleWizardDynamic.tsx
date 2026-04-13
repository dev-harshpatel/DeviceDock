"use client";

import dynamic from "next/dynamic";
import { Loader } from "@/components/common/Loader";
import type { ManualSaleWizardProps } from "@/components/manual-sale/ManualSaleWizard";

const ManualSaleWizardInner = dynamic(
  () => import("./ManualSaleWizard").then((mod) => ({ default: mod.ManualSaleWizard })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 min-h-[200px] items-center justify-center">
        <Loader text="Loading…" />
      </div>
    ),
  },
);

export const ManualSaleWizardDynamic = (props: ManualSaleWizardProps) => (
  <ManualSaleWizardInner {...props} />
);
