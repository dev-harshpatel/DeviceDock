// This file will be auto-generated, but for now we'll define the types manually

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stock_requests: {
        Row: {
          id: string;
          user_id: string;
          inventory_item_id: string;
          quantity: number;
          note: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          inventory_item_id: string;
          quantity?: number;
          note?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quantity?: number;
          note?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          role: "user" | "admin";
          approval_status: "pending" | "approved" | "rejected";
          approval_status_updated_at: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          business_name: string | null;
          business_address: string | null;
          business_address_components: Json | null;
          business_state: string | null;
          business_city: string | null;
          business_country: string | null;
          business_years: number | null;
          business_website: string | null;
          business_email: string | null;
          cart_items: Json | null;
          wishlist_items: Json | null;
          // Shipping Address
          shipping_address: string | null;
          shipping_address_components: Json | null;
          shipping_city: string | null;
          shipping_state: string | null;
          shipping_country: string | null;
          shipping_postal_code: string | null;
          // Billing Address
          billing_address: string | null;
          billing_address_components: Json | null;
          billing_city: string | null;
          billing_state: string | null;
          billing_country: string | null;
          billing_postal_code: string | null;
          // Flags
          shipping_same_as_business: boolean;
          billing_same_as_business: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: "user" | "admin";
          approval_status?: "pending" | "approved" | "rejected";
          approval_status_updated_at?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          business_name?: string | null;
          business_address?: string | null;
          business_address_components?: Json | null;
          business_state?: string | null;
          business_city?: string | null;
          business_country?: string | null;
          business_years?: number | null;
          business_website?: string | null;
          business_email?: string | null;
          cart_items?: Json | null;
          wishlist_items?: Json | null;
          // Shipping Address
          shipping_address?: string | null;
          shipping_address_components?: Json | null;
          shipping_city?: string | null;
          shipping_state?: string | null;
          shipping_country?: string | null;
          shipping_postal_code?: string | null;
          // Billing Address
          billing_address?: string | null;
          billing_address_components?: Json | null;
          billing_city?: string | null;
          billing_state?: string | null;
          billing_country?: string | null;
          billing_postal_code?: string | null;
          // Flags
          shipping_same_as_business?: boolean;
          billing_same_as_business?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: "user" | "admin";
          approval_status?: "pending" | "approved" | "rejected";
          approval_status_updated_at?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          business_name?: string | null;
          business_address?: string | null;
          business_address_components?: Json | null;
          business_state?: string | null;
          business_city?: string | null;
          business_country?: string | null;
          business_years?: number | null;
          business_website?: string | null;
          business_email?: string | null;
          cart_items?: Json | null;
          wishlist_items?: Json | null;
          // Shipping Address
          shipping_address?: string | null;
          shipping_address_components?: Json | null;
          shipping_city?: string | null;
          shipping_state?: string | null;
          shipping_country?: string | null;
          shipping_postal_code?: string | null;
          // Billing Address
          billing_address?: string | null;
          billing_address_components?: Json | null;
          billing_city?: string | null;
          billing_state?: string | null;
          billing_country?: string | null;
          billing_postal_code?: string | null;
          // Flags
          shipping_same_as_business?: boolean;
          billing_same_as_business?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: 'active' | 'inactive';
          timezone: string;
          currency: string;
          settings_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: 'active' | 'inactive';
          timezone?: string;
          currency?: string;
          settings_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          status?: 'active' | 'inactive';
          timezone?: string;
          currency?: string;
          settings_json?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_users: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          role: 'owner' | 'manager' | 'inventory_admin' | 'analyst';
          status: 'active' | 'invited' | 'suspended';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          role: 'owner' | 'manager' | 'inventory_admin' | 'analyst';
          status?: 'active' | 'invited' | 'suspended';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: 'owner' | 'manager' | 'inventory_admin' | 'analyst';
          status?: 'active' | 'invited' | 'suspended';
          updated_at?: string;
        };
        Relationships: [];
      };
      company_registrations: {
        Row: {
          id: string;
          company_slug: string;
          company_name: string;
          owner_email: string;
          owner_first_name: string;
          owner_last_name: string;
          owner_phone_code: string;
          owner_phone: string;
          years_in_business: number | null;
          company_website: string | null;
          company_email: string | null;
          company_address: string | null;
          country: string;
          province: string;
          city: string;
          timezone: string;
          currency: string;
          user_id: string | null;
          token_hash: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_slug: string;
          company_name: string;
          owner_email: string;
          owner_first_name?: string;
          owner_last_name?: string;
          owner_phone_code?: string;
          owner_phone?: string;
          years_in_business?: number | null;
          company_website?: string | null;
          company_email?: string | null;
          company_address?: string | null;
          country?: string;
          province?: string;
          city?: string;
          timezone?: string;
          currency?: string;
          user_id?: string | null;
          token_hash: string;
          expires_at: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          consumed_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      company_invitations: {
        Row: {
          id: string;
          company_id: string;
          company_slug: string;
          invitee_email: string;
          role_to_assign: 'owner' | 'manager' | 'inventory_admin' | 'analyst';
          token_hash: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          company_slug: string;
          invitee_email: string;
          role_to_assign: 'owner' | 'manager' | 'inventory_admin' | 'analyst';
          token_hash: string;
          expires_at: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          consumed_at?: string | null;
        };
        Relationships: [];
      };
      platform_super_admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      platform_audit_logs: {
        Row: {
          id: string;
          actor_user_id: string;
          actor_email: string | null;
          action: string;
          resource_type: string;
          resource_id: string;
          company_id: string | null;
          metadata_json: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id: string;
          actor_email?: string | null;
          action: string;
          resource_type: string;
          resource_id: string;
          company_id?: string | null;
          metadata_json?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          actor_email?: string | null;
          action?: string;
          resource_type?: string;
          resource_id?: string;
          company_id?: string | null;
          metadata_json?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          id: string;
          company_id: string;
          device_name: string;
          brand: string;
          grade: string;
          storage: string;
          quantity: number;
          price_per_unit: number;
          purchase_price: number | null;
          hst: number | null;
          selling_price: number | null;
          last_updated: string;
          price_change: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          device_name: string;
          brand: string;
          grade: string;
          storage: string;
          quantity?: number;
          price_per_unit: number;
          purchase_price?: number | null;
          hst?: number | null;
          selling_price?: number | null;
          last_updated: string;
          price_change?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_name?: string;
          brand?: string;
          grade?: string;
          storage?: string;
          quantity?: number;
          price_per_unit?: number;
          purchase_price?: number | null;
          hst?: number | null;
          selling_price?: number | null;
          last_updated?: string;
          price_change?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wishes: {
        Row: {
          id: string;
          user_id: string;
          model: string;
          grade: string;
          storage: string;
          qty_wanted: number;
          max_price_per_unit: number | null;
          status: string;
          offer_price_per_unit: number | null;
          offer_qty: number | null;
          offer_inventory_item_id: string | null;
          offer_created_at: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          model: string;
          grade: string;
          storage: string;
          qty_wanted: number;
          max_price_per_unit?: number | null;
          status?: string;
          offer_price_per_unit?: number | null;
          offer_qty?: number | null;
          offer_inventory_item_id?: string | null;
          offer_created_at?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          model?: string;
          grade?: string;
          storage?: string;
          qty_wanted?: number;
          max_price_per_unit?: number | null;
          status?: string;
          offer_price_per_unit?: number | null;
          offer_qty?: number | null;
          offer_inventory_item_id?: string | null;
          offer_created_at?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          items: Json;
          subtotal: number | null;
          tax_rate: number | null;
          tax_amount: number | null;
          total_price: number;
          status: string;
          created_at: string;
          updated_at: string;
          rejection_reason?: string | null;
          rejection_comment?: string | null;
          invoice_number?: string | null;
          invoice_date?: string | null;
          po_number?: string | null;
          payment_terms?: string | null;
          due_date?: string | null;
          hst_number?: string | null;
          invoice_notes?: string | null;
          invoice_terms?: string | null;
          invoice_confirmed?: boolean | null;
          invoice_confirmed_at?: string | null;
          discount_amount?: number | null;
          discount_type?: string | null;
          shipping_amount?: number | null;
          shipping_address?: string | null;
          billing_address?: string | null;
          imei_numbers?: Json | null;
          is_manual_sale?: boolean | null;
          manual_customer_name?: string | null;
          manual_customer_email?: string | null;
          manual_customer_phone?: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          items: Json;
          subtotal?: number | null;
          tax_rate?: number | null;
          tax_amount?: number | null;
          total_price: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
          rejection_reason?: string | null;
          rejection_comment?: string | null;
          invoice_number?: string | null;
          invoice_date?: string | null;
          po_number?: string | null;
          payment_terms?: string | null;
          due_date?: string | null;
          hst_number?: string | null;
          invoice_notes?: string | null;
          invoice_terms?: string | null;
          invoice_confirmed?: boolean | null;
          invoice_confirmed_at?: string | null;
          discount_amount?: number | null;
          discount_type?: string | null;
          shipping_amount?: number | null;
          shipping_address?: string | null;
          billing_address?: string | null;
          imei_numbers?: Json | null;
          is_manual_sale?: boolean | null;
          manual_customer_name?: string | null;
          manual_customer_email?: string | null;
          manual_customer_phone?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          items?: Json;
          subtotal?: number | null;
          tax_rate?: number | null;
          tax_amount?: number | null;
          total_price?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
          rejection_reason?: string | null;
          rejection_comment?: string | null;
          invoice_number?: string | null;
          invoice_date?: string | null;
          po_number?: string | null;
          payment_terms?: string | null;
          due_date?: string | null;
          hst_number?: string | null;
          invoice_notes?: string | null;
          invoice_terms?: string | null;
          invoice_confirmed?: boolean | null;
          invoice_confirmed_at?: string | null;
          discount_amount?: number | null;
          discount_type?: string | null;
          shipping_amount?: number | null;
          shipping_address?: string | null;
          billing_address?: string | null;
          imei_numbers?: Json | null;
          is_manual_sale?: boolean | null;
          manual_customer_name?: string | null;
          manual_customer_email?: string | null;
          manual_customer_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
