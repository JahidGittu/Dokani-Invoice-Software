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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      company_settings: {
        Row: {
          address: string
          created_at: string
          dark_mode: boolean
          email: string
          id: string
          inv_counter: number
          inv_prefix: string
          low_stock_threshold: number
          name: string
          phone: string
          updated_at: string
          user_id: string
          user_name: string
          user_role: string
        }
        Insert: {
          address?: string
          created_at?: string
          dark_mode?: boolean
          email?: string
          id?: string
          inv_counter?: number
          inv_prefix?: string
          low_stock_threshold?: number
          name?: string
          phone?: string
          updated_at?: string
          user_id: string
          user_name?: string
          user_role?: string
        }
        Update: {
          address?: string
          created_at?: string
          dark_mode?: boolean
          email?: string
          id?: string
          inv_counter?: number
          inv_prefix?: string
          low_stock_threshold?: number
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string
          user_name?: string
          user_role?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string
          color: string
          created_at: string
          id: string
          initials: string
          last_order: string | null
          name: string
          phone: string
          total_due: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          color?: string
          created_at?: string
          id?: string
          initials?: string
          last_order?: string | null
          name: string
          phone?: string
          total_due?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          color?: string
          created_at?: string
          id?: string
          initials?: string
          last_order?: string | null
          name?: string
          phone?: string
          total_due?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      due_payments: {
        Row: {
          amount: number
          created_at: string
          customer_or_supplier: string
          id: string
          note: string
          payment_date: string
          payment_method: string
          reference_id: string
          reference_type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_or_supplier?: string
          id?: string
          note?: string
          payment_date?: string
          payment_method?: string
          reference_id: string
          reference_type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_or_supplier?: string
          id?: string
          note?: string
          payment_date?: string
          payment_method?: string
          reference_id?: string
          reference_type?: string
          user_id?: string
        }
        Relationships: []
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          option_type: string
          option_value: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_type: string
          option_value: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_type?: string
          option_value?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          batch: string
          brand: string
          buy_rate: number
          category: string
          created_at: string
          finish: string
          id: string
          name: string
          pieces_per_box: number
          price_per_box: number
          size: string
          sqft_per_box: number
          stock: number
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          batch?: string
          brand?: string
          buy_rate?: number
          category?: string
          created_at?: string
          finish?: string
          id?: string
          name: string
          pieces_per_box?: number
          price_per_box?: number
          size?: string
          sqft_per_box?: number
          stock?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          batch?: string
          brand?: string
          buy_rate?: number
          category?: string
          created_at?: string
          finish?: string
          id?: string
          name?: string
          pieces_per_box?: number
          price_per_box?: number
          size?: string
          sqft_per_box?: number
          stock?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          barcode: string
          buy_rate: number
          carton: number
          id: string
          name: string
          piece: number
          product_id: string
          purchase_id: string
          sqft_qty: number
          sub_total: number
        }
        Insert: {
          barcode?: string
          buy_rate?: number
          carton?: number
          id?: string
          name?: string
          piece?: number
          product_id?: string
          purchase_id: string
          sqft_qty?: number
          sub_total?: number
        }
        Update: {
          barcode?: string
          buy_rate?: number
          carton?: number
          id?: string
          name?: string
          piece?: number
          product_id?: string
          purchase_id?: string
          sqft_qty?: number
          sub_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          delivery: number
          discount: number
          due: number
          id: string
          invoice: string
          paid: number
          payable: number
          purchase_date: string
          remark: string
          supplier_name: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery?: number
          discount?: number
          due?: number
          id?: string
          invoice?: string
          paid?: number
          payable?: number
          purchase_date?: string
          remark?: string
          supplier_name?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery?: number
          discount?: number
          due?: number
          id?: string
          invoice?: string
          paid?: number
          payable?: number
          purchase_date?: string
          remark?: string
          supplier_name?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          carton: number
          category: string
          detail: string
          id: string
          item_type: string
          name: string
          piece: number
          price: number
          product_id: string
          qty: number
          sale_id: string
          sqft_qty: number
        }
        Insert: {
          carton?: number
          category?: string
          detail?: string
          id?: string
          item_type?: string
          name: string
          piece?: number
          price?: number
          product_id?: string
          qty?: number
          sale_id: string
          sqft_qty?: number
        }
        Update: {
          carton?: number
          category?: string
          detail?: string
          id?: string
          item_type?: string
          name?: string
          piece?: number
          price?: number
          product_id?: string
          qty?: number
          sale_id?: string
          sqft_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          address: string | null
          balance: number
          created_at: string
          customer: string
          customer_type: string
          delivery: number
          discount: number
          discount_type: string
          due: number
          id: string
          invoice: string
          labour: number
          less_amount: number
          notes: string | null
          paid: number
          payment_method: string
          phone: string
          previous_dues: number
          return_amount: number
          sale_date: string
          sale_time: string
          sold_by: string
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          balance?: number
          created_at?: string
          customer?: string
          customer_type?: string
          delivery?: number
          discount?: number
          discount_type?: string
          due?: number
          id?: string
          invoice: string
          labour?: number
          less_amount?: number
          notes?: string | null
          paid?: number
          payment_method?: string
          phone?: string
          previous_dues?: number
          return_amount?: number
          sale_date?: string
          sale_time?: string
          sold_by?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          balance?: number
          created_at?: string
          customer?: string
          customer_type?: string
          delivery?: number
          discount?: number
          discount_type?: string
          due?: number
          id?: string
          invoice?: string
          labour?: number
          less_amount?: number
          notes?: string | null
          paid?: number
          payment_method?: string
          phone?: string
          previous_dues?: number
          return_amount?: number
          sale_date?: string
          sale_time?: string
          sold_by?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string
          created_at: string
          id: string
          name: string
          phone: string
          total_due: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          created_at?: string
          id?: string
          name: string
          phone?: string
          total_due?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
          total_due?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
