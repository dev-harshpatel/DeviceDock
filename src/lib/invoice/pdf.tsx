/**
 * Invoice PDF generation utility
 * Generates PDF invoices using @react-pdf/renderer
 */

import { pdf } from "@react-pdf/renderer";
import { InvoicePDFDocument } from "@/components/pdf/InvoicePDFDocument";
import { Order } from "@/types/order";
import { CompanyInfo, InvoiceData } from "@/types/invoice";
import { COMPANY_LOGOS_BUCKET, getStorageObjectPathFromPublicUrl } from "../supabase/storage-path";
import { supabase } from "../supabase/client/browser";
import { DEFAULT_COMPANY_ADDRESS, DEFAULT_COMPANY_NAME } from "../constants";
import { downloadBlob } from "../export/download";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch an image from a URL and convert it to a base64 data URI.
 * @react-pdf/renderer can struggle with external URLs due to browser CORS
 * restrictions, so we pre-fetch and embed the image as a data URI.
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

async function fetchLogoFromStoragePath(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(COMPANY_LOGOS_BUCKET).download(path);
    if (error || !data) return null;
    return await blobToDataUrl(data);
  } catch {
    return null;
  }
}

async function resolveCompanyLogoDataUrl(logoUrl?: string | null): Promise<string | null> {
  if (!logoUrl) return null;

  const logoPath = getStorageObjectPathFromPublicUrl(logoUrl, COMPANY_LOGOS_BUCKET);
  if (logoPath) {
    const storageDataUrl = await fetchLogoFromStoragePath(logoPath);
    if (storageDataUrl) return storageDataUrl;
  }

  return await fetchImageAsBase64(logoUrl);
}

/**
 * Get company information from settings or defaults (scoped to current tenant).
 */
async function getCompanyInfo(
  companyId: string,
): Promise<CompanyInfo & { logoUrl?: string | null }> {
  try {
    const { data, error } = await supabase
      .from("company_settings")
      .select("company_name, company_address, hst_number, logo_url")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!error && data) {
      const companyData = data as {
        company_name: string | null;
        company_address: string | null;
        hst_number: string | null;
        logo_url: string | null;
      };

      return {
        name:
          companyData.company_name || process.env.NEXT_PUBLIC_COMPANY_NAME || DEFAULT_COMPANY_NAME,
        address:
          companyData.company_address ||
          process.env.NEXT_PUBLIC_COMPANY_ADDRESS ||
          DEFAULT_COMPANY_ADDRESS,
        hstNumber: companyData.hst_number || process.env.NEXT_PUBLIC_COMPANY_HST_NUMBER || "",
        logoUrl: companyData.logo_url,
      };
    }
  } catch (error) {
    console.error("Error fetching company settings:", error);
  }

  return {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME || DEFAULT_COMPANY_NAME,
    address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || DEFAULT_COMPANY_ADDRESS,
    hstNumber: process.env.NEXT_PUBLIC_COMPANY_HST_NUMBER || "",
    logoUrl: null,
  };
}

/**
 * Generate invoice PDF using @react-pdf/renderer
 * @param order - Order data
 * @param invoiceData - Invoice metadata
 * @param customerInfo - Customer business information
 */
export async function generateInvoicePDF(
  companyId: string,
  order: Order,
  invoiceData: InvoiceData,
  customerInfo?: {
    businessName?: string | null;
    businessAddress?: string | null;
  },
): Promise<void> {
  try {
    const companyInfo = await getCompanyInfo(companyId);

    // Pre-fetch logo as base64 so @react-pdf/renderer doesn't hit CORS
    // when trying to load the Supabase Storage URL at render time.
    const logoDataUrl = await resolveCompanyLogoDataUrl(companyInfo.logoUrl);

    // Create PDF document
    const pdfDocument = (
      <InvoicePDFDocument
        companyInfo={{ ...companyInfo, logoUrl: logoDataUrl }}
        customerInfo={customerInfo || {}}
        invoiceData={invoiceData}
        order={order}
      />
    );

    // Generate PDF blob
    const blob = await pdf(pdfDocument).toBlob();

    // Download PDF
    const filename = `invoice-${invoiceData.invoiceNumber.replace("#", "")}.pdf`;

    downloadBlob(blob, filename);
  } catch (error) {
    console.error("Failed to generate invoice PDF:", error);
    throw new Error("Failed to generate invoice PDF");
  }
}
