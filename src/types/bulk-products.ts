import type { ColourRow } from "@/components/modals/ColourBreakdownDialog";
import type { Grade } from "@/lib/constants/grades";

export interface BulkProductRowForm {
  brand: string;
  deviceName: string;
  grade: Grade | "";
  hst: string;
  imeiText: string;
  purchasePrice: string;
  quantity: string;
  selectedInventoryId: string | null;
  sellingPrice: string;
  serialText: string;
  storage: string;
  colorRows: ColourRow[];
  colorMergeMode: boolean;
}

export type BulkEditableField = keyof Omit<BulkProductRowForm, "selectedInventoryId">;
