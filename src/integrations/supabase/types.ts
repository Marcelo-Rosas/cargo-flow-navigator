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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          nfe_key: string | null
          order_id: string | null
          quote_id: string | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          uploaded_by: string
          validation_status: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          nfe_key?: string | null
          order_id?: string | null
          quote_id?: string | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by: string
          validation_status?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          nfe_key?: string | null
          order_id?: string | null
          quote_id?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by?: string
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          address: string | null
          birth_date: string | null
          city: string | null
          cnh: string | null
          cnh_category: string | null
          cnh_validity: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          father_name: string | null
          has_accident_history: boolean
          has_robbery_history: boolean
          id: string
          mother_name: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          phone_secondary: string | null
          rg: string | null
          rg_emitter: string | null
          state: string | null
          transported_before: boolean
          transported_details: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          birth_date?: string | null
          city?: string | null
          cnh?: string | null
          cnh_category?: string | null
          cnh_validity?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          father_name?: string | null
          has_accident_history?: boolean
          has_robbery_history?: boolean
          id?: string
          mother_name?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          phone_secondary?: string | null
          rg?: string | null
          rg_emitter?: string | null
          state?: string | null
          transported_before?: boolean
          transported_details?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          birth_date?: string | null
          city?: string | null
          cnh?: string | null
          cnh_category?: string | null
          cnh_validity?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          father_name?: string | null
          has_accident_history?: boolean
          has_robbery_history?: boolean
          id?: string
          mother_name?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          phone_secondary?: string | null
          rg?: string | null
          rg_emitter?: string | null
          state?: string | null
          transported_before?: boolean
          transported_details?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrences: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          order_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["occurrence_severity"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          order_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["occurrence_severity"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          order_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["occurrence_severity"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string
          destination: string
          driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          eta: string | null
          has_cte: boolean
          has_nfe: boolean
          has_pod: boolean
          id: string
          notes: string | null
          origin: string
          os_number: string
          quote_id: string | null
          stage: Database["public"]["Enums"]["order_stage"]
          ui_last_tab: string | null
          updated_at: string
          value: number
          vehicle_plate: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by: string
          destination: string
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          eta?: string | null
          has_cte?: boolean
          has_nfe?: boolean
          has_pod?: boolean
          id?: string
          notes?: string | null
          origin: string
          os_number: string
          quote_id?: string | null
          stage?: Database["public"]["Enums"]["order_stage"]
          ui_last_tab?: string | null
          updated_at?: string
          value?: number
          vehicle_plate?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          destination?: string
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          eta?: string | null
          has_cte?: boolean
          has_nfe?: boolean
          has_pod?: boolean
          id?: string
          notes?: string | null
          origin?: string
          os_number?: string
          quote_id?: string | null
          stage?: Database["public"]["Enums"]["order_stage"]
          ui_last_tab?: string | null
          updated_at?: string
          value?: number
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          rg: string | null
          rg_emitter: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          rg?: string | null
          rg_emitter?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          rg?: string | null
          rg_emitter?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          assigned_to: string | null
          cargo_type: string | null
          client_email: string | null
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string
          destination: string
          destination_cep: string | null
          freight_type: string
          id: string
          notes: string | null
          origin: string
          origin_cep: string | null
          shipper_email: string | null
          shipper_id: string | null
          shipper_name: string | null
          stage: Database["public"]["Enums"]["quote_stage"]
          tags: string[] | null
          updated_at: string
          validity_date: string | null
          value: number
          volume: number | null
          weight: number | null
        }
        Insert: {
          assigned_to?: string | null
          cargo_type?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by: string
          destination: string
          destination_cep?: string | null
          freight_type?: string
          id?: string
          notes?: string | null
          origin: string
          origin_cep?: string | null
          shipper_email?: string | null
          shipper_id?: string | null
          shipper_name?: string | null
          stage?: Database["public"]["Enums"]["quote_stage"]
          tags?: string[] | null
          updated_at?: string
          validity_date?: string | null
          value?: number
          volume?: number | null
          weight?: number | null
        }
        Update: {
          assigned_to?: string | null
          cargo_type?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          destination?: string
          destination_cep?: string | null
          freight_type?: string
          id?: string
          notes?: string | null
          origin?: string
          origin_cep?: string | null
          shipper_email?: string | null
          shipper_id?: string | null
          shipper_name?: string | null
          stage?: Database["public"]["Enums"]["quote_stage"]
          tags?: string[] | null
          updated_at?: string
          validity_date?: string | null
          value?: number
          volume?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      shippers: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trailers: {
        Row: {
          active: boolean
          brand: string | null
          capacity_kg: number | null
          chassis: string | null
          city: string | null
          color: string | null
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          model: string | null
          notes: string | null
          plate: string
          renavam: string | null
          state: string | null
          trailer_type: string | null
          updated_at: string
          year_manufacture: number | null
          year_model: number | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          capacity_kg?: number | null
          chassis?: string | null
          city?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          plate: string
          renavam?: string | null
          state?: string | null
          trailer_type?: string | null
          updated_at?: string
          year_manufacture?: number | null
          year_model?: number | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          capacity_kg?: number | null
          chassis?: string | null
          city?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          plate?: string
          renavam?: string | null
          state?: string | null
          trailer_type?: string | null
          updated_at?: string
          year_manufacture?: number | null
          year_model?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trailers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          brand: string | null
          capacity_kg: number | null
          chassis: string | null
          city: string | null
          color: string | null
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          model: string | null
          notes: string | null
          plate: string
          renavam: string | null
          state: string | null
          updated_at: string
          vehicle_type: string | null
          year_manufacture: number | null
          year_model: number | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          capacity_kg?: number | null
          chassis?: string | null
          city?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          plate: string
          renavam?: string | null
          state?: string | null
          updated_at?: string
          vehicle_type?: string | null
          year_manufacture?: number | null
          year_model?: number | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          capacity_kg?: number | null
          chassis?: string | null
          city?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          plate?: string
          renavam?: string | null
          state?: string | null
          updated_at?: string
          vehicle_type?: string | null
          year_manufacture?: number | null
          year_model?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_os_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "comercial" | "operacao" | "fiscal" | "leitura"
      document_type: "nfe" | "cte" | "pod" | "outros"
      occurrence_severity: "baixa" | "media" | "alta" | "critica"
      order_stage:
        | "ordem_criada"
        | "busca_motorista"
        | "documentacao"
        | "coleta_realizada"
        | "em_transito"
        | "entregue"
      quote_stage:
        | "novo_pedido"
        | "qualificacao"
        | "precificacao"
        | "enviado"
        | "negociacao"
        | "ganho"
        | "perdido"
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
      app_role: ["admin", "comercial", "operacao", "fiscal", "leitura"],
      document_type: ["nfe", "cte", "pod", "outros"],
      occurrence_severity: ["baixa", "media", "alta", "critica"],
      order_stage: [
        "ordem_criada",
        "busca_motorista",
        "documentacao",
        "coleta_realizada",
        "em_transito",
        "entregue",
      ],
      quote_stage: [
        "novo_pedido",
        "qualificacao",
        "precificacao",
        "enviado",
        "negociacao",
        "ganho",
        "perdido",
      ],
    },
  },
} as const
