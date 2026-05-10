export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_customers: {
        Row: {
          blocked_at: string
          customer_phone: string
          id: string
          reason: string | null
          restaurant_id: string
        }
        Insert: {
          blocked_at?: string
          customer_phone: string
          id?: string
          reason?: string | null
          restaurant_id: string
        }
        Update: {
          blocked_at?: string
          customer_phone?: string
          id?: string
          reason?: string | null
          restaurant_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string
          product_name: string
          quantity: number
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_id: string
          product_name: string
          quantity?: number
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          deleted_at: string | null
          delivery_address: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_maps_url: string | null
          id: string
          order_type: string
          payment_method: string | null
          payment_status: string
          pix_copy_paste: string | null
          pix_paid_at: string | null
          restaurant_id: string
          status: string
          table_number: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_maps_url?: string | null
          id?: string
          order_type?: string
          payment_method?: string | null
          payment_status?: string
          pix_copy_paste?: string | null
          pix_paid_at?: string | null
          restaurant_id: string
          status?: string
          table_number?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_maps_url?: string | null
          id?: string
          order_type?: string
          payment_method?: string | null
          payment_status?: string
          pix_copy_paste?: string | null
          pix_paid_at?: string | null
          restaurant_id?: string
          status?: string
          table_number?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_promo: boolean
          name: string
          price: number
          promo_price: number | null
          restaurant_id: string
          sort_order: number
          stock_quantity: number
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_promo?: boolean
          name: string
          price?: number
          promo_price?: number | null
          restaurant_id: string
          sort_order?: number
          stock_quantity?: number
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_promo?: boolean
          name?: string
          price?: number
          promo_price?: number | null
          restaurant_id?: string
          sort_order?: number
          stock_quantity?: number
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          closed_message: string
          created_at: string
          description: string | null
          id: string
          is_blocked: boolean
          is_open: boolean
          logo_url: string | null
          name: string
          owner_id: string
          pix_city: string | null
          pix_enabled: boolean
          pix_key: string | null
          pix_key_type: string | null
          pix_password: string | null
          pix_recipient_name: string | null
          slug: string
          table_count: number
          trash_password: string | null
          updated_at: string
        }
        Insert: {
          closed_message?: string
          created_at?: string
          description?: string | null
          id?: string
          is_blocked?: boolean
          is_open?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          pix_city?: string | null
          pix_enabled?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          pix_password?: string | null
          pix_recipient_name?: string | null
          slug: string
          table_count?: number
          trash_password?: string | null
          updated_at?: string
        }
        Update: {
          closed_message?: string
          created_at?: string
          description?: string | null
          id?: string
          is_blocked?: boolean
          is_open?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          pix_city?: string | null
          pix_enabled?: boolean
          pix_key?: string | null
          pix_key_type?: string | null
          pix_password?: string | null
          pix_recipient_name?: string | null
          slug?: string
          table_count?: number
          trash_password?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_stock_for_order: { Args: { _items: Json }; Returns: undefined }
      get_available_tables: {
        Args: { _slug: string }
        Returns: {
          is_occupied: boolean
          table_number: number
        }[]
      }
      get_my_restaurant_sensitive: {
        Args: never
        Returns: {
          id: string
          pix_key: string
          pix_key_type: string
          pix_password: string
          trash_password: string
        }[]
      }
      get_order_status: {
        Args: { _order_id: string }
        Returns: {
          created_at: string
          order_type: string
          payment_status: string
          status: string
          table_number: string
          updated_at: string
        }[]
      }
      get_public_restaurant_by_slug: {
        Args: { _slug: string }
        Returns: {
          closed_message: string
          description: string
          id: string
          is_blocked: boolean
          is_open: boolean
          logo_url: string
          name: string
          pix_city: string
          pix_enabled: boolean
          pix_recipient_name: string
          slug: string
          table_count: number
        }[]
      }
      get_restaurant_pix_for_checkout: {
        Args: { _slug: string }
        Returns: {
          pix_city: string
          pix_enabled: boolean
          pix_key: string
          pix_key_type: string
          pix_recipient_name: string
        }[]
      }
      is_customer_blocked: {
        Args: { _phone: string; _restaurant_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_restaurant_owner: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      permanent_delete_order_with_password: {
        Args: { _order_id: string; _password: string }
        Returns: undefined
      }
      restore_order_stock: { Args: { _order_id: string }; Returns: undefined }
      set_pix_password: { Args: { _new_password: string }; Returns: undefined }
      update_pix_settings_with_password: {
        Args: {
          _password: string
          _pix_city: string
          _pix_enabled: boolean
          _pix_key: string
          _pix_key_type: string
          _pix_recipient_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
