/**
 * Supabase utility functions for user profiles and role checking
 */

import { supabase } from "./client";
import { UserProfile, UserRole } from "@/types/user";
import { Database, Json } from "@/lib/database.types";
import { dbRowToUserProfile } from "@/lib/supabase/queries";

type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];

const USER_PROFILE_FIELDS = [
  "id",
  "user_id",
  "role",
  "approval_status",
  "approval_status_updated_at",
  "first_name",
  "last_name",
  "phone",
  "business_name",
  "business_address",
  "business_address_components",
  "business_state",
  "business_city",
  "business_country",
  "business_years",
  "business_website",
  "business_email",
  "shipping_address",
  "shipping_address_components",
  "shipping_city",
  "shipping_state",
  "shipping_country",
  "shipping_postal_code",
  "billing_address",
  "billing_address_components",
  "billing_city",
  "billing_state",
  "billing_country",
  "billing_postal_code",
  "shipping_same_as_business",
  "billing_same_as_business",
  "created_at",
  "updated_at",
].join(", ");

/**
 * Get user profile by user ID
 */
export const getUserProfile = async (
  userId: string
): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select(USER_PROFILE_FIELDS)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      return null;
    }

    if (!data) {
      return null;
    }

    const row = data as UserProfileRow;
    return dbRowToUserProfile(row);
  } catch (error) {
    return null;
  }
};

/**
 * Get user profile by user ID (with current auth user)
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Handle refresh token errors gracefully
    if (
      error &&
      (error.message?.includes("refresh_token_not_found") ||
        error.message?.includes("Invalid Refresh Token"))
    ) {
      return null;
    }

    if (!user) {
      return null;
    }
    return getUserProfile(user.id);
  } catch (error) {
    const err = error as { message?: string };
    // Handle refresh token errors in catch block too
    if (
      err.message?.includes("refresh_token_not_found") ||
      err.message?.includes("Invalid Refresh Token")
    ) {
      return null;
    }
    return null;
  }
};

/**
 * Create or update user profile
 */
export const upsertUserProfile = async (
  userId: string,
  role: UserRole = "user"
): Promise<UserProfile | null> => {
  try {
    type InsertType = Database["public"]["Tables"]["user_profiles"]["Insert"];

    // Use type assertion to work around @supabase/ssr type limitations
    const client = supabase.from("user_profiles") as unknown as {
      upsert: (
        values: InsertType,
        options?: { onConflict?: string; ignoreDuplicates?: boolean }
      ) => {
        select: () => {
          single: () => Promise<{
            data: UserProfileRow | null;
            error: Error | null;
          }>;
        };
      };
    };

    const { data, error } = await client
      .upsert(
        {
          user_id: userId,
          role,
        } as InsertType,
        {
          onConflict: "user_id",
          ignoreDuplicates: true,
        }
      )
      .select()
      .single();

    if (error) {
      return null;
    }

    if (data) {
      const row = data as UserProfileRow;
      return dbRowToUserProfile(row);
    }

    return getUserProfile(userId);
  } catch (error) {
    return null;
  }
};

/**
 * Create user profile with all details
 * Uses server API route with admin client to bypass RLS when no session exists
 */
export const createUserProfileWithDetails = async (
  userId: string,
  details: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    businessName?: string | null;
    businessAddress?: string | null;
    businessAddressComponents?: Json | null;
    businessState?: string | null;
    businessCity?: string | null;
    businessCountry?: string | null;
    businessYears?: number | null;
    businessWebsite?: string | null;
    businessEmail?: string | null;
    role?: UserRole;
  }
): Promise<UserProfile | null> => {
  const response = await fetch("/api/user-profile/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      firstName: details.firstName,
      lastName: details.lastName,
      phone: details.phone,
      businessName: details.businessName,
      businessAddress: details.businessAddress,
      businessAddressComponents: details.businessAddressComponents,
      businessState: details.businessState,
      businessCity: details.businessCity,
      businessCountry: details.businessCountry,
      businessYears: details.businessYears,
      businessWebsite: details.businessWebsite,
      businessEmail: details.businessEmail,
      role: details.role || "user",
    }),
  });

  if (!response.ok) {
    return null;
  }

  const responseData: { profile?: UserProfileRow | null } =
    await response.json();
  const { profile: serverProfile } = responseData;
  if (!serverProfile) {
    return null;
  }
  const row = serverProfile as UserProfileRow;
  const profile = dbRowToUserProfile(row);
  return profile;
};

/**
 * Update user profile details
 */
export const updateUserProfileDetails = async (
  userId: string,
  details: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    businessName?: string | null;
    businessAddress?: string | null;
    businessAddressComponents?: Record<string, unknown> | null;
    businessCity?: string | null;
    businessCountry?: string | null;
    businessYears?: number | null;
    businessWebsite?: string | null;
    businessEmail?: string | null;
    // Shipping Address
    shippingAddress?: string | null;
    shippingAddressComponents?: Json | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingCountry?: string | null;
    shippingPostalCode?: string | null;
    // Billing Address
    billingAddress?: string | null;
    billingAddressComponents?: Json | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingCountry?: string | null;
    billingPostalCode?: string | null;
    // Flags
    shippingSameAsBusiness?: boolean;
    billingSameAsBusiness?: boolean;
  }
): Promise<UserProfile | null> => {
  const updateData: Database["public"]["Tables"]["user_profiles"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

    // Personal details
    if (details.firstName !== undefined)
      updateData.first_name = details.firstName;
    if (details.lastName !== undefined) updateData.last_name = details.lastName;
    if (details.phone !== undefined) updateData.phone = details.phone;

    // Business details
    if (details.businessName !== undefined)
      updateData.business_name = details.businessName;
    if (details.businessAddress !== undefined)
      updateData.business_address = details.businessAddress;
    if (details.businessAddressComponents !== undefined)
      updateData.business_address_components =
        details.businessAddressComponents as Json;
    if (details.businessCity !== undefined)
      updateData.business_city = details.businessCity;
    if (details.businessCountry !== undefined)
      updateData.business_country = details.businessCountry;
    if (details.businessYears !== undefined)
      updateData.business_years = details.businessYears;
    if (details.businessWebsite !== undefined)
      updateData.business_website = details.businessWebsite;
    if (details.businessEmail !== undefined)
      updateData.business_email = details.businessEmail;

    // Shipping address
    if (details.shippingAddress !== undefined)
      updateData.shipping_address = details.shippingAddress;
    if (details.shippingAddressComponents !== undefined)
      updateData.shipping_address_components =
        details.shippingAddressComponents as Json;
    if (details.shippingCity !== undefined)
      updateData.shipping_city = details.shippingCity;
    if (details.shippingState !== undefined)
      updateData.shipping_state = details.shippingState;
    if (details.shippingCountry !== undefined)
      updateData.shipping_country = details.shippingCountry;
    if (details.shippingPostalCode !== undefined)
      updateData.shipping_postal_code = details.shippingPostalCode;

    // Billing address
    if (details.billingAddress !== undefined)
      updateData.billing_address = details.billingAddress;
    if (details.billingAddressComponents !== undefined)
      updateData.billing_address_components =
        details.billingAddressComponents as Json;
    if (details.billingCity !== undefined)
      updateData.billing_city = details.billingCity;
    if (details.billingState !== undefined)
      updateData.billing_state = details.billingState;
    if (details.billingCountry !== undefined)
      updateData.billing_country = details.billingCountry;
    if (details.billingPostalCode !== undefined)
      updateData.billing_postal_code = details.billingPostalCode;

    // Flags
    if (details.shippingSameAsBusiness !== undefined)
      updateData.shipping_same_as_business = details.shippingSameAsBusiness;
    if (details.billingSameAsBusiness !== undefined)
      updateData.billing_same_as_business = details.billingSameAsBusiness;

    const { data, error } = await (supabase.from(
      "user_profiles"
    ) as unknown as {
      update: (
        values: Database["public"]["Tables"]["user_profiles"]["Update"]
      ) => {
        eq: (
          column: "user_id",
          value: string
        ) => {
          select: () => {
            single: () => Promise<{
              data: UserProfileRow | null;
              error: Error | null;
            }>;
          };
        };
      };
    })
      .update(updateData)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const row = data as UserProfileRow;
    return dbRowToUserProfile(row);
};

/**
 * Get user profile with all details (alias for getUserProfile, but kept for clarity)
 */
export const getUserProfileWithDetails = async (
  userId: string
): Promise<UserProfile | null> => {
  return getUserProfile(userId);
};

/**
 * Update user profile approval status (admin only)
 * Uses API route to handle server-side admin operations
 */
export const updateUserProfileApprovalStatus = async (
  userId: string,
  status: "pending" | "approved" | "rejected"
): Promise<UserProfile | null> => {
  const response = await fetch("/api/user-profile/update-approval-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, status }),
  });

  if (!response.ok) {
    const errorData: { error?: string } = await response
      .json()
      .catch(() => ({ error: "Failed to update approval status" }));
    throw new Error(errorData.error || "Failed to update approval status");
  }

  const { profile }: { profile?: UserProfileRow | null } =
    await response.json();

  if (!profile) {
    return null;
  }

  const row = profile as UserProfileRow;
  return dbRowToUserProfile(row);
};

/**
 * Permanently delete a user from the platform (auth + profile)
 * Requires admin privileges — calls server API route
 */
export const deleteUser = async (userId: string): Promise<void> => {
  const response = await fetch("/api/users/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Failed to delete user" }));
    throw new Error(errorData.error || "Failed to delete user");
  }
};
