export interface PurchaseHSTRow {
  id: string;
  deviceName: string;
  brand: string;
  quantity: number;
  purchasePrice: number;
  hstRate: number;
  hstAmount: number;
  totalWithHST: number;
  date: string;
}

export interface SalesHSTRow {
  id: string;
  invoiceNumber: string | null | undefined;
  subtotal: number;
  taxRate: number;
  taxRatePercent: number;
  hstCollected: number;
  date: string;
}
