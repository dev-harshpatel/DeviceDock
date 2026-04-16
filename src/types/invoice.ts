/**
 * Invoice-related types
 */

import { z } from "zod";

export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  poNumber: z.string().min(1, "PO number is required"),
  paymentTerms: z.string().min(1, "Payment terms is required"),
  dueDate: z.string().min(1, "Due date is required"),
  hstNumber: z.string().optional(),
  invoiceNotes: z.string().optional(),
  invoiceTerms: z.string().optional(),
  discountType: z.enum(["percentage", "cad"]).optional(),
  discountAmount: z.string().optional(),
  shippingAmount: z.string().optional(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

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
