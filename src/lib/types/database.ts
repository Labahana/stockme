export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          shop_domain: string;
          plan_tier: "starter" | "growth" | "pro";
          billing_status: "trial" | "active" | "cancelled" | "frozen";
          shopify_shop_id: number | null;
          email: string | null;
          timezone: string | null;
          currency: string | null;
          last_synced_at: string | null;
          low_stock_digest_enabled?: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stores"]["Row"]> & {
          shop_domain: string;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Row"]>;
      };
      shopify_sessions: {
        Row: {
          id: string;
          shop: string;
          state: string;
          is_online: boolean;
          scope: string | null;
          expires: string | null;
          access_token: string | null;
          refresh_token: string | null;
          refresh_token_expires: string | null;
          online_access_info: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["shopify_sessions"]["Row"]> & {
          id: string;
          shop: string;
        };
        Update: Partial<Database["public"]["Tables"]["shopify_sessions"]["Row"]>;
      };
      locations: {
        Row: {
          id: string;
          shop_id: string;
          shopify_location_id: number;
          name: string;
          active: boolean;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["locations"]["Row"]> & {
          shop_id: string;
          shopify_location_id: number;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["locations"]["Row"]>;
      };
      products: {
        Row: {
          id: string;
          shop_id: string;
          shopify_product_id: number;
          title: string;
          vendor: string | null;
          product_type: string | null;
          status: string;
          tags: string[];
          image_url: string | null;
          is_bundle: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          shop_id: string;
          shopify_product_id: number;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
      };
      variants: {
        Row: {
          id: string;
          shop_id: string;
          product_id: string;
          shopify_variant_id: number;
          shopify_inventory_item_id: number | null;
          title: string;
          sku: string | null;
          barcode: string | null;
          price: number | null;
          cost: number | null;
          tracked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["variants"]["Row"]> & {
          shop_id: string;
          product_id: string;
          shopify_variant_id: number;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["variants"]["Row"]>;
      };
      inventory_levels: {
        Row: {
          id: string;
          shop_id: string;
          variant_id: string;
          location_id: string;
          available: number;
          committed: number;
          on_hand: number;
          shopify_inventory_level_id: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["inventory_levels"]["Row"]> & {
          shop_id: string;
          variant_id: string;
          location_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_levels"]["Row"]>;
      };
      suppliers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          lead_time_days: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["suppliers"]["Row"]> & {
          shop_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Row"]>;
      };
      purchase_orders: {
        Row: {
          id: string;
          shop_id: string;
          supplier_id: string;
          location_id: string;
          po_number: string;
          status: "draft" | "sent" | "partially_received" | "received" | "cancelled";
          forecast_method: string | null;
          forecast_params: Json | null;
          notes: string | null;
          expected_at: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["purchase_orders"]["Row"]> & {
          shop_id: string;
          supplier_id: string;
          location_id: string;
          po_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Row"]>;
      };
      sync_runs: {
        Row: {
          id: string;
          shop_id: string;
          sync_type: "full" | "incremental" | "webhook" | "force";
          status: "running" | "completed" | "failed";
          started_at: string;
          completed_at: string | null;
          items_processed: number;
          error_message: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["sync_runs"]["Row"]> & {
          shop_id: string;
          sync_type: Database["public"]["Tables"]["sync_runs"]["Row"]["sync_type"];
          status: Database["public"]["Tables"]["sync_runs"]["Row"]["status"];
        };
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export type Store = Database["public"]["Tables"]["stores"]["Row"];
