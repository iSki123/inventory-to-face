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
      facebook_posting_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          facebook_post_id: string | null
          id: string
          max_retries: number
          retry_count: number
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          facebook_post_id?: string | null
          id?: string
          max_retries?: number
          retry_count?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          facebook_post_id?: string | null
          id?: string
          max_retries?: number
          retry_count?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_posting_jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          location: string | null
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
          location?: string | null
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
          location?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      us_cities: {
        Row: {
          city_name: string
          county_name: string | null
          created_at: string | null
          id: number
          latitude: number | null
          longitude: number | null
          state_id: string
        }
        Insert: {
          city_name: string
          county_name?: string | null
          created_at?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          state_id: string
        }
        Update: {
          city_name?: string
          county_name?: string | null
          created_at?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_cities_state"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "us_states"
            referencedColumns: ["state_id"]
          },
        ]
      }
      us_states: {
        Row: {
          created_at: string | null
          id: number
          state_id: string
          state_name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          state_id: string
          state_name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          state_id?: string
          state_name?: string
        }
        Relationships: []
      }
      vehicle_sources: {
        Row: {
          created_at: string
          dealership_name: string
          id: string
          last_scraped_at: string | null
          octoparse_task_id: string | null
          scraping_enabled: boolean
          scraping_frequency: number
          updated_at: string
          user_id: string
          website_url: string
        }
        Insert: {
          created_at?: string
          dealership_name: string
          id?: string
          last_scraped_at?: string | null
          octoparse_task_id?: string | null
          scraping_enabled?: boolean
          scraping_frequency?: number
          updated_at?: string
          user_id: string
          website_url: string
        }
        Update: {
          created_at?: string
          dealership_name?: string
          id?: string
          last_scraped_at?: string | null
          octoparse_task_id?: string | null
          scraping_enabled?: boolean
          scraping_frequency?: number
          updated_at?: string
          user_id?: string
          website_url?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          ai_description: string | null
          ai_image_generation_completed_at: string | null
          ai_image_generation_requested_at: string | null
          ai_images_generated: boolean | null
          body_style_nhtsa: string | null
          condition: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          drivetrain: string | null
          drivetrain_nhtsa: string | null
          engine: string | null
          engine_nhtsa: string | null
          exterior_color: string | null
          exterior_color_standardized: string | null
          facebook_post_id: string | null
          facebook_post_status: string | null
          features: string[] | null
          fuel_type: string | null
          fuel_type_nhtsa: string | null
          id: string
          images: string[] | null
          interior_color: string | null
          interior_color_standardized: string | null
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
          transmission_nhtsa: string | null
          trim: string | null
          updated_at: string
          user_id: string
          vehicle_type_nhtsa: string | null
          view_count: number | null
          vin: string | null
          vin_decoded_at: string | null
          year: number
        }
        Insert: {
          ai_description?: string | null
          ai_image_generation_completed_at?: string | null
          ai_image_generation_requested_at?: string | null
          ai_images_generated?: boolean | null
          body_style_nhtsa?: string | null
          condition?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          drivetrain?: string | null
          drivetrain_nhtsa?: string | null
          engine?: string | null
          engine_nhtsa?: string | null
          exterior_color?: string | null
          exterior_color_standardized?: string | null
          facebook_post_id?: string | null
          facebook_post_status?: string | null
          features?: string[] | null
          fuel_type?: string | null
          fuel_type_nhtsa?: string | null
          id?: string
          images?: string[] | null
          interior_color?: string | null
          interior_color_standardized?: string | null
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
          transmission_nhtsa?: string | null
          trim?: string | null
          updated_at?: string
          user_id: string
          vehicle_type_nhtsa?: string | null
          view_count?: number | null
          vin?: string | null
          vin_decoded_at?: string | null
          year: number
        }
        Update: {
          ai_description?: string | null
          ai_image_generation_completed_at?: string | null
          ai_image_generation_requested_at?: string | null
          ai_images_generated?: boolean | null
          body_style_nhtsa?: string | null
          condition?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          drivetrain?: string | null
          drivetrain_nhtsa?: string | null
          engine?: string | null
          engine_nhtsa?: string | null
          exterior_color?: string | null
          exterior_color_standardized?: string | null
          facebook_post_id?: string | null
          facebook_post_status?: string | null
          features?: string[] | null
          fuel_type?: string | null
          fuel_type_nhtsa?: string | null
          id?: string
          images?: string[] | null
          interior_color?: string | null
          interior_color_standardized?: string | null
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
          transmission_nhtsa?: string | null
          trim?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type_nhtsa?: string | null
          view_count?: number | null
          vin?: string | null
          vin_decoded_at?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      search_us_cities: {
        Args: { search_term: string }
        Returns: {
          name: string
          state: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "sales_rep" | "admin"
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
      app_role: ["owner", "manager", "sales_rep", "admin"],
    },
  },
} as const
