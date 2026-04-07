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
          cnpj_mask: string | null;
          contact_name: string | null;
          cpf: number | null;
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
          zip_code_mask: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          cnpj?: string | null;
          cnpj_mask?: string | null;
          contact_name?: string | null;
          cpf?: number | null;
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
          zip_code_mask?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          cnpj?: string | null;
          cnpj_mask?: string | null;
          contact_name?: string | null;
          cpf?: number | null;
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
          zip_code_mask?: string | null;
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
          fat_id: string | null;
          file_name: string;
          file_size: number | null;
          file_url: string;
          id: string;
          nfe_key: string | null;
          order_id: string | null;
          quote_id: string | null;
          trip_id: string | null;
          type: Database['public']['Enums']['document_type'];
          updated_at: string;
          uploaded_by: string;
          validation_status: string | null;
        };
        Insert: {
          created_at?: string;
          fat_id?: string | null;
          file_name: string;
          file_size?: number | null;
          file_url: string;
          id?: string;
          nfe_key?: string | null;
          order_id?: string | null;
          quote_id?: string | null;
          trip_id?: string | null;
          type: Database['public']['Enums']['document_type'];
          updated_at?: string;
          uploaded_by: string;
          validation_status?: string | null;
        };
        Update: {
          created_at?: string;
          fat_id?: string | null;
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
      drivers: {
        Row: {
          active: boolean;
          antt: string | null;
          cnh: string | null;
          cnh_category: string | null;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          antt?: string | null;
          cnh?: string | null;
          cnh_category?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          antt?: string | null;
          cnh?: string | null;
          cnh_category?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      equipment_rental_rates: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          name: string;
          unit: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
          value: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          unit?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          unit?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      financial_documents: {
        Row: {
          code: string | null;
          created_at: string;
          erp_reference: string | null;
          erp_status: string | null;
          id: string;
          notes: string | null;
          owner_id: string | null;
          source_id: string;
          source_type: Database['public']['Enums']['financial_source_type'];
          status: string;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'];
          updated_at: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          erp_reference?: string | null;
          erp_status?: string | null;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          source_id: string;
          source_type: Database['public']['Enums']['financial_source_type'];
          status?: string;
          total_amount?: number | null;
          type: Database['public']['Enums']['financial_doc_type'];
          updated_at?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          erp_reference?: string | null;
          erp_status?: string | null;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          source_id?: string;
          source_type?: Database['public']['Enums']['financial_source_type'];
          status?: string;
          total_amount?: number | null;
          type?: Database['public']['Enums']['financial_doc_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_installments: {
        Row: {
          amount: number | null;
          created_at: string;
          due_date: string;
          financial_document_id: string;
          id: string;
          payment_method: string | null;
          settled_at: string | null;
          status: Database['public']['Enums']['financial_installment_status'];
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          created_at?: string;
          due_date: string;
          financial_document_id: string;
          id?: string;
          payment_method?: string | null;
          settled_at?: string | null;
          status?: Database['public']['Enums']['financial_installment_status'];
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          due_date?: string;
          financial_document_id?: string;
          id?: string;
          payment_method?: string | null;
          settled_at?: string | null;
          status?: Database['public']['Enums']['financial_installment_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_installments_financial_document_id_fkey';
            columns: ['financial_document_id'];
            isOneToOne: false;
            referencedRelation: 'financial_documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_installments_financial_document_id_fkey';
            columns: ['financial_document_id'];
            isOneToOne: false;
            referencedRelation: 'financial_documents_kanban';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_installments_financial_document_id_fkey';
            columns: ['financial_document_id'];
            isOneToOne: false;
            referencedRelation: 'financial_payable_kanban';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_installments_financial_document_id_fkey';
            columns: ['financial_document_id'];
            isOneToOne: false;
            referencedRelation: 'financial_receivable_kanban';
            referencedColumns: ['id'];
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
      ltl_parameters: {
        Row: {
          correction_factor: number;
          created_at: string;
          cubage_factor: number;
          dispatch_fee: number;
          gris_high_risk_percent: number;
          gris_min: number;
          gris_min_cargo_limit: number;
          gris_percent: number;
          id: string;
          min_freight: number;
          min_freight_cargo_limit: number;
          min_tso: number;
          reference_month: string;
        };
        Insert: {
          correction_factor?: number;
          created_at?: string;
          cubage_factor?: number;
          dispatch_fee?: number;
          gris_high_risk_percent?: number;
          gris_min?: number;
          gris_min_cargo_limit?: number;
          gris_percent?: number;
          id?: string;
          min_freight?: number;
          min_freight_cargo_limit?: number;
          min_tso?: number;
          reference_month: string;
        };
        Update: {
          correction_factor?: number;
          created_at?: string;
          cubage_factor?: number;
          dispatch_fee?: number;
          gris_high_risk_percent?: number;
          gris_min?: number;
          gris_min_cargo_limit?: number;
          gris_percent?: number;
          id?: string;
          min_freight?: number;
          min_freight_cargo_limit?: number;
          min_tso?: number;
          reference_month?: string;
        };
        Relationships: [];
      };
      news_items: {
        Row: {
          id: string;
          title: string;
          summary: string;
          source_type: string;
          source_name: string | null;
          source_url: string | null;
          relevance_score: number | null;
          created_at: string;
          raw_snippet: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          summary: string;
          source_type: string;
          source_name?: string | null;
          source_url?: string | null;
          relevance_score?: number | null;
          created_at?: string;
          raw_snippet?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          summary?: string;
          source_type?: string;
          source_name?: string | null;
          source_url?: string | null;
          relevance_score?: number | null;
          created_at?: string;
          raw_snippet?: string | null;
        };
        Relationships: [];
      };
      ntc_cost_indices: {
        Row: {
          created_at: string;
          distance_km: number | null;
          id: string;
          index_type: string;
          index_value: number;
          period: string;
          pickup_km: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          distance_km?: number | null;
          id?: string;
          index_type: string;
          index_value: number;
          period: string;
          pickup_km?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          distance_km?: number | null;
          id?: string;
          index_type?: string;
          index_value?: number;
          period?: string;
          pickup_km?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ntc_fuel_reference: {
        Row: {
          annual_variation_pct: number | null;
          created_at: string;
          diesel_price_liter: number;
          diesel_price_mg: number | null;
          diesel_price_pr: number | null;
          diesel_price_rj: number | null;
          diesel_price_sp: number | null;
          id: string;
          monthly_variation_pct: number | null;
          notes: string | null;
          reference_month: string;
          updated_at: string;
        };
        Insert: {
          annual_variation_pct?: number | null;
          created_at?: string;
          diesel_price_liter: number;
          diesel_price_mg?: number | null;
          diesel_price_pr?: number | null;
          diesel_price_rj?: number | null;
          diesel_price_sp?: number | null;
          id?: string;
          monthly_variation_pct?: number | null;
          notes?: string | null;
          reference_month: string;
          updated_at?: string;
        };
        Update: {
          annual_variation_pct?: number | null;
          created_at?: string;
          diesel_price_liter?: number;
          diesel_price_mg?: number | null;
          diesel_price_pr?: number | null;
          diesel_price_rj?: number | null;
          diesel_price_sp?: number | null;
          id?: string;
          monthly_variation_pct?: number | null;
          notes?: string | null;
          reference_month?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          cargo_type: string | null;
          driver_id: string | null;
          carrier_advance_date: string | null;
          carrier_balance_date: string | null;
          carrier_payment_term_id: string | null;
          carreteiro_antt: number | null;
          carreteiro_real: number | null;
          descarga_real: number | null;
          pedagio_real: number | null;
          client_id: string | null;
          client_name: string;
          created_at: string;
          created_by: string;
          destination: string;
          destination_cep: string | null;
          driver_antt: string | null;
          driver_cnh: string | null;
          driver_name: string | null;
          driver_phone: string | null;
          eta: string | null;
          freight_modality: string | null;
          freight_type: string | null;
          has_analise_gr: boolean | null;
          has_antt: boolean | null;
          has_antt_motorista: boolean | null;
          has_cnh: boolean | null;
          has_comp_residencia: boolean | null;
          has_crlv: boolean | null;
          has_cte: boolean;
          has_doc_rota: boolean | null;
          has_gr: boolean | null;
          has_mdf: boolean | null;
          has_mdfe: boolean | null;
          has_nfe: boolean;
          has_pod: boolean;
          has_vpo: boolean | null;
          has_comprovante_descarga: boolean | null;
          id: string;
          km_distance: number | null;
          notes: string | null;
          origin: string;
          origin_cep: string | null;
          os_number: string;
          owner_name: string | null;
          owner_phone: string | null;
          payment_term_id: string | null;
          price_table_id: string | null;
          pricing_breakdown: Json | null;
          quote_id: string | null;
          shipper_id: string | null;
          shipper_name: string | null;
          stage: Database['public']['Enums']['order_stage'];
          toll_value: number | null;
          updated_at: string;
          value: number;
          vehicle_brand: string | null;
          vehicle_model: string | null;
          vehicle_plate: string | null;
          vehicle_type_id: string | null;
          vehicle_type_name: string | null;
          volume: number | null;
          waiting_time_cost: number | null;
          waiting_time_hours: number | null;
          weight: number | null;
          trip_id: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          cargo_type?: string | null;
          carrier_advance_date?: string | null;
          carrier_balance_date?: string | null;
          carrier_payment_term_id?: string | null;
          carreteiro_antt?: number | null;
          carreteiro_real?: number | null;
          descarga_real?: number | null;
          pedagio_real?: number | null;
          client_id?: string | null;
          client_name: string;
          created_at?: string;
          created_by: string;
          destination: string;
          destination_cep?: string | null;
          driver_antt?: string | null;
          driver_cnh?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          eta?: string | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          has_analise_gr?: boolean | null;
          has_antt?: boolean | null;
          has_antt_motorista?: boolean | null;
          has_cnh?: boolean | null;
          has_comp_residencia?: boolean | null;
          has_crlv?: boolean | null;
          has_cte?: boolean;
          has_doc_rota?: boolean | null;
          has_gr?: boolean | null;
          has_mdf?: boolean | null;
          has_mdfe?: boolean | null;
          has_nfe?: boolean;
          has_pod?: boolean;
          has_vpo?: boolean | null;
          has_comprovante_descarga?: boolean | null;
          id?: string;
          km_distance?: number | null;
          notes?: string | null;
          origin: string;
          origin_cep?: string | null;
          os_number: string;
          owner_name?: string | null;
          owner_phone?: string | null;
          payment_term_id?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          quote_id?: string | null;
          shipper_id?: string | null;
          shipper_name?: string | null;
          stage?: Database['public']['Enums']['order_stage'];
          toll_value?: number | null;
          updated_at?: string;
          value?: number;
          vehicle_brand?: string | null;
          vehicle_model?: string | null;
          vehicle_plate?: string | null;
          vehicle_type_id?: string | null;
          vehicle_type_name?: string | null;
          volume?: number | null;
          waiting_time_cost?: number | null;
          waiting_time_hours?: number | null;
          weight?: number | null;
          trip_id?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          cargo_type?: string | null;
          carrier_advance_date?: string | null;
          carrier_balance_date?: string | null;
          carrier_payment_term_id?: string | null;
          carreteiro_antt?: number | null;
          carreteiro_real?: number | null;
          descarga_real?: number | null;
          pedagio_real?: number | null;
          client_id?: string | null;
          client_name?: string;
          created_at?: string;
          created_by?: string;
          destination?: string;
          destination_cep?: string | null;
          driver_antt?: string | null;
          driver_id?: string | null;
          driver_cnh?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          eta?: string | null;
          freight_modality?: string | null;
          freight_type?: string | null;
          has_analise_gr?: boolean | null;
          has_antt?: boolean | null;
          has_antt_motorista?: boolean | null;
          has_cnh?: boolean | null;
          has_comp_residencia?: boolean | null;
          has_crlv?: boolean | null;
          has_cte?: boolean;
          has_doc_rota?: boolean | null;
          has_gr?: boolean | null;
          has_mdf?: boolean | null;
          has_mdfe?: boolean | null;
          has_nfe?: boolean;
          has_pod?: boolean;
          has_vpo?: boolean | null;
          has_comprovante_descarga?: boolean | null;
          id?: string;
          km_distance?: number | null;
          notes?: string | null;
          origin?: string;
          origin_cep?: string | null;
          os_number?: string;
          owner_name?: string | null;
          owner_phone?: string | null;
          payment_term_id?: string | null;
          price_table_id?: string | null;
          pricing_breakdown?: Json | null;
          quote_id?: string | null;
          shipper_id?: string | null;
          shipper_name?: string | null;
          stage?: Database['public']['Enums']['order_stage'];
          toll_value?: number | null;
          trip_id?: string | null;
          updated_at?: string;
          value?: number;
          vehicle_brand?: string | null;
          vehicle_model?: string | null;
          vehicle_plate?: string | null;
          vehicle_type_id?: string | null;
          vehicle_type_name?: string | null;
          volume?: number | null;
          waiting_time_cost?: number | null;
          waiting_time_hours?: number | null;
          weight?: number | null;
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
      owners: {
        Row: {
          active: boolean;
          address: string | null;
          city: string | null;
          cpf_cnpj: string | null;
          cpf_cnpj_mask: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          rg: string | null;
          rg_emitter: string | null;
          state: string | null;
          updated_at: string;
          zip_code: string | null;
          zip_code_mask: string | null;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          city?: string | null;
          cpf_cnpj?: string | null;
          cpf_cnpj_mask?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          rg?: string | null;
          rg_emitter?: string | null;
          state?: string | null;
          updated_at?: string;
          zip_code?: string | null;
          zip_code_mask?: string | null;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          city?: string | null;
          cpf_cnpj?: string | null;
          cpf_cnpj_mask?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          rg?: string | null;
          rg_emitter?: string | null;
          state?: string | null;
          updated_at?: string;
          zip_code?: string | null;
          zip_code_mask?: string | null;
        };
        Relationships: [];
      };
      payment_terms: {
        Row: {
          active: boolean;
          adjustment_percent: number;
          advance_percent: number | null;
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
          advance_percent?: number | null;
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
          advance_percent?: number | null;
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
      payment_proofs: {
        Row: {
          id: string;
          order_id: string;
          trip_id: string | null;
          document_id: string;
          proof_type: 'adiantamento' | 'saldo' | 'outros';
          method: 'pix' | 'boleto' | 'outro' | null;
          amount: number | null;
          expected_amount: number | null;
          paid_at: string | null;
          transaction_id: string | null;
          payee_name: string | null;
          payee_document: string | null;
          extracted_fields: Record<string, unknown>;
          extraction_confidence: number | null;
          status: 'pending' | 'matched' | 'mismatch';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          trip_id?: string | null;
          document_id: string;
          proof_type: 'adiantamento' | 'saldo' | 'outros';
          method?: 'pix' | 'boleto' | 'outro' | null;
          amount?: number | null;
          expected_amount?: number | null;
          paid_at?: string | null;
          transaction_id?: string | null;
          payee_name?: string | null;
          payee_document?: string | null;
          extracted_fields?: Record<string, unknown>;
          extraction_confidence?: number | null;
          status?: 'pending' | 'matched' | 'mismatch';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          order_id?: string;
          trip_id?: string | null;
          document_id?: string;
          proof_type?: 'adiantamento' | 'saldo' | 'outros';
          method?: 'pix' | 'boleto' | 'outro' | null;
          amount?: number | null;
          expected_amount?: number | null;
          paid_at?: string | null;
          transaction_id?: string | null;
          payee_name?: string | null;
          payee_document?: string | null;
          extracted_fields?: Record<string, unknown>;
          extraction_confidence?: number | null;
          status?: 'pending' | 'matched' | 'mismatch';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_proofs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_proofs_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_proofs_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: true;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
        ];
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
          weight_rate_10: number | null;
          weight_rate_100: number | null;
          weight_rate_150: number | null;
          weight_rate_20: number | null;
          weight_rate_200: number | null;
          weight_rate_30: number | null;
          weight_rate_50: number | null;
          weight_rate_70: number | null;
          weight_rate_above_200: number | null;
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
          weight_rate_10?: number | null;
          weight_rate_100?: number | null;
          weight_rate_150?: number | null;
          weight_rate_20?: number | null;
          weight_rate_200?: number | null;
          weight_rate_30?: number | null;
          weight_rate_50?: number | null;
          weight_rate_70?: number | null;
          weight_rate_above_200?: number | null;
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
          weight_rate_10?: number | null;
          weight_rate_100?: number | null;
          weight_rate_150?: number | null;
          weight_rate_20?: number | null;
          weight_rate_200?: number | null;
          weight_rate_30?: number | null;
          weight_rate_50?: number | null;
          weight_rate_70?: number | null;
          weight_rate_above_200?: number | null;
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
      trip_cost_items: {
        Row: {
          id: string;
          trip_id: string;
          order_id: string | null;
          scope: 'TRIP' | 'OS';
          category: string;
          description: string | null;
          amount: number;
          currency: string;
          source: 'breakdown' | 'manual' | 'api' | 'xml';
          reference_key: string | null;
          reference_id: string | null;
          idempotency_key: string | null;
          is_frozen: boolean;
          manually_edited_at: string | null;
          manually_edited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          order_id?: string | null;
          scope: 'TRIP' | 'OS';
          category: string;
          description?: string | null;
          amount?: number;
          currency?: string;
          source?: 'breakdown' | 'manual' | 'api' | 'xml';
          reference_key?: string | null;
          reference_id?: string | null;
          idempotency_key?: string | null;
          is_frozen?: boolean;
          manually_edited_at?: string | null;
          manually_edited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          trip_id?: string;
          order_id?: string | null;
          scope?: 'TRIP' | 'OS';
          category?: string;
          description?: string | null;
          amount?: number;
          currency?: string;
          source?: 'breakdown' | 'manual' | 'api' | 'xml';
          reference_key?: string | null;
          reference_id?: string | null;
          idempotency_key?: string | null;
          is_frozen?: boolean;
          manually_edited_at?: string | null;
          manually_edited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_cost_items_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_cost_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_orders: {
        Row: {
          id: string;
          trip_id: string;
          order_id: string;
          apportion_key: 'revenue' | 'weight' | 'volume' | 'km' | 'equal' | 'manual';
          apportion_factor: number;
          manual_percent: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          order_id: string;
          apportion_key?: 'revenue' | 'weight' | 'volume' | 'km' | 'equal' | 'manual';
          apportion_factor?: number;
          manual_percent?: number | null;
          created_at?: string;
        };
        Update: {
          trip_id?: string;
          order_id?: string;
          apportion_key?: 'revenue' | 'weight' | 'volume' | 'km' | 'equal' | 'manual';
          apportion_factor?: number;
          manual_percent?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_orders_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          id: string;
          trip_number: string;
          vehicle_plate: string;
          driver_id: string;
          vehicle_type_id: string | null;
          departure_at: string | null;
          status_operational: 'aberta' | 'em_transito' | 'finalizada' | 'cancelada';
          financial_status: 'open' | 'closing' | 'closed';
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          closed_at: string | null;
          closed_by: string | null;
        };
        Insert: {
          id?: string;
          trip_number: string;
          vehicle_plate: string;
          driver_id: string;
          vehicle_type_id?: string | null;
          departure_at?: string | null;
          status_operational?: 'aberta' | 'em_transito' | 'finalizada' | 'cancelada';
          financial_status?: 'open' | 'closing' | 'closed';
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
          closed_by?: string | null;
        };
        Update: {
          trip_number?: string;
          vehicle_plate?: string;
          driver_id?: string;
          vehicle_type_id?: string | null;
          departure_at?: string | null;
          status_operational?: 'aberta' | 'em_transito' | 'finalizada' | 'cancelada';
          financial_status?: 'open' | 'closing' | 'closed';
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
          closed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      quote_route_stops: {
        Row: {
          id: string;
          quote_id: string;
          sequence: number;
          stop_type: 'origin' | 'stop' | 'destination';
          cnpj: string | null;
          name: string | null;
          cep: string | null;
          city_uf: string | null;
          label: string | null;
          planned_km_from_prev: number | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          sequence?: number;
          stop_type?: 'origin' | 'stop' | 'destination';
          cnpj?: string | null;
          name?: string | null;
          cep?: string | null;
          city_uf?: string | null;
          label?: string | null;
          planned_km_from_prev?: number | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quote_id?: string;
          sequence?: number;
          stop_type?: 'origin' | 'stop' | 'destination';
          cnpj?: string | null;
          name?: string | null;
          cep?: string | null;
          city_uf?: string | null;
          label?: string | null;
          planned_km_from_prev?: number | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quote_route_stops_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['id'];
          },
        ];
      };
      quotes: {
        Row: {
          advance_due_date: string | null;
          assigned_to: string | null;
          balance_due_date: string | null;
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
          email_sent: boolean;
          email_sent_at: string | null;
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
          quote_code: string | null;
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
          advance_due_date?: string | null;
          assigned_to?: string | null;
          balance_due_date?: string | null;
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
          email_sent?: boolean;
          email_sent_at?: string | null;
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
          quote_code?: string | null;
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
          advance_due_date?: string | null;
          assigned_to?: string | null;
          balance_due_date?: string | null;
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
          email_sent?: boolean;
          email_sent_at?: string | null;
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
          quote_code?: string | null;
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
          cpf: string | null;
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
          cpf?: string | null;
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
          cpf?: string | null;
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
      unloading_cost_rates: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          name: string;
          unit: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
          value: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          unit?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          unit?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [];
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
      vehicles: {
        Row: {
          active: boolean;
          brand: string | null;
          color: string | null;
          created_at: string;
          driver_id: string | null;
          id: string;
          model: string | null;
          owner_id: string | null;
          plate: string;
          plate_2: string | null;
          plate_2_mask: string | null;
          plate_mask: string | null;
          renavam: string | null;
          updated_at: string;
          vehicle_type_id: string | null;
          year: number | null;
        };
        Insert: {
          active?: boolean;
          brand?: string | null;
          color?: string | null;
          created_at?: string;
          driver_id?: string | null;
          id?: string;
          model?: string | null;
          owner_id?: string | null;
          plate: string;
          plate_2?: string | null;
          plate_2_mask?: string | null;
          plate_mask?: string | null;
          renavam?: string | null;
          updated_at?: string;
          vehicle_type_id?: string | null;
          year?: number | null;
        };
        Update: {
          active?: boolean;
          brand?: string | null;
          color?: string | null;
          created_at?: string;
          driver_id?: string | null;
          id?: string;
          model?: string | null;
          owner_id?: string | null;
          plate?: string;
          plate_2?: string | null;
          plate_2_mask?: string | null;
          plate_mask?: string | null;
          renavam?: string | null;
          updated_at?: string;
          vehicle_type_id?: string | null;
          year?: number | null;
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
          {
            foreignKeyName: 'vehicles_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
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
      financial_documents_kanban: {
        Row: {
          code: string | null;
          created_at: string | null;
          erp_reference: string | null;
          erp_status: string | null;
          id: string | null;
          installments_pending: number | null;
          installments_settled: number | null;
          installments_total: number | null;
          is_overdue: boolean | null;
          next_due_date: string | null;
          notes: string | null;
          owner_id: string | null;
          source_id: string | null;
          source_type: Database['public']['Enums']['financial_source_type'] | null;
          status: string | null;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at: string | null;
        };
        Insert: {
          code?: string | null;
          created_at?: string | null;
          erp_reference?: string | null;
          erp_status?: string | null;
          id?: string | null;
          installments_pending?: never;
          installments_settled?: never;
          installments_total?: never;
          is_overdue?: never;
          next_due_date?: never;
          notes?: string | null;
          owner_id?: string | null;
          source_id?: string | null;
          source_type?: Database['public']['Enums']['financial_source_type'] | null;
          status?: string | null;
          total_amount?: number | null;
          type?: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string | null;
          erp_reference?: string | null;
          erp_status?: string | null;
          id?: string | null;
          installments_pending?: never;
          installments_settled?: never;
          installments_total?: never;
          is_overdue?: never;
          next_due_date?: never;
          notes?: string | null;
          owner_id?: string | null;
          source_id?: string | null;
          source_type?: Database['public']['Enums']['financial_source_type'] | null;
          status?: string | null;
          total_amount?: number | null;
          type?: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_payable_kanban: {
        Row: {
          carreteiro_antt: number | null;
          carreteiro_real: number | null;
          client_name: string | null;
          code: string | null;
          created_at: string | null;
          destination: string | null;
          erp_reference: string | null;
          erp_status: string | null;
          id: string | null;
          installments_pending: number | null;
          installments_settled: number | null;
          installments_total: number | null;
          is_overdue: boolean | null;
          next_due_date: string | null;
          notes: string | null;
          order_value: number | null;
          origin: string | null;
          owner_id: string | null;
          source_id: string | null;
          source_type: Database['public']['Enums']['financial_source_type'] | null;
          status: string | null;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_receivable_kanban: {
        Row: {
          client_name: string | null;
          code: string | null;
          created_at: string | null;
          destination: string | null;
          erp_reference: string | null;
          erp_status: string | null;
          id: string | null;
          installments_pending: number | null;
          installments_settled: number | null;
          installments_total: number | null;
          is_overdue: boolean | null;
          next_due_date: string | null;
          notes: string | null;
          origin: string | null;
          owner_id: string | null;
          quote_value: number | null;
          source_id: string | null;
          source_type: Database['public']['Enums']['financial_source_type'] | null;
          status: string | null;
          total_amount: number | null;
          type: Database['public']['Enums']['financial_doc_type'] | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
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
      copy_quote_adiantamento_to_fat: {
        Args: { p_fat_id: string; p_quote_id: string };
        Returns: undefined;
      };
      current_user_profile: {
        Args: never;
        Returns: Database['public']['Enums']['user_profile'];
      };
      ensure_financial_document: {
        Args: {
          doc_type: Database['public']['Enums']['financial_doc_type'];
          source_id_in: string;
          total_amount_in?: number;
        };
        Returns: Json;
      };
      find_price_row_by_km: {
        Args: {
          p_km_numeric: number;
          p_price_table_id: string;
          p_rounding?: string;
        };
        Returns: {
          cost_per_ton: number;
          id: string;
          km_from: number;
          km_to: number;
          matched_km: number;
        }[];
      };
      generate_os_number: { Args: never; Returns: string };
      generate_quote_code: { Args: never; Returns: string };
      generate_trip_number: { Args: never; Returns: string };
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
      link_order_to_trip: {
        Args: { p_order_id: string };
        Returns: string;
      };
      link_order_to_target_trip: {
        Args: { p_order_id: string; p_trip_id: string };
        Returns: string;
      };
      mask_cep: { Args: { input: string }; Returns: string };
      mask_cnpj: { Args: { input: string }; Returns: string };
      mask_cpf: { Args: { input: string }; Returns: string };
      mask_plate: { Args: { input: string }; Returns: string };
      norm_plate: { Args: { input: string }; Returns: string };
      only_digits: { Args: { input: string }; Returns: string };
      set_user_profile: {
        Args: {
          new_profile: Database['public']['Enums']['user_profile'];
          target_user_id: string;
        };
        Returns: undefined;
      };
      sync_cost_items_from_breakdown: {
        Args: { p_trip_id: string };
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
        | 'mdfe'
        | 'adiantamento'
        | 'analise_gr'
        | 'doc_rota'
        | 'comprovante_vpo'
        | 'comprovante_descarga'
        | 'adiantamento_carreteiro'
        | 'saldo_carreteiro'
        | 'a_vista_fat'
        | 'saldo_fat'
        | 'a_prazo_fat';
      financial_doc_type: 'FAT' | 'PAG';
      financial_installment_status: 'pendente' | 'baixado';
      financial_source_type: 'quote' | 'order';
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
      route_stop_type: 'origin' | 'stop' | 'destination';
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
        'adiantamento',
        'analise_gr',
        'doc_rota',
        'comprovante_vpo',
        'comprovante_descarga',
        'adiantamento_carreteiro',
        'saldo_carreteiro',
        'a_vista_fat',
        'saldo_fat',
        'a_prazo_fat',
      ],
      financial_doc_type: ['FAT', 'PAG'],
      financial_installment_status: ['pendente', 'baixado'],
      financial_source_type: ['quote', 'order'],
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
