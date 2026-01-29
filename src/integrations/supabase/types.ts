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
      lab_results: {
        Row: {
          collected_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          notified_at: string | null
          patient_age: number | null
          patient_id: string | null
          patient_name: string | null
          report_date: string | null
          status: string | null
          technician: string | null
          test_date: string | null
          tests: Json | null
        }
        Insert: {
          collected_at?: string | null
          created_at?: string | null
          id: string
          notes?: string | null
          notified_at?: string | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name?: string | null
          report_date?: string | null
          status?: string | null
          technician?: string | null
          test_date?: string | null
          tests?: Json | null
        }
        Update: {
          collected_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name?: string | null
          report_date?: string | null
          status?: string | null
          technician?: string | null
          test_date?: string | null
          tests?: Json | null
        }
        Relationships: []
      }
      patient_services: {
        Row: {
          created_at: string | null
          grand_total: number | null
          id: string
          patient_id: string
          services: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          grand_total?: number | null
          id: string
          patient_id: string
          services?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          grand_total?: number | null
          id?: string
          patient_id?: string
          services?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          age: number | null
          created_at: string | null
          gender: string | null
          id: string
          name: string
          phone: string | null
          registered_by: string | null
          registered_by_role: string | null
          symptoms: string | null
          visit_date: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          created_at?: string | null
          gender?: string | null
          id: string
          name: string
          phone?: string | null
          registered_by?: string | null
          registered_by_role?: string | null
          symptoms?: string | null
          visit_date?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          created_at?: string | null
          gender?: string | null
          id?: string
          name?: string
          phone?: string | null
          registered_by?: string | null
          registered_by_role?: string | null
          symptoms?: string | null
          visit_date?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          consultation_fee: number | null
          created_at: string | null
          id: string
          lab_fee: number | null
          medicine_fee: number | null
          medicines: Json | null
          patient_id: string | null
          patient_name: string | null
          payment_mode: string | null
          total_amount: number | null
        }
        Insert: {
          consultation_fee?: number | null
          created_at?: string | null
          id: string
          lab_fee?: number | null
          medicine_fee?: number | null
          medicines?: Json | null
          patient_id?: string | null
          patient_name?: string | null
          payment_mode?: string | null
          total_amount?: number | null
        }
        Update: {
          consultation_fee?: number | null
          created_at?: string | null
          id?: string
          lab_fee?: number | null
          medicine_fee?: number | null
          medicines?: Json | null
          patient_id?: string | null
          patient_name?: string | null
          payment_mode?: string | null
          total_amount?: number | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          created_at: string | null
          diagnosis: string | null
          doctor_notes: string | null
          follow_up_date: string | null
          generated_text: string | null
          id: string
          lab_tests: Json | null
          medicines: Json | null
          patient_age: number | null
          patient_id: string | null
          patient_name: string | null
          precautions: string | null
        }
        Insert: {
          created_at?: string | null
          diagnosis?: string | null
          doctor_notes?: string | null
          follow_up_date?: string | null
          generated_text?: string | null
          id: string
          lab_tests?: Json | null
          medicines?: Json | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name?: string | null
          precautions?: string | null
        }
        Update: {
          created_at?: string | null
          diagnosis?: string | null
          doctor_notes?: string | null
          follow_up_date?: string | null
          generated_text?: string | null
          id?: string
          lab_tests?: Json | null
          medicines?: Json | null
          patient_age?: number | null
          patient_id?: string | null
          patient_name?: string | null
          precautions?: string | null
        }
        Relationships: []
      }
      stock: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          low_stock_threshold: number | null
          name: string
          price: number | null
          quantity: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id: string
          low_stock_threshold?: number | null
          name: string
          price?: number | null
          quantity?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          low_stock_threshold?: number | null
          name?: string
          price?: number | null
          quantity?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          password: string
          role: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id: string
          is_active?: boolean | null
          name: string
          password: string
          role?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          password?: string
          role?: string | null
          username?: string
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
