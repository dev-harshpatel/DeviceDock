/**
 * Product uploads queries
 */

import { supabase } from "../client/browser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchUploadHistoryQuery(companyId: string): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("product_uploads") as any)
    .select(
      [
        "id",
        "uploaded_by",
        "file_name",
        "total_products",
        "successful_inserts",
        "failed_inserts",
        "upload_status",
        "error_message",
        "created_at",
        "updated_at",
      ].join(", "),
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchUploadHistoryQuery] failed:", error.message, error);
    throw error;
  }
  return data || [];
}

export async function createUploadRecordQuery(payload: {
  company_id: string;
  uploaded_by: string;
  file_name: string;
  total_products: number;
  successful_inserts: number;
  failed_inserts: number;
  upload_status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("product_uploads") as any)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[createUploadRecordQuery] failed:", error.message, error);
    throw error;
  }
  return data;
}

export async function updateUploadRecordQuery(
  id: string,
  updates: {
    successful_inserts?: number;
    failed_inserts?: number;
    upload_status?: string;
    error_message?: string | null;
    updated_at?: string;
  },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("product_uploads") as any).update(updates).eq("id", id);

  if (error) {
    console.error("[updateUploadRecordQuery] failed:", error.message, error);
    throw error;
  }
}
