/**
 * Invoice-related types
 */

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  poNumber: string;
  paymentTerms: string;
  dueDate: string;
  hstNumber: string;
  invoiceNotes?: string | null;
  invoiceTerms?: string | null;
}

export interface CompanyInfo {
  name: string;
  address: string;
  hstNumber: string;
}
