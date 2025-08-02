export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      lead_messages: {
        Row: {
          ai_model: string | null
          ai_prompt: string | null
          attachments: string[] | null
          created_at: string
          generation_cost: number | null
          id: string
          is_ai_generated: boolean | null
          is_read: boolean | null
          is_sent: boolean | null
          lead_id: string
          message_content: string
          message_type: string | null
          sender_type: string
          sent_at: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_prompt?: string | null
          attachments?: string[] | null
          created_at?: string
          generation_cost?: number | null
          id?: string
          is_ai_generated?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          lead_id: string
          message_content: string
          message_type?: string | null
          sender_type: string
          sent_at?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_prompt?: string | null
          attachments?: string[] | null
          created_at?: string
          generation_cost?: number | null
          id?: string
          is_ai_generated?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          lead_id?: string
          message_content?: string
          message_type?: string | null
          sender_type?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          estimated_value: number | null
          expected_close_date: string | null
          facebook_post_id: string | null
          facebook_thread_id: string | null
          id: string
          initial_message: string
          is_qualified: boolean | null
          last_contact_at: string | null
          lead_score: number | null
          next_follow_up_at: string | null
          notes: string | null
          priority: string | null
          response_count: number | null
          source: string | null
          status: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          facebook_post_id?: string | null
          facebook_thread_id?: string | null
          id?: string
          initial_message: string
          is_qualified?: boolean | null
          last_contact_at?: string | null
          lead_score?: number | null
          next_follow_up_at?: string | null
          notes?: string | null
          priority?: string | null
          response_count?: number | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          facebook_post_id?: string | null
          facebook_thread_id?: string | null
          id?: string
          initial_message?: string
          is_qualified?: boolean | null
          last_contact_at?: string | null
          lead_score?: number | null
          next_follow_up_at?: string | null
          notes?: string | null
          priority?: string | null
          response_count?: number | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          dealership_name: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          dealership_name?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          dealership_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          condition: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          drivetrain: string | null
          engine: string | null
          exterior_color: string | null
          facebook_post_id: string | null
          facebook_post_status: string | null
          features: string[] | null
          fuel_type: string | null
          id: string
          images: string[] | null
          interior_color: string | null
          is_featured: boolean | null
          last_posted_at: string | null
          lead_count: number | null
          location: string | null
          make: string
          mileage: number | null
          model: string
          original_price: number | null
          price: number
          status: string | null
          transmission: string | null
          trim: string | null
          updated_at: string
          user_id: string
          view_count: number | null
          vin: string | null
          year: number
        }
        Insert: {
          condition?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          drivetrain?: string | null
          engine?: string | null
          exterior_color?: string | null
          facebook_post_id?: string | null
          facebook_post_status?: string | null
          features?: string[] | null
          fuel_type?: string | null
          id?: string
          images?: string[] | null
          interior_color?: string | null
          is_featured?: boolean | null
          last_posted_at?: string | null
          lead_count?: number | null
          location?: string | null
          make: string
          mileage?: number | null
          model: string
          original_price?: number | null
          price: number
          status?: string | null
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          user_id: string
          view_count?: number | null
          vin?: string | null
          year: number
        }
        Update: {
          condition?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          drivetrain?: string | null
          engine?: string | null
          exterior_color?: string | null
          facebook_post_id?: string | null
          facebook_post_status?: string | null
          features?: string[] | null
          fuel_type?: string | null
          id?: string
          images?: string[] | null
          interior_color?: string | null
          is_featured?: boolean | null
          last_posted_at?: string | null
          lead_count?: number | null
          location?: string | null
          make?: string
          mileage?: number | null
          model?: string
          original_price?: number | null
          price?: number
          status?: string | null
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number | null
          vin?: string | null
          year?: number
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
      app_role: "owner" | "manager" | "sales_rep"
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
    Enums: {
      app_role: ["owner", "manager", "sales_rep"],
    },
  },
} as const
