export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  public: {
    Tables: {
      antt_floor_rates: {
        Row: {
          axes_count: number;
          cargo_type: string;
          cc: number;
          ccd: number;
          created_at: string;
          created_by: string | null;
          id: string;
          operation_table: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          axes_count: number;
          cargo_type: string;
          cc: number;
          ccd: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          operation_table: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          axes_count?: number;
          cargo_type?: string;
          cc?: number;
          ccd?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          operation_table?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          new_values: Json | null;
          old_values: Json | null;
          record_id: string;
          table_name: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          record_id: string;
          table_name: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          record_id?: string;
          table_name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          city: string | null;
          cnpj: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          state: string | null;
          updated_at: string;
          user_id: string;
          zip_code: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
          user_id?: string;
          zip_code?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
          user_id?: string;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'clients_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      conditional_fees: {
        Row: {
          active: boolean;
          applies_to: string;
          code: string;
          conditions: Json | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          fee_type: string;
          fee_value: number;
          id: string;
          max_value: number | null;
          min_value: number | null;
          name: string;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          active?: boolean;
          applies_to?: string;
          code: string;
          conditions?: Json | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fee_type: string;
          fee_value: number;
          id?: string;
          max_value?: number | null;
          min_value?: number | null;
          name: string;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          active?: boolean;
          applies_to?: string;
          code?: string;
          conditions?: Json | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fee_type?: string;
          fee_value?: number;
          id?: string;
          max_value?: number | null;
          min_value?: number | null;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      delivery_conditions: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      discharge_checklist_items: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          created_at: string;
          file_name: string;
          file_size: number | null;
          file_url: string;
          id: string;
          nfe_key: string | null;
          order_id: string | null;
          quote_id: string | null;
          type: Database['public']['Enums']['document_type'];
          updated_at: string;
          uploaded_by: string;
          validation_status: string | null;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          file_size?: number | null;
          file_url: string;
          id?: string;
          nfe_key?: string | null;
          order_id?: string | null;
          quote_id?: string | null;
          type: Database['public']['Enums']['document_type'];
          updated_at?: string;
          uploaded_by: string;
          validation_status?: string | null;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          file_size?: number | null;
          file_url?: string;
          id?: string;
          nfe_key?: string | null;
          order_id?: string | null;
          quote_id?: string | null;
          type?: Database['public']['Enums']['document_type'];
          updated_at?: string;
          uploaded_by?: string;
          validation_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      icms_rates: {
        Row: {
          created_at: string;
          created_by: string | null;
          destination_state: string;
          id: string;
          origin_state: string;
          rate_percent: number;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          destination_state: string;
          id?: string;
          origin_state: string;
          rate_percent: number;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          destination_state?: string;
          id?: string;
          origin_state?: string;
          rate_percent?: number;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'icms_rates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      occurrences: {
        Row: {
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          order_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: Database['public']['Enums']['occurrence_severity'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description: string;
          id?: string;
          order_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database['public']['Enums']['occurrence_severity'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          order_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database['public']['Enums']['occurrence_severity'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'occurrences_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'occurrences_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'occurrences_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      orders: {
        Row: {
          assigned_to: string | null;
          carreteiro_antt: number | null;
          carreteiro_real: number | null;
          client_id: string | null;
          client_name: string;
          created_at: string;
          created_by: string;
          destination: string;
          driver_name: string | null;
          driver_phone: string | null;
          eta: string | null;
          has_antt: boolean | null;
          has_antt_motorista: boolean | null;
          has_cnh: boolean | null;
          has_comp_residencia: boolean | null;
          has_crlv: boolean | null;
          has_cte: boolean;
          has_gr: boolean | null;
          has_mdf: boolean | null;
          has_mdfe: boolean | null;
          has_nfe: boolean;
          has_pod: boolean;
          id: string;
          notes: string | null;
          origin: string;
          os_number: string;
          quote_id: string | null;
          stage: Database['public']['Enums']['order_stage'];
          updated_at: string;
          value: number;
          vehicle_plate: string | null;
          owner_name: string | null;
          owner_phone: string | null;
          waiting_time_cost: number | null;
          waiting_time_hours: number | null;
        };
        Insert: {
          assigned_to?: string | null;
          carreteiro_antt?: number | null;
          carreteiro_real?: number | null;
          client_id?: string | null;
          client_name: string;
          created_at?: string;
          created_by: string;
          destination: string;
          driver_name?: string | null;
          driver_phone?: string | null;
          eta?: string | null;
          has_antt?: boolean | null;
          has_antt_motorista?: boolean | null;
          has_cnh?: boolean | null;
          has_comp_residencia?: boolean | null;
          has_crlv?: boolean | null;
          has_cte?: boolean;
          has_gr?: boolean | null;
          has_mdf?: boolean | null;
          has_mdfe?: boolean | null;
          has_nfe?: boolean;
          has_pod?: boolean;
          id?: string;
          notes?: string | null;
          origin: string;
          os_number: string;
          quote_id?: string | null;
          stage?: Database['public']['Enums']['order_stage'];
          updated_at?: string;
          value?: number;
          vehicle_plate?: string | null;
          owner_name?: string | null;
          owner_phone?: string | null;
          waiting_time_cost?: number | null;
          waiting_time_hours?: number | null;
        };
        Update: {
          assigned_to?: string | null;
          carreteiro_antt?: number | null;
          carreteiro_real?: number | null;
          client_id?: string | null;
          client_name?: string;
          created_at?: string;
          created_by?: string;
          destination?: string;
          driver_name?: string | null;
          driver_phone?: string | null;
          eta?: string | null;
          has_antt?: boolean | null;
          has_antt_motorista?: boolean | null;
          has_cnh?: boolean | null;
          has_comp_residencia?: boolean | null;
          has_crlv?: boolean | null;
          has_cte?: boolean;
          has_gr?: boolean | null;
          has_mdf?: boolean | null;
          has_mdfe?: boolean | null;
          has_nfe?: boolean;
          has_pod?: boolean;
          id?: string;
          notes?: string | null;
          origin?: string;
          os_number?: string;
          quote_id?: string | null;
          stage?: Database['public']['Enums']['order_stage'];
          updated_at?: string;
          value?: number;
          vehicle_plate?: string | null;
          owner_name?: string | null;
          owner_phone?: string | null;
          waiting_time_cost?: number | null;
          waiting_time_hours?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'orders_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'orders_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_terms: {
        Row: {
          active: boolean;
          adjustment_percent: number;
          code: string;
          created_at: string;
          created_by: string | null;
          days: number;
          id: string;
          name: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          adjustment_percent?: number;
          code: string;
          created_at?: string;
          created_by?: string | null;
          days: number;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          adjustment_percent?: number;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          days?: number;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      price_table_rows: {
        Row: {
          ad_valorem_percent: number | null;
          cost_per_kg: number | null;
          cost_per_ton: number | null;
          cost_value_percent: number | null;
          created_at: string;
          gris_percent: number | null;
          id: string;
          km_from: number;
          km_to: number;
          price_table_id: string;
          toll_percent: number | null;
          tso_percent: number | null;
          user_id: string | null;
        };
        Insert: {
          ad_valorem_percent?: number | null;
          cost_per_kg?: number | null;
          cost_per_ton?: number | null;
          cost_value_percent?: number | null;
          created_at?: string;
          gris_percent?: number | null;
          id?: string;
          km_from: number;
          km_to: number;
          price_table_id: string;
          toll_percent?: number | null;
          tso_percent?: number | null;
          user_id?: string | null;
        };
        Update: {
          ad_valorem_percent?: number | null;
          cost_per_kg?: number | null;
          cost_per_ton?: number | null;
          cost_value_percent?: number | null;
          created_at?: string;
          gris_percent?: number | null;
          id?: string;
          km_from?: number;
          km_to?: number;
          price_table_id?: string;
          toll_percent?: number | null;
          tso_percent?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'price_table_rows_price_table_id_fkey';
            columns: ['price_table_id'];
            isOneToOne: false;
            referencedRelation: 'price_tables';
            referencedColumns: ['id'];
          },
        ];
      };
      price_tables: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          modality: string;
          name: string;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          modality: string;
          name: string;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          modality?: string;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'price_tables_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      pricing_parameters: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          key: string;
          unit: string | null;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          value: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          key: string;
          unit?: string | null;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          value: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          key?: string;
          unit?: string | null;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          perfil: Database['public']['Enums']['user_profile'] | null;
          phone: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          perfil?: Database['public']['Enums']['user_profile'] | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          perfil?: Database['public']['Enums']['user_profile'] | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      quotes: {
        Row: {
          assigned_to: string | null;
          billable_weight: number | null;
          cargo_type: string | null;
          cargo_value: number | null;
          client_email: string | null;
          client_id: string | null;
          client_name: string;
          conditional_fees_breakdown: Json | null;
          created_at: string;
          created_by: string;
          cubage_weight: number | null;
          delivery_conditions_selected: Json | null;
          delivery_notes: string | null;
          destination: string;
          destination_cep: string | null;
          discharge_checklist_selected: Json | null;
          freight_modality: string | null;
          freight_type: string | null;
          id: string;
          km_distance: number | null;
          notes: string | null;
          origin: string;
          origin_cep: string | null;
          payment_term_id: string | null;
          price_table_id: string | null;
          pricing_breakdown: Json | null;
          shipper_email: string | null;
          shipper_id: string | null;
          shipper_name: string | null;
          stage: Database['public']['Enums']['quote_stage'];
          tac_percent: number | null;
          tags: string[] | null;
          toll_value: number | null;
          updated_at: string;
          validity_date: string | null;
          value: number;
          vehicle_type_id: string | null;
          volume: number | null;
          waiting_time_cost: number | null;
          weight: number | null;
        };
        Insert: {
          assigned_to?: string | null;
          billable_weight?: number | null;
          cargo_type?: string | null;
          cargo_value?: number | null;
          client_email?: string | null;
          client_id?: string | null;
          client_name: string;
          conditional_fees_breakdown?: Json | null;
          created_at?: string;
          created_by: string;
          cubage_weight?: number | null;
          delivery_conditions_selected?: Json | null;
          delivery_notes?: string | null;
          destination: string;
          destination_cep?: string | null;
          discharge_checklist_selected?: Json | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          id?: string;
          km_distance?: number | null;
          notes?: string | null;
          origin: string;
          origin_cep?: string | null;
          payment_term_id?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          shipper_email?: string | null;
          shipper_id?: string | null;
          shipper_name?: string | null;
          stage?: Database['public']['Enums']['quote_stage'];
          tac_percent?: number | null;
          tags?: string[] | null;
          toll_value?: number | null;
          updated_at?: string;
          validity_date?: string | null;
          value?: number;
          vehicle_type_id?: string | null;
          volume?: number | null;
          waiting_time_cost?: number | null;
          weight?: number | null;
        };
        Update: {
          assigned_to?: string | null;
          billable_weight?: number | null;
          cargo_type?: string | null;
          cargo_value?: number | null;
          client_email?: string | null;
          client_id?: string | null;
          client_name?: string;
          conditional_fees_breakdown?: Json | null;
          created_at?: string;
          created_by?: string;
          cubage_weight?: number | null;
          delivery_conditions_selected?: Json | null;
          delivery_notes?: string | null;
          destination?: string;
          destination_cep?: string | null;
          discharge_checklist_selected?: Json | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          id?: string;
          km_distance?: number | null;
          notes?: string | null;
          origin?: string;
          origin_cep?: string | null;
          payment_term_id?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          shipper_email?: string | null;
          shipper_id?: string | null;
          shipper_name?: string | null;
          stage?: Database['public']['Enums']['quote_stage'];
          tac_percent?: number | null;
          tags?: string[] | null;
          toll_value?: number | null;
          updated_at?: string;
          validity_date?: string | null;
          value?: number;
          vehicle_type_id?: string | null;
          volume?: number | null;
          waiting_time_cost?: number | null;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'quotes_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'quotes_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'quotes_payment_term_id_fkey';
            columns: ['payment_term_id'];
            isOneToOne: false;
            referencedRelation: 'payment_terms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_price_table_id_fkey';
            columns: ['price_table_id'];
            isOneToOne: false;
            referencedRelation: 'price_tables';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_shipper_id_fkey';
            columns: ['shipper_id'];
            isOneToOne: false;
            referencedRelation: 'shippers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      shippers: {
        Row: {
          address: string | null;
          city: string | null;
          cnpj: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          state: string | null;
          updated_at: string;
          zip_code: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
          zip_code?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          updated_at?: string;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shippers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      owners: {
        Row: {
          id: string;
          name: string;
          cpf_cnpj: string | null;
          rg: string | null;
          rg_emitter: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          cpf_cnpj?: string | null;
          rg?: string | null;
          rg_emitter?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          cpf_cnpj?: string | null;
          rg?: string | null;
          rg_emitter?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          plate: string;
          driver_id: string | null;
          owner_id: string | null;
          active: boolean;
          brand: string | null;
          model: string | null;
        };
        Insert: {
          id?: string;
          plate: string;
          driver_id?: string | null;
          owner_id?: string | null;
          active?: boolean;
          brand?: string | null;
          model?: string | null;
        };
        Update: {
          id?: string;
          plate?: string;
          driver_id?: string | null;
          owner_id?: string | null;
          active?: boolean;
          brand?: string | null;
          model?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      tac_rates: {
        Row: {
          adjustment_percent: number;
          created_at: string;
          created_by: string | null;
          diesel_price_base: number;
          diesel_price_current: number;
          id: string;
          reference_date: string;
          source_description: string | null;
          updated_at: string;
          user_id: string | null;
          variation_percent: number | null;
        };
        Insert: {
          adjustment_percent?: number;
          created_at?: string;
          created_by?: string | null;
          diesel_price_base: number;
          diesel_price_current: number;
          id?: string;
          reference_date: string;
          source_description?: string | null;
          updated_at?: string;
          user_id?: string | null;
          variation_percent?: number | null;
        };
        Update: {
          adjustment_percent?: number;
          created_at?: string;
          created_by?: string | null;
          diesel_price_base?: number;
          diesel_price_current?: number;
          id?: string;
          reference_date?: string;
          source_description?: string | null;
          updated_at?: string;
          user_id?: string | null;
          variation_percent?: number | null;
        };
        Relationships: [];
      };
      toll_routes: {
        Row: {
          created_at: string;
          created_by: string | null;
          destination_city: string | null;
          destination_state: string;
          distance_km: number | null;
          id: string;
          origin_city: string | null;
          origin_state: string;
          toll_value: number;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          vehicle_type_id: string | null;
          via_description: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          destination_city?: string | null;
          destination_state: string;
          distance_km?: number | null;
          id?: string;
          origin_city?: string | null;
          origin_state: string;
          toll_value: number;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_type_id?: string | null;
          via_description?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          destination_city?: string | null;
          destination_state?: string;
          distance_km?: number | null;
          id?: string;
          origin_city?: string | null;
          origin_state?: string;
          toll_value?: number;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_type_id?: string | null;
          via_description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'toll_routes_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'valid_users';
            referencedColumns: ['user_id'];
          },
        ];
      };
      vehicle_types: {
        Row: {
          active: boolean;
          axes_count: number | null;
          capacity_kg: number | null;
          capacity_m3: number | null;
          code: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          axes_count?: number | null;
          capacity_kg?: number | null;
          capacity_m3?: number | null;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          axes_count?: number | null;
          capacity_kg?: number | null;
          capacity_m3?: number | null;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      waiting_time_rules: {
        Row: {
          context: string;
          created_at: string;
          created_by: string | null;
          free_hours: number;
          id: string;
          min_charge: number | null;
          rate_per_day: number | null;
          rate_per_hour: number | null;
          updated_at: string;
          user_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          vehicle_type_id: string | null;
        };
        Insert: {
          context?: string;
          created_at?: string;
          created_by?: string | null;
          free_hours?: number;
          id?: string;
          min_charge?: number | null;
          rate_per_day?: number | null;
          rate_per_hour?: number | null;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_type_id?: string | null;
        };
        Update: {
          context?: string;
          created_at?: string;
          created_by?: string | null;
          free_hours?: number;
          id?: string;
          min_charge?: number | null;
          rate_per_day?: number | null;
          rate_per_hour?: number | null;
          updated_at?: string;
          user_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_type_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'waiting_time_rules_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      valid_users: {
        Row: {
          email: string | null;
          user_id: string | null;
        };
        Insert: {
          email?: string | null;
          user_id?: string | null;
        };
        Update: {
          email?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_user_profile: {
        Args: never;
        Returns: Database['public']['Enums']['user_profile'];
      };
      generate_os_number: { Args: never; Returns: string };
      get_user_role: {
        Args: { _user_id: string };
        Returns: Database['public']['Enums']['app_role'];
      };
      has_any_role: {
        Args: {
          _roles: Database['public']['Enums']['app_role'][];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database['public']['Enums']['app_role'];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      set_user_profile: {
        Args: {
          new_profile: Database['public']['Enums']['user_profile'];
          target_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'admin' | 'comercial' | 'operacao' | 'fiscal' | 'leitura';
      document_type:
        | 'nfe'
        | 'cte'
        | 'pod'
        | 'outros'
        | 'cnh'
        | 'crlv'
        | 'comp_residencia'
        | 'antt_motorista'
        | 'mdfe';
      occurrence_severity: 'baixa' | 'media' | 'alta' | 'critica';
      order_stage:
        | 'ordem_criada'
        | 'busca_motorista'
        | 'documentacao'
        | 'coleta_realizada'
        | 'em_transito'
        | 'entregue';
      quote_stage:
        | 'novo_pedido'
        | 'qualificacao'
        | 'precificacao'
        | 'enviado'
        | 'negociacao'
        | 'ganho'
        | 'perdido';
      user_profile: 'admin' | 'operacional' | 'financeiro';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['admin', 'comercial', 'operacao', 'fiscal', 'leitura'],
      document_type: [
        'nfe',
        'cte',
        'pod',
        'outros',
        'cnh',
        'crlv',
        'comp_residencia',
        'antt_motorista',
        'mdfe',
      ],
      occurrence_severity: ['baixa', 'media', 'alta', 'critica'],
      order_stage: [
        'ordem_criada',
        'busca_motorista',
        'documentacao',
        'coleta_realizada',
        'em_transito',
        'entregue',
      ],
      quote_stage: [
        'novo_pedido',
        'qualificacao',
        'precificacao',
        'enviado',
        'negociacao',
        'ganho',
        'perdido',
      ],
      user_profile: ['admin', 'operacional', 'financeiro'],
    },
  },
} as const;
