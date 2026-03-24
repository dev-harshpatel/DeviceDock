/**
 * Users queries
 * Functions for querying user profile data from Supabase
 */

import type { PaginatedResult } from "@/hooks/use-paginated-query";
import { UserProfile } from "@/types/user";
import { supabase } from "../client";
import { dbRowToUserProfile } from "./mappers";
import { Database } from "@/lib/types/database";

type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];

// Field set needed for admin user list + details modal
const ADMIN_USER_LIST_FIELDS = [
  "id",
  "user_id",
  "role",
  "approval_status",
  "approval_status_updated_at",
  "first_name",
  "last_name",
  "phone",
  "business_name",
  "business_email",
  "business_address",
  "business_state",
  "business_country",
  "business_years",
  "business_website",
  "business_city",
  "created_at",
  "updated_at",
].join(", ");

export async function fetchPaginatedUsers(
  search: string,
  range: { from: number; to: number }
): Promise<PaginatedResult<UserProfile>> {
  let query = supabase
    .from("user_profiles")
    .select(ADMIN_USER_LIST_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(
      `first_name.ilike.${q},last_name.ilike.${q},business_name.ilike.${q},business_email.ilike.${q},phone.ilike.${q},business_city.ilike.${q}`
    );
  }

  query = query.range(range.from, range.to);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    data: (data || []).map((row: any) =>
      dbRowToUserProfile(row as UserProfileRow)
    ),
    count: count || 0,
  };
}
