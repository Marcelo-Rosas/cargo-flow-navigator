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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_budget_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_budget_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          analysis: Json
          created_at: string
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          insight_type: string
          summary_text: string
          user_feedback: string | null
          user_rating: number | null
        }
        Insert: {
          analysis: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          insight_type: string
          summary_text: string
          user_feedback?: string | null
          user_rating?: number | null
        }
        Update: {
          analysis?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          insight_type?: string
          summary_text?: string
          user_feedback?: string | null
          user_rating?: number | null
        }
        Relationships: []
      }
      ai_usage_tracking: {
        Row: {
          analysis_type: string
          cache_creation_tokens: number
          cache_read_tokens: number
          created_at: string
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          estimated_cost_usd: number
          id: string
          input_tokens: number
          model_used: string
          output_tokens: number
          status: string
        }
        Insert: {
          analysis_type: string
          cache_creation_tokens?: number
          cache_read_tokens?: number
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          model_used: string
          output_tokens?: number
          status?: string
        }
        Update: {
          analysis_type?: string
          cache_creation_tokens?: number
          cache_read_tokens?: number
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          model_used?: string
          output_tokens?: number
          status?: string
        }
        Relationships: []
      }
      antt_floor_rates: {
        Row: {
          axes_count: number
          cargo_type: string
          cc: number
          ccd: number
          created_at: string
          created_by: string | null
          id: string
          operation_table: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          axes_count: number
          cargo_type: string
          cc: number
          ccd: number
          created_at?: string
          created_by?: string | null
          id?: string
          operation_table: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          axes_count?: number
          cargo_type?: string
          cc?: number
          ccd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          operation_table?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      approval_requests: {
        Row: {
          ai_analysis: Json | null
          approval_type: string
          assigned_to: string | null
          assigned_to_role: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          description: string | null
          entity_id: string
          entity_type: string
          expires_at: string | null
          id: string
          requested_by: string | null
          resolved_at: string | null
          status: string
          title: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          approval_type: string
          assigned_to?: string | null
          assigned_to_role?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          expires_at?: string | null
          id?: string
          requested_by?: string | null
          resolved_at?: string | null
          status?: string
          title: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          approval_type?: string
          assigned_to?: string | null
          assigned_to_role?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          id?: string
          requested_by?: string | null
          resolved_at?: string | null
          status?: string
          title?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      approval_rules: {
        Row: {
          active: boolean
          approval_type: string
          approver_role: string
          auto_approve_after_hours: number | null
          created_at: string
          entity_type: string
          id: string
          name: string
          trigger_condition: Json
        }
        Insert: {
          active?: boolean
          approval_type: string
          approver_role?: string
          auto_approve_after_hours?: number | null
          created_at?: string
          entity_type: string
          id?: string
          name: string
          trigger_condition: Json
        }
        Update: {
          active?: boolean
          approval_type?: string
          approver_role?: string
          auto_approve_after_hours?: number | null
          created_at?: string
          entity_type?: string
          id?: string
          name?: string
          trigger_condition?: Json
        }
        Relationships: []
      }
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
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          cnpj_mask: string | null
          contact_name: string | null
          cpf: number | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
          zip_code_mask: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          cnpj_mask?: string | null
          contact_name?: string | null
          cpf?: number | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
          zip_code_mask?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          cnpj_mask?: string | null
          contact_name?: string | null
          cpf?: number | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
          zip_code_mask?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      compliance_checks: {
        Row: {
          ai_analysis: Json | null
          check_type: Database["public"]["Enums"]["compliance_check_type"]
          created_at: string
          entity_type: string | null
          id: string
          order_id: string | null
          result: Json | null
          rules_evaluated: Json
          status: Database["public"]["Enums"]["compliance_check_status"]
          violation_type: string | null
          violations: Json
        }
        Insert: {
          ai_analysis?: Json | null
          check_type: Database["public"]["Enums"]["compliance_check_type"]
          created_at?: string
          entity_type?: string | null
          id?: string
          order_id?: string | null
          result?: Json | null
          rules_evaluated?: Json
          status?: Database["public"]["Enums"]["compliance_check_status"]
          violation_type?: string | null
          violations?: Json
        }
        Update: {
          ai_analysis?: Json | null
          check_type?: Database["public"]["Enums"]["compliance_check_type"]
          created_at?: string
          entity_type?: string | null
          id?: string
          order_id?: string | null
          result?: Json | null
          rules_evaluated?: Json
          status?: Database["public"]["Enums"]["compliance_check_status"]
          violation_type?: string | null
          violations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "compliance_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "compliance_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "compliance_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "compliance_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "compliance_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
        ]
      }
      conditional_fees: {
        Row: {
          active: boolean
          applies_to: string
          code: string
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          fee_type: string
          fee_value: number
          id: string
          max_value: number | null
          min_value: number | null
          name: string
          updated_at: string
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          applies_to?: string
          code: string
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fee_type: string
          fee_value: number
          id?: string
          max_value?: number | null
          min_value?: number | null
          name: string
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          applies_to?: string
          code?: string
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fee_type?: string
          fee_value?: number
          id?: string
          max_value?: number | null
          min_value?: number | null
          name?: string
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      delivery_assessments: {
        Row: {
          alertas: Json | null
          cargo_type: string | null
          carroceria_recomendada: string | null
          chapas_recomendados: number | null
          chapas_solicitados: number | null
          cidade: string | null
          created_at: string | null
          custo_chapas_rs: number | null
          endereco: string
          endereco_formatado: string | null
          equipamento_apoio: string | null
          estado: string | null
          id: string
          lat: number | null
          lng: number | null
          maps_url: string | null
          nivel_dificuldade: string | null
          notas: string | null
          order_id: string | null
          perguntas_pendentes: Json | null
          peso_kg: number | null
          quote_id: string | null
          respostas_qualificacao: Json | null
          restricao_aet: Json | null
          score_detalhado: Json | null
          score_total: number | null
          status: string | null
          street_view_disponivel: boolean | null
          street_view_url: string | null
          updated_at: string | null
          veiculo_recomendado: string | null
          volume_m3: number | null
          volumes: number | null
        }
        Insert: {
          alertas?: Json | null
          cargo_type?: string | null
          carroceria_recomendada?: string | null
          chapas_recomendados?: number | null
          chapas_solicitados?: number | null
          cidade?: string | null
          created_at?: string | null
          custo_chapas_rs?: number | null
          endereco: string
          endereco_formatado?: string | null
          equipamento_apoio?: string | null
          estado?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          maps_url?: string | null
          nivel_dificuldade?: string | null
          notas?: string | null
          order_id?: string | null
          perguntas_pendentes?: Json | null
          peso_kg?: number | null
          quote_id?: string | null
          respostas_qualificacao?: Json | null
          restricao_aet?: Json | null
          score_detalhado?: Json | null
          score_total?: number | null
          status?: string | null
          street_view_disponivel?: boolean | null
          street_view_url?: string | null
          updated_at?: string | null
          veiculo_recomendado?: string | null
          volume_m3?: number | null
          volumes?: number | null
        }
        Update: {
          alertas?: Json | null
          cargo_type?: string | null
          carroceria_recomendada?: string | null
          chapas_recomendados?: number | null
          chapas_solicitados?: number | null
          cidade?: string | null
          created_at?: string | null
          custo_chapas_rs?: number | null
          endereco?: string
          endereco_formatado?: string | null
          equipamento_apoio?: string | null
          estado?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          maps_url?: string | null
          nivel_dificuldade?: string | null
          notas?: string | null
          order_id?: string | null
          perguntas_pendentes?: Json | null
          peso_kg?: number | null
          quote_id?: string | null
          respostas_qualificacao?: Json | null
          restricao_aet?: Json | null
          score_detalhado?: Json | null
          score_total?: number | null
          status?: string | null
          street_view_disponivel?: boolean | null
          street_view_url?: string | null
          updated_at?: string | null
          veiculo_recomendado?: string | null
          volume_m3?: number | null
          volumes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assessments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assessments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_assessments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_assessments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_assessments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_assessments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_assessments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assessments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "delivery_assessments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_payment_reconciliation"
            referencedColumns: ["quote_id"]
          },
        ]
      }
      delivery_conditions: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      discharge_checklist_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          fat_id: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          nfe_key: string | null
          order_id: string | null
          quote_id: string | null
          source: string
          trip_id: string | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          uploaded_by: string
          validation_status: string | null
        }
        Insert: {
          created_at?: string
          fat_id?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          nfe_key?: string | null
          order_id?: string | null
          quote_id?: string | null
          source?: string
          trip_id?: string | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by: string
          validation_status?: string | null
        }
        Update: {
          created_at?: string
          fat_id?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          nfe_key?: string | null
          order_id?: string | null
          quote_id?: string | null
          source?: string
          trip_id?: string | null
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
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_payment_reconciliation"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      driver_qualifications: {
        Row: {
          ai_analysis: Json | null
          checklist: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          driver_cpf: string | null
          driver_id: string | null
          driver_name: string | null
          expires_at: string | null
          id: string
          order_id: string
          qualification_type: string | null
          risk_flags: Json
          risk_score: number | null
          status: Database["public"]["Enums"]["driver_qualification_status"]
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          checklist?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          driver_cpf?: string | null
          driver_id?: string | null
          driver_name?: string | null
          expires_at?: string | null
          id?: string
          order_id: string
          qualification_type?: string | null
          risk_flags?: Json
          risk_score?: number | null
          status?: Database["public"]["Enums"]["driver_qualification_status"]
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          checklist?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          driver_cpf?: string | null
          driver_id?: string | null
          driver_name?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string
          qualification_type?: string | null
          risk_flags?: Json
          risk_score?: number | null
          status?: Database["public"]["Enums"]["driver_qualification_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_qualifications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_qualifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_qualifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "driver_qualifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "driver_qualifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "driver_qualifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "driver_qualifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          antt: string | null
          cnh: string | null
          cnh_category: string | null
          cooldown_days: number | null
          cpf: string | null
          created_at: string
          id: string
          last_refusal_at: string | null
          name: string
          phone: string | null
          phone_normalized: string | null
          refusal_count: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          antt?: string | null
          cnh?: string | null
          cnh_category?: string | null
          cooldown_days?: number | null
          cpf?: string | null
          created_at?: string
          id?: string
          last_refusal_at?: string | null
          name: string
          phone?: string | null
          phone_normalized?: string | null
          refusal_count?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          antt?: string | null
          cnh?: string | null
          cnh_category?: string | null
          cooldown_days?: number | null
          cpf?: string | null
          created_at?: string
          id?: string
          last_refusal_at?: string | null
          name?: string
          phone?: string | null
          phone_normalized?: string | null
          refusal_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      edge_function_api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          last_used: string | null
          name: string
          scopes: string[]
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          last_used?: string | null
          name: string
          scopes?: string[]
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          last_used?: string | null
          name?: string
          scopes?: string[]
        }
        Relationships: []
      }
      equipment_rental_rates: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          unit: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          unit?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          unit?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      financial_documents: {
        Row: {
          code: string | null
          created_at: string
          erp_reference: string | null
          erp_status: string | null
          id: string
          notes: string | null
          owner_id: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["financial_source_type"]
          status: string
          total_amount: number | null
          type: Database["public"]["Enums"]["financial_doc_type"]
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          erp_reference?: string | null
          erp_status?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          source_id: string
          source_type: Database["public"]["Enums"]["financial_source_type"]
          status?: string
          total_amount?: number | null
          type: Database["public"]["Enums"]["financial_doc_type"]
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          erp_reference?: string | null
          erp_status?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          source_id?: string
          source_type?: Database["public"]["Enums"]["financial_source_type"]
          status?: string
          total_amount?: number | null
          type?: Database["public"]["Enums"]["financial_doc_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_installments: {
        Row: {
          amount: number | null
          created_at: string
          due_date: string
          financial_document_id: string
          id: string
          payment_method: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["financial_installment_status"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          due_date: string
          financial_document_id: string
          id?: string
          payment_method?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["financial_installment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          due_date?: string
          financial_document_id?: string
          id?: string
          payment_method?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["financial_installment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_installments_financial_document_id_fkey"
            columns: ["financial_document_id"]
            isOneToOne: false
            referencedRelation: "financial_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_installments_financial_document_id_fkey"
            columns: ["financial_document_id"]
            isOneToOne: false
            referencedRelation: "financial_documents_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_installments_financial_document_id_fkey"
            columns: ["financial_document_id"]
            isOneToOne: false
            referencedRelation: "financial_payable_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_installments_financial_document_id_fkey"
            columns: ["financial_document_id"]
            isOneToOne: false
            referencedRelation: "financial_receivable_kanban"
            referencedColumns: ["id"]
          },
        ]
      }
      gris_services: {
        Row: {
          code: string
          created_at: string
          default_percent: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_percent?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_percent?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      icms_rates: {
        Row: {
          created_at: string
          created_by: string | null
          destination_state: string
          id: string
          origin_state: string
          rate_percent: number
          updated_at: string
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_state: string
          id?: string
          origin_state: string
          rate_percent: number
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_state?: string
          id?: string
          origin_state?: string
          rate_percent?: number
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icms_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insurance_logs: {
        Row: {
          created_at: string
          destination_uf: string | null
          duration_ms: number | null
          environment: string
          error_code: string | null
          error_message: string | null
          fallback_used: boolean
          function_name: string
          id: string
          origin_uf: string | null
          premium_estimate_cents: number | null
          product_type: string | null
          raw: Json | null
          request_id: string | null
          source: string
          status: string
          trace_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string
          destination_uf?: string | null
          duration_ms?: number | null
          environment?: string
          error_code?: string | null
          error_message?: string | null
          fallback_used?: boolean
          function_name?: string
          id?: string
          origin_uf?: string | null
          premium_estimate_cents?: number | null
          product_type?: string | null
          raw?: Json | null
          request_id?: string | null
          source?: string
          status: string
          trace_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string
          destination_uf?: string | null
          duration_ms?: number | null
          environment?: string
          error_code?: string | null
          error_message?: string | null
          fallback_used?: boolean
          function_name?: string
          id?: string
          origin_uf?: string | null
          premium_estimate_cents?: number | null
          product_type?: string | null
          raw?: Json | null
          request_id?: string | null
          source?: string
          status?: string
          trace_id?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      load_composition_discount_breakdown: {
        Row: {
          composition_id: string
          created_at: string | null
          created_by: string | null
          discount_offered_brl: number
          discount_percent: number
          discount_strategy: string | null
          final_margin_brl: number
          final_margin_percent: number
          final_quote_price_brl: number
          id: string
          is_feasible: boolean | null
          margin_rule_source: string | null
          max_discount_allowed_brl: number
          minimum_margin_percent_applied: number
          original_freight_cost_brl: number
          original_margin_brl: number
          original_margin_percent: number
          original_quote_price_brl: number
          quote_id: string
          shipper_id: string
          updated_at: string | null
          validation_warnings: string[] | null
        }
        Insert: {
          composition_id: string
          created_at?: string | null
          created_by?: string | null
          discount_offered_brl?: number
          discount_percent?: number
          discount_strategy?: string | null
          final_margin_brl: number
          final_margin_percent: number
          final_quote_price_brl: number
          id?: string
          is_feasible?: boolean | null
          margin_rule_source?: string | null
          max_discount_allowed_brl: number
          minimum_margin_percent_applied: number
          original_freight_cost_brl: number
          original_margin_brl: number
          original_margin_percent: number
          original_quote_price_brl: number
          quote_id: string
          shipper_id: string
          updated_at?: string | null
          validation_warnings?: string[] | null
        }
        Update: {
          composition_id?: string
          created_at?: string | null
          created_by?: string | null
          discount_offered_brl?: number
          discount_percent?: number
          discount_strategy?: string | null
          final_margin_brl?: number
          final_margin_percent?: number
          final_quote_price_brl?: number
          id?: string
          is_feasible?: boolean | null
          margin_rule_source?: string | null
          max_discount_allowed_brl?: number
          minimum_margin_percent_applied?: number
          original_freight_cost_brl?: number
          original_margin_brl?: number
          original_margin_percent?: number
          original_quote_price_brl?: number
          quote_id?: string
          shipper_id?: string
          updated_at?: string | null
          validation_warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "load_composition_discount_breakdown_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "load_composition_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_discount_breakdown_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "load_composition_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_discount_breakdown_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "load_composition_discount_breakdown_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_discount_breakdown_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "load_composition_discount_breakdown_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_payment_reconciliation"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "load_composition_discount_breakdown_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      load_composition_metrics: {
        Row: {
          co2_reduction_kg: number | null
          composed_km_total: number | null
          composed_total_cost: number | null
          composition_id: string
          created_at: string | null
          id: string
          km_efficiency_percent: number | null
          original_km_total: number | null
          original_total_cost: number | null
          savings_brl: number | null
          savings_percent: number | null
        }
        Insert: {
          co2_reduction_kg?: number | null
          composed_km_total?: number | null
          composed_total_cost?: number | null
          composition_id: string
          created_at?: string | null
          id?: string
          km_efficiency_percent?: number | null
          original_km_total?: number | null
          original_total_cost?: number | null
          savings_brl?: number | null
          savings_percent?: number | null
        }
        Update: {
          co2_reduction_kg?: number | null
          composed_km_total?: number | null
          composed_total_cost?: number | null
          composition_id?: string
          created_at?: string | null
          id?: string
          km_efficiency_percent?: number | null
          original_km_total?: number | null
          original_total_cost?: number | null
          savings_brl?: number | null
          savings_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "load_composition_metrics_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "load_composition_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_metrics_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "load_composition_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      load_composition_routings: {
        Row: {
          composition_id: string
          created_at: string | null
          estimated_arrival: string | null
          id: string
          is_feasible: boolean | null
          leg_distance_km: number | null
          leg_duration_min: number | null
          leg_polyline: string | null
          pickup_window_end: string | null
          pickup_window_start: string | null
          quote_id: string
          route_sequence: number
          toll_centavos: number | null
        }
        Insert: {
          composition_id: string
          created_at?: string | null
          estimated_arrival?: string | null
          id?: string
          is_feasible?: boolean | null
          leg_distance_km?: number | null
          leg_duration_min?: number | null
          leg_polyline?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          quote_id: string
          route_sequence: number
          toll_centavos?: number | null
        }
        Update: {
          composition_id?: string
          created_at?: string | null
          estimated_arrival?: string | null
          id?: string
          is_feasible?: boolean | null
          leg_distance_km?: number | null
          leg_duration_min?: number | null
          leg_polyline?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          quote_id?: string
          route_sequence?: number
          toll_centavos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "load_composition_routings_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "load_composition_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_routings_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "load_composition_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_routings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_routings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "load_composition_routings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_payment_reconciliation"
            referencedColumns: ["quote_id"]
          },
        ]
      }
      load_composition_suggestions: {
        Row: {
          anchor_quote_id: string | null
          approved_at: string | null
          approved_by: string | null
          base_km_total: number | null
          composed_km_total: number | null
          consolidation_score: number
          created_at: string | null
          created_by: string
          created_order_id: string | null
          delta_km_abs: number | null
          delta_km_percent: number | null
          distance_increase_percent: number | null
          encoded_polyline: string | null
          estimated_savings_brl: number | null
          id: string
          is_feasible: boolean | null
          quote_ids: string[]
          route_evaluation_model: string | null
          shipper_id: string
          status: string | null
          suggested_axes_count: number | null
          suggested_vehicle_type_id: string | null
          suggested_vehicle_type_name: string | null
          technical_explanation: string | null
          total_combined_volume_m3: number | null
          total_combined_weight_kg: number | null
          total_toll_centavos: number | null
          total_toll_tag_centavos: number | null
          trigger_source: string
          updated_at: string | null
          url_mapa_view: string | null
          validation_warnings: string[] | null
          webrouter_id_rota: number | null
        }
        Insert: {
          anchor_quote_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_km_total?: number | null
          composed_km_total?: number | null
          consolidation_score?: number
          created_at?: string | null
          created_by: string
          created_order_id?: string | null
          delta_km_abs?: number | null
          delta_km_percent?: number | null
          distance_increase_percent?: number | null
          encoded_polyline?: string | null
          estimated_savings_brl?: number | null
          id?: string
          is_feasible?: boolean | null
          quote_ids: string[]
          route_evaluation_model?: string | null
          shipper_id: string
          status?: string | null
          suggested_axes_count?: number | null
          suggested_vehicle_type_id?: string | null
          suggested_vehicle_type_name?: string | null
          technical_explanation?: string | null
          total_combined_volume_m3?: number | null
          total_combined_weight_kg?: number | null
          total_toll_centavos?: number | null
          total_toll_tag_centavos?: number | null
          trigger_source?: string
          updated_at?: string | null
          url_mapa_view?: string | null
          validation_warnings?: string[] | null
          webrouter_id_rota?: number | null
        }
        Update: {
          anchor_quote_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_km_total?: number | null
          composed_km_total?: number | null
          consolidation_score?: number
          created_at?: string | null
          created_by?: string
          created_order_id?: string | null
          delta_km_abs?: number | null
          delta_km_percent?: number | null
          distance_increase_percent?: number | null
          encoded_polyline?: string | null
          estimated_savings_brl?: number | null
          id?: string
          is_feasible?: boolean | null
          quote_ids?: string[]
          route_evaluation_model?: string | null
          shipper_id?: string
          status?: string | null
          suggested_axes_count?: number | null
          suggested_vehicle_type_id?: string | null
          suggested_vehicle_type_name?: string | null
          technical_explanation?: string | null
          total_combined_volume_m3?: number | null
          total_combined_weight_kg?: number | null
          total_toll_centavos?: number | null
          total_toll_tag_centavos?: number | null
          trigger_source?: string
          updated_at?: string | null
          url_mapa_view?: string | null
          validation_warnings?: string[] | null
          webrouter_id_rota?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "load_composition_suggestions_anchor_quote_id_fkey"
            columns: ["anchor_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_anchor_quote_id_fkey"
            columns: ["anchor_quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_anchor_quote_id_fkey"
            columns: ["anchor_quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_payment_reconciliation"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_created_order_id_fkey"
            columns: ["created_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_created_order_id_fkey"
            columns: ["created_order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_created_order_id_fkey"
            columns: ["created_order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_created_order_id_fkey"
            columns: ["created_order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_created_order_id_fkey"
            columns: ["created_order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_created_order_id_fkey"
            columns: ["created_order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_suggestions_suggested_vehicle_type_id_fkey"
            columns: ["suggested_vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ltl_parameters: {
        Row: {
          correction_factor: number
          created_at: string
          cubage_factor: number
          dispatch_fee: number
          gris_high_risk_percent: number
          gris_min: number
          gris_min_cargo_limit: number
          gris_percent: number
          id: string
          min_freight: number
          min_freight_cargo_limit: number
          min_tso: number
          reference_month: string
        }
        Insert: {
          correction_factor?: number
          created_at?: string
          cubage_factor?: number
          dispatch_fee?: number
          gris_high_risk_percent?: number
          gris_min?: number
          gris_min_cargo_limit?: number
          gris_percent?: number
          id?: string
          min_freight?: number
          min_freight_cargo_limit?: number
          min_tso?: number
          reference_month: string
        }
        Update: {
          correction_factor?: number
          created_at?: string
          cubage_factor?: number
          dispatch_fee?: number
          gris_high_risk_percent?: number
          gris_min?: number
          gris_min_cargo_limit?: number
          gris_percent?: number
          id?: string
          min_freight?: number
          min_freight_cargo_limit?: number
          min_tso?: number
          reference_month?: string
        }
        Relationships: []
      }
      market_indices: {
        Row: {
          alerta_nivel: string
          created_at: string | null
          desp_adm_12meses: number | null
          desp_adm_mensal: number | null
          diesel_comum_12meses: number | null
          diesel_comum_mensal: number | null
          diesel_comum_preco: number | null
          diesel_s10_12meses: number | null
          diesel_s10_mensal: number | null
          diesel_s10_preco: number | null
          fonte_url: string
          gerado_em: string
          id: string
          inctf_12meses: number | null
          inctf_ano: number | null
          inctf_mensal: number | null
          inctl_12meses: number | null
          inctl_ano: number | null
          inctl_mensal: number | null
          lotacao_cavalo_12m: number | null
          lotacao_pneu_12m: number | null
          lotacao_salario_12m: number | null
          lotacao_semirreboque_12m: number | null
          periodo_referencia: string
          reajuste_sugerido_pct: number | null
          resumo_whatsapp: string | null
        }
        Insert: {
          alerta_nivel?: string
          created_at?: string | null
          desp_adm_12meses?: number | null
          desp_adm_mensal?: number | null
          diesel_comum_12meses?: number | null
          diesel_comum_mensal?: number | null
          diesel_comum_preco?: number | null
          diesel_s10_12meses?: number | null
          diesel_s10_mensal?: number | null
          diesel_s10_preco?: number | null
          fonte_url: string
          gerado_em: string
          id?: string
          inctf_12meses?: number | null
          inctf_ano?: number | null
          inctf_mensal?: number | null
          inctl_12meses?: number | null
          inctl_ano?: number | null
          inctl_mensal?: number | null
          lotacao_cavalo_12m?: number | null
          lotacao_pneu_12m?: number | null
          lotacao_salario_12m?: number | null
          lotacao_semirreboque_12m?: number | null
          periodo_referencia: string
          reajuste_sugerido_pct?: number | null
          resumo_whatsapp?: string | null
        }
        Update: {
          alerta_nivel?: string
          created_at?: string | null
          desp_adm_12meses?: number | null
          desp_adm_mensal?: number | null
          diesel_comum_12meses?: number | null
          diesel_comum_mensal?: number | null
          diesel_comum_preco?: number | null
          diesel_s10_12meses?: number | null
          diesel_s10_mensal?: number | null
          diesel_s10_preco?: number | null
          fonte_url?: string
          gerado_em?: string
          id?: string
          inctf_12meses?: number | null
          inctf_ano?: number | null
          inctf_mensal?: number | null
          inctl_12meses?: number | null
          inctl_ano?: number | null
          inctl_mensal?: number | null
          lotacao_cavalo_12m?: number | null
          lotacao_pneu_12m?: number | null
          lotacao_salario_12m?: number | null
          lotacao_semirreboque_12m?: number | null
          periodo_referencia?: string
          reajuste_sugerido_pct?: number | null
          resumo_whatsapp?: string | null
        }
        Relationships: []
      }
      news_items: {
        Row: {
          created_at: string | null
          id: string
          relevance_score: number | null
          source_name: string | null
          source_type: string
          source_url: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          relevance_score?: number | null
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          external_id: string | null
          id: string
          metadata: Json
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
          template_key: string
        }
        Insert: {
          channel: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          template_key: string
        }
        Update: {
          channel?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          template_key?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          payload: Json
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          template: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          active: boolean
          body_template: string
          channel: string
          created_at: string
          html_template: string | null
          id: string
          is_meta_approved: boolean | null
          key: string
          meta_category: string | null
          meta_language_code: string | null
          meta_template_name: string | null
          meta_variables: Json | null
          subject_template: string | null
        }
        Insert: {
          active?: boolean
          body_template: string
          channel?: string
          created_at?: string
          html_template?: string | null
          id?: string
          is_meta_approved?: boolean | null
          key: string
          meta_category?: string | null
          meta_language_code?: string | null
          meta_template_name?: string | null
          meta_variables?: Json | null
          subject_template?: string | null
        }
        Update: {
          active?: boolean
          body_template?: string
          channel?: string
          created_at?: string
          html_template?: string | null
          id?: string
          is_meta_approved?: boolean | null
          key?: string
          meta_category?: string | null
          meta_language_code?: string | null
          meta_template_name?: string | null
          meta_variables?: Json | null
          subject_template?: string | null
        }
        Relationships: []
      }
      ntc_articles_seen: {
        Row: {
          categoria: string | null
          created_at: string | null
          data_pub: string | null
          id: string
          inserido_em: string | null
          motivo_relevancia: string | null
          periodo_referencia: string | null
          precisa_insercao_manual: boolean | null
          resumo_inferido: string | null
          tipo_indice: string | null
          titulo: string
          url: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data_pub?: string | null
          id?: string
          inserido_em?: string | null
          motivo_relevancia?: string | null
          periodo_referencia?: string | null
          precisa_insercao_manual?: boolean | null
          resumo_inferido?: string | null
          tipo_indice?: string | null
          titulo: string
          url: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data_pub?: string | null
          id?: string
          inserido_em?: string | null
          motivo_relevancia?: string | null
          periodo_referencia?: string | null
          precisa_insercao_manual?: boolean | null
          resumo_inferido?: string | null
          tipo_indice?: string | null
          titulo?: string
          url?: string
        }
        Relationships: []
      }
      ntc_cost_indices: {
        Row: {
          created_at: string
          distance_km: number | null
          id: string
          index_type: string
          index_value: number
          period: string
          pickup_km: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          id?: string
          index_type: string
          index_value: number
          period: string
          pickup_km?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          id?: string
          index_type?: string
          index_value?: number
          period?: string
          pickup_km?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ntc_fuel_reference: {
        Row: {
          annual_variation_pct: number | null
          created_at: string
          diesel_price_liter: number
          diesel_price_mg: number | null
          diesel_price_pr: number | null
          diesel_price_rj: number | null
          diesel_price_sp: number | null
          id: string
          monthly_variation_pct: number | null
          notes: string | null
          reference_month: string
          updated_at: string
        }
        Insert: {
          annual_variation_pct?: number | null
          created_at?: string
          diesel_price_liter: number
          diesel_price_mg?: number | null
          diesel_price_pr?: number | null
          diesel_price_rj?: number | null
          diesel_price_sp?: number | null
          id?: string
          monthly_variation_pct?: number | null
          notes?: string | null
          reference_month: string
          updated_at?: string
        }
        Update: {
          annual_variation_pct?: number | null
          created_at?: string
          diesel_price_liter?: number
          diesel_price_mg?: number | null
          diesel_price_pr?: number | null
          diesel_price_rj?: number | null
          diesel_price_sp?: number | null
          id?: string
          monthly_variation_pct?: number | null
          notes?: string | null
          reference_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      ntc_scrape_log: {
        Row: {
          dia_semana: number | null
          duration_ms: number | null
          error_message: string | null
          gerado_em: string | null
          hora_brt: number | null
          hora_utc: number | null
          http_status: number | null
          id: string
          is_new_period: boolean | null
          periodo_referencia: string | null
          response_preview: string | null
          scraped_at: string
          status: string
        }
        Insert: {
          dia_semana?: number | null
          duration_ms?: number | null
          error_message?: string | null
          gerado_em?: string | null
          hora_brt?: number | null
          hora_utc?: number | null
          http_status?: number | null
          id?: string
          is_new_period?: boolean | null
          periodo_referencia?: string | null
          response_preview?: string | null
          scraped_at?: string
          status: string
        }
        Update: {
          dia_semana?: number | null
          duration_ms?: number | null
          error_message?: string | null
          gerado_em?: string | null
          hora_brt?: number | null
          hora_utc?: number | null
          http_status?: number | null
          id?: string
          is_new_period?: boolean | null
          periodo_referencia?: string | null
          response_preview?: string | null
          scraped_at?: string
          status?: string
        }
        Relationships: []
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
            foreignKeyName: "occurrences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "occurrences_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      operational_reports: {
        Row: {
          analysis: Json | null
          created_at: string
          data: Json
          id: string
          report_date: string
          report_type: string
          sent_at: string | null
          sent_via: string | null
          summary_text: string | null
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          data?: Json
          id?: string
          report_date: string
          report_type?: string
          sent_at?: string | null
          sent_via?: string | null
          summary_text?: string | null
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          data?: Json
          id?: string
          report_date?: string
          report_type?: string
          sent_at?: string | null
          sent_via?: string | null
          summary_text?: string | null
        }
        Relationships: []
      }
      order_gris_services: {
        Row: {
          amount_previsto: number | null
          amount_real: number | null
          created_at: string
          gris_service_id: string
          id: string
          order_id: string
          updated_at: string
        }
        Insert: {
          amount_previsto?: number | null
          amount_real?: number | null
          created_at?: string
          gris_service_id: string
          id?: string
          order_id: string
          updated_at?: string
        }
        Update: {
          amount_previsto?: number | null
          amount_real?: number | null
          created_at?: string
          gris_service_id?: string
          id?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_gris_services_gris_service_id_fkey"
            columns: ["gris_service_id"]
            isOneToOne: false
            referencedRelation: "gris_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_gris_services_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_gris_services_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_gris_services_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_gris_services_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_gris_services_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_gris_services_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_to: string | null
          cargo_type: string | null
          cargo_value: number | null
          carreteiro_antt: number | null
          carreteiro_real: number | null
          carrier_advance_date: string | null
          carrier_balance_date: string | null
          carrier_payment_method: string | null
          carrier_payment_term_id: string | null
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string
          descarga_real: number | null
          destination: string
          destination_cep: string | null
          driver_antt: string | null
          driver_cnh: string | null
          driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          eta: string | null
          freight_modality: string | null
          freight_type: string | null
          has_analise_gr: boolean | null
          has_antt: boolean | null
          has_antt_motorista: boolean | null
          has_cnh: boolean | null
          has_comp_residencia: boolean | null
          has_comprovante_descarga: boolean | null
          has_crlv: boolean | null
          has_cte: boolean
          has_doc_rota: boolean | null
          has_gr: boolean | null
          has_mdf: boolean | null
          has_mdfe: boolean | null
          has_nfe: boolean
          has_pod: boolean
          has_vpo: boolean | null
          id: string
          km_distance: number | null
          notes: string | null
          origin: string
          origin_cep: string | null
          os_number: string
          owner_name: string | null
          owner_phone: string | null
          payment_method: string | null
          payment_term_id: string | null
          pedagio_charge_type:
            | Database["public"]["Enums"]["pedagio_charge_type"]
            | null
          pedagio_debitado_no_cte: boolean | null
          pedagio_real: number | null
          price_table_id: string | null
          pricing_breakdown: Json | null
          quote_id: string | null
          risk_evaluation_id: string | null
          shipper_id: string | null
          shipper_name: string | null
          stage: Database["public"]["Enums"]["order_stage"]
          toll_value: number | null
          trip_id: string | null
          updated_at: string
          value: number
          vehicle_brand: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type_id: string | null
          vehicle_type_name: string | null
          volume: number | null
          waiting_time_cost: number | null
          waiting_time_hours: number | null
          weight: number | null
        }
        Insert: {
          assigned_to?: string | null
          cargo_type?: string | null
          cargo_value?: number | null
          carreteiro_antt?: number | null
          carreteiro_real?: number | null
          carrier_advance_date?: string | null
          carrier_balance_date?: string | null
          carrier_payment_method?: string | null
          carrier_payment_term_id?: string | null
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by: string
          descarga_real?: number | null
          destination: string
          destination_cep?: string | null
          driver_antt?: string | null
          driver_cnh?: string | null
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          eta?: string | null
          freight_modality?: string | null
          freight_type?: string | null
          has_analise_gr?: boolean | null
          has_antt?: boolean | null
          has_antt_motorista?: boolean | null
          has_cnh?: boolean | null
          has_comp_residencia?: boolean | null
          has_comprovante_descarga?: boolean | null
          has_crlv?: boolean | null
          has_cte?: boolean
          has_doc_rota?: boolean | null
          has_gr?: boolean | null
          has_mdf?: boolean | null
          has_mdfe?: boolean | null
          has_nfe?: boolean
          has_pod?: boolean
          has_vpo?: boolean | null
          id?: string
          km_distance?: number | null
          notes?: string | null
          origin: string
          origin_cep?: string | null
          os_number: string
          owner_name?: string | null
          owner_phone?: string | null
          payment_method?: string | null
          payment_term_id?: string | null
          pedagio_charge_type?:
            | Database["public"]["Enums"]["pedagio_charge_type"]
            | null
          pedagio_debitado_no_cte?: boolean | null
          pedagio_real?: number | null
          price_table_id?: string | null
          pricing_breakdown?: Json | null
          quote_id?: string | null
          risk_evaluation_id?: string | null
          shipper_id?: string | null
          shipper_name?: string | null
          stage?: Database["public"]["Enums"]["order_stage"]
          toll_value?: number | null
          trip_id?: string | null
          updated_at?: string
          value?: number
          vehicle_brand?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type_id?: string | null
          vehicle_type_name?: string | null
          volume?: number | null
          waiting_time_cost?: number | null
          waiting_time_hours?: number | null
          weight?: number | null
        }
        Update: {
          assigned_to?: string | null
          cargo_type?: string | null
          cargo_value?: number | null
          carreteiro_antt?: number | null
          carreteiro_real?: number | null
          carrier_advance_date?: string | null
          carrier_balance_date?: string | null
          carrier_payment_method?: string | null
          carrier_payment_term_id?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          descarga_real?: number | null
          destination?: string
          destination_cep?: string | null
          driver_antt?: string | null
          driver_cnh?: string | null
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          eta?: string | null
          freight_modality?: string | null
          freight_type?: string | null
          has_analise_gr?: boolean | null
          has_antt?: boolean | null
          has_antt_motorista?: boolean | null
          has_cnh?: boolean | null
          has_comp_residencia?: boolean | null
          has_comprovante_descarga?: boolean | null
          has_crlv?: boolean | null
          has_cte?: boolean
          has_doc_rota?: boolean | null
          has_gr?: boolean | null
          has_mdf?: boolean | null
          has_mdfe?: boolean | null
          has_nfe?: boolean
          has_pod?: boolean
          has_vpo?: boolean | null
          id?: string
          km_distance?: number | null
          notes?: string | null
          origin?: string
          origin_cep?: string | null
          os_number?: string
          owner_name?: string | null
          owner_phone?: string | null
          payment_method?: string | null
          payment_term_id?: string | null
          pedagio_charge_type?:
            | Database["public"]["Enums"]["pedagio_charge_type"]
            | null
          pedagio_debitado_no_cte?: boolean | null
          pedagio_real?: number | null
          price_table_id?: string | null
          pricing_breakdown?: Json | null
          quote_id?: string | null
          risk_evaluation_id?: string | null
          shipper_id?: string | null
          shipper_name?: string | null
          stage?: Database["public"]["Enums"]["order_stage"]
          toll_value?: number | null
          trip_id?: string | null
          updated_at?: string
          value?: number
          vehicle_brand?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type_id?: string | null
          vehicle_type_name?: string | null
          volume?: number | null
          waiting_time_cost?: number | null
          waiting_time_hours?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_carrier_payment_term_id_fkey"
            columns: ["carrier_payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_payment_reconciliation"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
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
          cpf_cnpj_mask: string | null
          created_at: string
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
          zip_code_mask: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          cpf_cnpj_mask?: string | null
          created_at?: string
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
          zip_code_mask?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          cpf_cnpj_mask?: string | null
          created_at?: string
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
          zip_code_mask?: string | null
        }
        Relationships: []
      }
      partner_quotes: {
        Row: {
          cargo_value: number
          client_cnpj: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          destination_cep: string
          destination_city: string
          destination_state: string | null
          freight_value: number | null
          id: string
          km_distance: number | null
          modality: string
          notes: string | null
          origin_cep: string
          origin_city: string
          pricing_breakdown: Json | null
          shipper_id: string
          status: string | null
          toll_value: number | null
          updated_at: string | null
          user_id: string
          vehicle_type: string | null
          weight_kg: number
        }
        Insert: {
          cargo_value: number
          client_cnpj?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          destination_cep: string
          destination_city: string
          destination_state?: string | null
          freight_value?: number | null
          id?: string
          km_distance?: number | null
          modality: string
          notes?: string | null
          origin_cep: string
          origin_city: string
          pricing_breakdown?: Json | null
          shipper_id: string
          status?: string | null
          toll_value?: number | null
          updated_at?: string | null
          user_id: string
          vehicle_type?: string | null
          weight_kg: number
        }
        Update: {
          cargo_value?: number
          client_cnpj?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          destination_cep?: string
          destination_city?: string
          destination_state?: string | null
          freight_value?: number | null
          id?: string
          km_distance?: number | null
          modality?: string
          notes?: string | null
          origin_cep?: string
          origin_city?: string
          pricing_breakdown?: Json | null
          shipper_id?: string
          status?: string | null
          toll_value?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle_type?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_quotes_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "partner_shippers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_shippers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          origin_cep: string
          origin_city: string
          primary_color: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          origin_cep: string
          origin_city: string
          primary_color?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          origin_cep?: string
          origin_city?: string
          primary_color?: string | null
          slug?: string
        }
        Relationships: []
      }
      partner_tokens: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          origin_cep: string
          origin_city: string
          partner_name: string
          partner_slug: string
          primary_color: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          origin_cep: string
          origin_city: string
          partner_name: string
          partner_slug: string
          primary_color?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          origin_cep?: string
          origin_city?: string
          partner_name?: string
          partner_slug?: string
          primary_color?: string | null
          token?: string
        }
        Relationships: []
      }
      partner_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          last_login: string | null
          name: string
          password_hash: string
          shipper_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          name: string
          password_hash: string
          shipper_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          name?: string
          password_hash?: string
          shipper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_users_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "partner_shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          amount: number | null
          created_at: string
          document_id: string
          expected_amount: number | null
          extracted_fields: Json
          extraction_confidence: number | null
          id: string
          method: string | null
          order_id: string
          paid_at: string | null
          payee_document: string | null
          payee_name: string | null
          proof_type: string
          status: string
          transaction_id: string | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          document_id: string
          expected_amount?: number | null
          extracted_fields?: Json
          extraction_confidence?: number | null
          id?: string
          method?: string | null
          order_id: string
          paid_at?: string | null
          payee_document?: string | null
          payee_name?: string | null
          proof_type: string
          status?: string
          transaction_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          document_id?: string
          expected_amount?: number | null
          extracted_fields?: Json
          extraction_confidence?: number | null
          id?: string
          method?: string | null
          order_id?: string
          paid_at?: string | null
          payee_document?: string | null
          payee_name?: string | null
          proof_type?: string
          status?: string
          transaction_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "order_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payment_proofs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "payment_proofs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "payment_proofs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          active: boolean
          adjustment_percent: number
          advance_percent: number | null
          code: string
          created_at: string
          created_by: string | null
          days: number
          id: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          adjustment_percent?: number
          advance_percent?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          days: number
          id?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          adjustment_percent?: number
          advance_percent?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          days?: number
          id?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      petrobras_diesel_prices: {
        Row: {
          fetched_at: string
          id: string
          parcela_biodiesel: number | null
          parcela_distribuicao: number | null
          parcela_icms: number | null
          parcela_impostos_federais: number | null
          parcela_petrobras: number | null
          periodo_coleta: string | null
          preco_medio: number
          uf: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          parcela_biodiesel?: number | null
          parcela_distribuicao?: number | null
          parcela_icms?: number | null
          parcela_impostos_federais?: number | null
          parcela_petrobras?: number | null
          periodo_coleta?: string | null
          preco_medio: number
          uf: string
        }
        Update: {
          fetched_at?: string
          id?: string
          parcela_biodiesel?: number | null
          parcela_distribuicao?: number | null
          parcela_icms?: number | null
          parcela_impostos_federais?: number | null
          parcela_petrobras?: number | null
          periodo_coleta?: string | null
          preco_medio?: number
          uf?: string
        }
        Relationships: []
      }
      price_table_rows: {
        Row: {
          ad_valorem_percent: number | null
          cost_per_kg: number | null
          cost_per_ton: number | null
          cost_value_percent: number | null
          created_at: string
          gris_percent: number | null
          id: string
          km_from: number
          km_to: number
          price_table_id: string
          toll_percent: number | null
          tso_percent: number | null
          user_id: string | null
          weight_rate_10: number | null
          weight_rate_100: number | null
          weight_rate_150: number | null
          weight_rate_20: number | null
          weight_rate_200: number | null
          weight_rate_30: number | null
          weight_rate_50: number | null
          weight_rate_70: number | null
          weight_rate_above_200: number | null
        }
        Insert: {
          ad_valorem_percent?: number | null
          cost_per_kg?: number | null
          cost_per_ton?: number | null
          cost_value_percent?: number | null
          created_at?: string
          gris_percent?: number | null
          id?: string
          km_from: number
          km_to: number
          price_table_id: string
          toll_percent?: number | null
          tso_percent?: number | null
          user_id?: string | null
          weight_rate_10?: number | null
          weight_rate_100?: number | null
          weight_rate_150?: number | null
          weight_rate_20?: number | null
          weight_rate_200?: number | null
          weight_rate_30?: number | null
          weight_rate_50?: number | null
          weight_rate_70?: number | null
          weight_rate_above_200?: number | null
        }
        Update: {
          ad_valorem_percent?: number | null
          cost_per_kg?: number | null
          cost_per_ton?: number | null
          cost_value_percent?: number | null
          created_at?: string
          gris_percent?: number | null
          id?: string
          km_from?: number
          km_to?: number
          price_table_id?: string
          toll_percent?: number | null
          tso_percent?: number | null
          user_id?: string | null
          weight_rate_10?: number | null
          weight_rate_100?: number | null
          weight_rate_150?: number | null
          weight_rate_20?: number | null
          weight_rate_200?: number | null
          weight_rate_30?: number | null
          weight_rate_50?: number | null
          weight_rate_70?: number | null
          weight_rate_above_200?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_table_rows_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tables: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          modality: string
          name: string
          updated_at: string
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          modality: string
          name: string
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          modality?: string
          name?: string
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_tables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pricing_parameters: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          unit: string | null
          updated_at: string
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      pricing_route_overrides: {
        Row: {
          cargo_type: string | null
          created_at: string | null
          description: string | null
          destination_city: string | null
          destination_uf: string
          id: string
          is_active: boolean
          modality: string | null
          notes: string | null
          origin_city: string | null
          origin_uf: string
          override_type: string | null
          override_value: number | null
          profit_margin_percent: number | null
          updated_at: string | null
        }
        Insert: {
          cargo_type?: string | null
          created_at?: string | null
          description?: string | null
          destination_city?: string | null
          destination_uf: string
          id?: string
          is_active?: boolean
          modality?: string | null
          notes?: string | null
          origin_city?: string | null
          origin_uf: string
          override_type?: string | null
          override_value?: number | null
          profit_margin_percent?: number | null
          updated_at?: string | null
        }
        Update: {
          cargo_type?: string | null
          created_at?: string | null
          description?: string | null
          destination_city?: string | null
          destination_uf?: string
          id?: string
          is_active?: boolean
          modality?: string | null
          notes?: string | null
          origin_city?: string | null
          origin_uf?: string
          override_type?: string | null
          override_value?: number | null
          profit_margin_percent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing_rules_config: {
        Row: {
          category: Database["public"]["Enums"]["pricing_rule_category"]
          id: string
          is_active: boolean | null
          key: string
          label: string
          max_value: number | null
          metadata: Json | null
          min_value: number | null
          updated_at: string | null
          value: number
          value_type: Database["public"]["Enums"]["pricing_rule_value_type"]
          vehicle_type_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["pricing_rule_category"]
          id?: string
          is_active?: boolean | null
          key: string
          label: string
          max_value?: number | null
          metadata?: Json | null
          min_value?: number | null
          updated_at?: string | null
          value: number
          value_type: Database["public"]["Enums"]["pricing_rule_value_type"]
          vehicle_type_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["pricing_rule_category"]
          id?: string
          is_active?: boolean | null
          key?: string
          label?: string
          max_value?: number | null
          metadata?: Json | null
          min_value?: number | null
          updated_at?: string | null
          value?: number
          value_type?: Database["public"]["Enums"]["pricing_rule_value_type"]
          vehicle_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_config_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_dimensions: {
        Row: {
          altura_m: number
          box: string | null
          codigo_base: string
          comprimento_m: number
          created_at: string | null
          descricao: string | null
          id: string
          largura_m: number
          peso_kg: number
          supplier: string
          updated_at: string | null
          volume_m3: number | null
        }
        Insert: {
          altura_m: number
          box?: string | null
          codigo_base: string
          comprimento_m: number
          created_at?: string | null
          descricao?: string | null
          id?: string
          largura_m: number
          peso_kg: number
          supplier?: string
          updated_at?: string | null
          volume_m3?: number | null
        }
        Update: {
          altura_m?: number
          box?: string | null
          codigo_base?: string
          comprimento_m?: number
          created_at?: string | null
          descricao?: string | null
          id?: string
          largura_m?: number
          peso_kg?: number
          supplier?: string
          updated_at?: string | null
          volume_m3?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          perfil: Database["public"]["Enums"]["user_profile"] | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          perfil?: Database["public"]["Enums"]["user_profile"] | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          perfil?: Database["public"]["Enums"]["user_profile"] | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quote_payment_proofs: {
        Row: {
          amount: number | null
          created_at: string
          delta_reason: string | null
          document_id: string
          expected_amount: number | null
          extracted_fields: Json
          id: string
          proof_type: string
          quote_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          delta_reason?: string | null
          document_id: string
          expected_amount?: number | null
          extracted_fields?: Json
          id?: string
          proof_type: string
          quote_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          delta_reason?: string | null
          document_id?: string
          expected_amount?: number | null
          extracted_fields?: Json
          id?: string
          proof_type?: string
          quote_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_payment_proofs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_payment_proofs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "order_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_payment_proofs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_payment_proofs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_payment_proofs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_payment_reconciliation"
            referencedColumns: ["quote_id"]
          },
        ]
      }
      quote_route_stops: {
        Row: {
          cep: string | null
          city_uf: string | null
          cnpj: string | null
          created_at: string
          id: string
          label: string | null
          metadata: Json | null
          name: string | null
          planned_km_from_prev: number | null
          quote_id: string
          sequence: number
          stop_type: Database["public"]["Enums"]["route_stop_type"]
          updated_at: string
        }
        Insert: {
          cep?: string | null
          city_uf?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json | null
          name?: string | null
          planned_km_from_prev?: number | null
          quote_id: string
          sequence?: number
          stop_type?: Database["public"]["Enums"]["route_stop_type"]
          updated_at?: string
        }
        Update: {
          cep?: string | null
          city_uf?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json | null
          name?: string | null
          planned_km_from_prev?: number | null
          quote_id?: string
          sequence?: number
          stop_type?: Database["public"]["Enums"]["route_stop_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_route_stops_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_route_stops_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_route_stops_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_payment_reconciliation"
            referencedColumns: ["quote_id"]
          },
        ]
      }
      quotes: {
        Row: {
          additional_shippers: Json
          advance_due_date: string | null
          approval_metadata: Json | null
          approval_status: string | null
          assigned_to: string | null
          balance_due_date: string | null
          billable_weight: number | null
          cargo_type: string | null
          cargo_value: number | null
          client_email: string | null
          client_id: string | null
          client_name: string
          conditional_fees_breakdown: Json | null
          created_at: string
          created_by: string
          cubage_weight: number | null
          delivery_conditions_selected: Json | null
          delivery_notes: string | null
          destination: string
          destination_cep: string | null
          discharge_checklist_selected: Json | null
          discount_value: number | null
          email_sent: boolean
          email_sent_at: string | null
          estimated_loading_date: string | null
          freight_modality: string | null
          freight_type: string | null
          id: string
          is_legacy: boolean
          km_distance: number | null
          notes: string | null
          origin: string
          origin_cep: string | null
          payment_method: string | null
          payment_term_id: string | null
          price_table_id: string | null
          pricing_breakdown: Json | null
          quote_code: string | null
          shipper_email: string | null
          shipper_id: string | null
          shipper_name: string | null
          stage: Database["public"]["Enums"]["quote_stage"]
          tac_percent: number | null
          tags: string[] | null
          toll_value: number | null
          updated_at: string
          validity_date: string | null
          value: number
          vehicle_type_id: string | null
          volume: number | null
          waiting_time_cost: number | null
          weight: number | null
        }
        Insert: {
          additional_shippers?: Json
          advance_due_date?: string | null
          approval_metadata?: Json | null
          approval_status?: string | null
          assigned_to?: string | null
          balance_due_date?: string | null
          billable_weight?: number | null
          cargo_type?: string | null
          cargo_value?: number | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          conditional_fees_breakdown?: Json | null
          created_at?: string
          created_by: string
          cubage_weight?: number | null
          delivery_conditions_selected?: Json | null
          delivery_notes?: string | null
          destination: string
          destination_cep?: string | null
          discharge_checklist_selected?: Json | null
          discount_value?: number | null
          email_sent?: boolean
          email_sent_at?: string | null
          estimated_loading_date?: string | null
          freight_modality?: string | null
          freight_type?: string | null
          id?: string
          is_legacy?: boolean
          km_distance?: number | null
          notes?: string | null
          origin: string
          origin_cep?: string | null
          payment_method?: string | null
          payment_term_id?: string | null
          price_table_id?: string | null
          pricing_breakdown?: Json | null
          quote_code?: string | null
          shipper_email?: string | null
          shipper_id?: string | null
          shipper_name?: string | null
          stage?: Database["public"]["Enums"]["quote_stage"]
          tac_percent?: number | null
          tags?: string[] | null
          toll_value?: number | null
          updated_at?: string
          validity_date?: string | null
          value?: number
          vehicle_type_id?: string | null
          volume?: number | null
          waiting_time_cost?: number | null
          weight?: number | null
        }
        Update: {
          additional_shippers?: Json
          advance_due_date?: string | null
          approval_metadata?: Json | null
          approval_status?: string | null
          assigned_to?: string | null
          balance_due_date?: string | null
          billable_weight?: number | null
          cargo_type?: string | null
          cargo_value?: number | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          conditional_fees_breakdown?: Json | null
          created_at?: string
          created_by?: string
          cubage_weight?: number | null
          delivery_conditions_selected?: Json | null
          delivery_notes?: string | null
          destination?: string
          destination_cep?: string | null
          discharge_checklist_selected?: Json | null
          discount_value?: number | null
          email_sent?: boolean
          email_sent_at?: string | null
          estimated_loading_date?: string | null
          freight_modality?: string | null
          freight_type?: string | null
          id?: string
          is_legacy?: boolean
          km_distance?: number | null
          notes?: string | null
          origin?: string
          origin_cep?: string | null
          payment_method?: string | null
          payment_term_id?: string | null
          price_table_id?: string | null
          pricing_breakdown?: Json | null
          quote_code?: string | null
          shipper_email?: string | null
          shipper_id?: string | null
          shipper_name?: string | null
          stage?: Database["public"]["Enums"]["quote_stage"]
          tac_percent?: number | null
          tags?: string[] | null
          toll_value?: number | null
          updated_at?: string
          validity_date?: string | null
          value?: number
          vehicle_type_id?: string | null
          volume?: number | null
          waiting_time_cost?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quotes_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_updates: {
        Row: {
          action_required: boolean
          ai_analysis: Json | null
          analysis: Json | null
          created_at: string
          id: string
          impact_areas: string[]
          notified: boolean
          published_at: string | null
          recommendation: string | null
          relevance_score: number | null
          source: string
          source_name: string | null
          source_url: string | null
          summary: string | null
          title: string
          url: string | null
        }
        Insert: {
          action_required?: boolean
          ai_analysis?: Json | null
          analysis?: Json | null
          created_at?: string
          id?: string
          impact_areas?: string[]
          notified?: boolean
          published_at?: string | null
          recommendation?: string | null
          relevance_score?: number | null
          source: string
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
          url?: string | null
        }
        Update: {
          action_required?: boolean
          ai_analysis?: Json | null
          analysis?: Json | null
          created_at?: string
          id?: string
          impact_areas?: string[]
          notified?: boolean
          published_at?: string | null
          recommendation?: string | null
          relevance_score?: number | null
          source?: string
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      risk_costs: {
        Row: {
          apportioned: boolean | null
          created_at: string | null
          evaluation_id: string | null
          id: string
          order_id: string | null
          quantity: number | null
          scope: string
          service_code: string
          service_id: string
          total_cost: number
          trip_id: string | null
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          apportioned?: boolean | null
          created_at?: string | null
          evaluation_id?: string | null
          id?: string
          order_id?: string | null
          quantity?: number | null
          scope: string
          service_code: string
          service_id: string
          total_cost: number
          trip_id?: string | null
          unit_cost: number
          updated_at?: string | null
        }
        Update: {
          apportioned?: boolean | null
          created_at?: string | null
          evaluation_id?: string | null
          id?: string
          order_id?: string | null
          quantity?: number | null
          scope?: string
          service_code?: string
          service_id?: string
          total_cost?: number
          trip_id?: string | null
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_costs_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "risk_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_costs_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["evaluation_id"]
          },
          {
            foreignKeyName: "risk_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "risk_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "risk_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "risk_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "risk_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "risk_costs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "risk_services_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "risk_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "risk_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      risk_evaluations: {
        Row: {
          approval_request_id: string | null
          cargo_value_evaluated: number | null
          created_at: string | null
          criticality: Database["public"]["Enums"]["risk_criticality"]
          entity_id: string
          entity_type: string
          evaluated_at: string | null
          evaluated_by: string | null
          evaluation_notes: string | null
          expires_at: string | null
          id: string
          policy_id: string | null
          policy_rules_applied: string[] | null
          requirements: Json
          requirements_met: Json | null
          route_municipalities: string[] | null
          status: Database["public"]["Enums"]["risk_evaluation_status"]
          updated_at: string | null
        }
        Insert: {
          approval_request_id?: string | null
          cargo_value_evaluated?: number | null
          created_at?: string | null
          criticality?: Database["public"]["Enums"]["risk_criticality"]
          entity_id: string
          entity_type: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          evaluation_notes?: string | null
          expires_at?: string | null
          id?: string
          policy_id?: string | null
          policy_rules_applied?: string[] | null
          requirements?: Json
          requirements_met?: Json | null
          route_municipalities?: string[] | null
          status?: Database["public"]["Enums"]["risk_evaluation_status"]
          updated_at?: string | null
        }
        Update: {
          approval_request_id?: string | null
          cargo_value_evaluated?: number | null
          created_at?: string | null
          criticality?: Database["public"]["Enums"]["risk_criticality"]
          entity_id?: string
          entity_type?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          evaluation_notes?: string | null
          expires_at?: string | null
          id?: string
          policy_id?: string | null
          policy_rules_applied?: string[] | null
          requirements?: Json
          requirements_met?: Json | null
          route_municipalities?: string[] | null
          status?: Database["public"]["Enums"]["risk_evaluation_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_evaluations_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "risk_evaluations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "risk_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_evidence: {
        Row: {
          created_at: string | null
          created_by: string | null
          document_id: string | null
          evaluation_id: string
          evidence_type: string
          expires_at: string | null
          id: string
          notes: string | null
          payload: Json
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          evaluation_id: string
          evidence_type: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          payload?: Json
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          evaluation_id?: string
          evidence_type?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          payload?: Json
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_evidence_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "risk_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "order_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_evidence_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "risk_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_evidence_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["evaluation_id"]
          },
        ]
      }
      risk_policies: {
        Row: {
          code: string
          coverage_limit: number | null
          created_at: string | null
          created_by: string | null
          deductible: number | null
          document_url: string | null
          endorsement: string | null
          id: string
          insurer: string | null
          is_active: boolean | null
          metadata: Json | null
          name: string
          policy_type: string
          risk_manager: string | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          coverage_limit?: number | null
          created_at?: string | null
          created_by?: string | null
          deductible?: number | null
          document_url?: string | null
          endorsement?: string | null
          id?: string
          insurer?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          policy_type: string
          risk_manager?: string | null
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          coverage_limit?: number | null
          created_at?: string | null
          created_by?: string | null
          deductible?: number | null
          document_url?: string | null
          endorsement?: string | null
          id?: string
          insurer?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          policy_type?: string
          risk_manager?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      risk_policy_rules: {
        Row: {
          created_at: string | null
          criticality: Database["public"]["Enums"]["risk_criticality"]
          criticality_boost: number | null
          description: string | null
          id: string
          is_active: boolean | null
          policy_id: string
          requirements: Json
          sort_order: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criticality: Database["public"]["Enums"]["risk_criticality"]
          criticality_boost?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          policy_id: string
          requirements?: Json
          sort_order?: number | null
          trigger_config: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criticality?: Database["public"]["Enums"]["risk_criticality"]
          criticality_boost?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          policy_id?: string
          requirements?: Json
          sort_order?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_policy_rules_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "risk_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_services_catalog: {
        Row: {
          code: string
          cost_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          provider: string
          required_when: string | null
          scope: string
          unit_cost: number
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
          validity_days: number | null
        }
        Insert: {
          code: string
          cost_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          provider: string
          required_when?: string | null
          scope?: string
          unit_cost: number
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          validity_days?: number | null
        }
        Update: {
          code?: string
          cost_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          provider?: string
          required_when?: string | null
          scope?: string
          unit_cost?: number
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          validity_days?: number | null
        }
        Relationships: []
      }
      route_metrics_config: {
        Row: {
          created_at: string
          destination_uf: string
          id: string
          is_active: boolean
          max_rs_per_km: number | null
          min_rs_per_km: number | null
          notes: string | null
          origin_uf: string
          target_rs_per_km: number | null
          updated_at: string
          vehicle_type_id: string | null
        }
        Insert: {
          created_at?: string
          destination_uf: string
          id?: string
          is_active?: boolean
          max_rs_per_km?: number | null
          min_rs_per_km?: number | null
          notes?: string | null
          origin_uf: string
          target_rs_per_km?: number | null
          updated_at?: string
          vehicle_type_id?: string | null
        }
        Update: {
          created_at?: string
          destination_uf?: string
          id?: string
          is_active?: boolean
          max_rs_per_km?: number | null
          min_rs_per_km?: number | null
          notes?: string | null
          origin_uf?: string
          target_rs_per_km?: number | null
          updated_at?: string
          vehicle_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_metrics_config_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      shippers: {
        Row: {
          address: string | null
          cep_origem_override: string | null
          city: string | null
          cnpj: string | null
          contact_context: string | null
          contact_name: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          cep_origem_override?: string | null
          city?: string | null
          cnpj?: string | null
          contact_context?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          cep_origem_override?: string | null
          city?: string | null
          cnpj?: string | null
          contact_context?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shippers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tac_rates: {
        Row: {
          adjustment_percent: number
          created_at: string
          created_by: string | null
          diesel_price_base: number
          diesel_price_current: number
          id: string
          reference_date: string
          source_description: string | null
          updated_at: string
          user_id: string | null
          variation_percent: number | null
        }
        Insert: {
          adjustment_percent?: number
          created_at?: string
          created_by?: string | null
          diesel_price_base: number
          diesel_price_current: number
          id?: string
          reference_date: string
          source_description?: string | null
          updated_at?: string
          user_id?: string | null
          variation_percent?: number | null
        }
        Update: {
          adjustment_percent?: number
          created_at?: string
          created_by?: string | null
          diesel_price_base?: number
          diesel_price_current?: number
          id?: string
          reference_date?: string
          source_description?: string | null
          updated_at?: string
          user_id?: string | null
          variation_percent?: number | null
        }
        Relationships: []
      }
      toll_routes: {
        Row: {
          created_at: string
          created_by: string | null
          destination_city: string | null
          destination_state: string
          distance_km: number | null
          id: string
          origin_city: string | null
          origin_state: string
          toll_value: number
          updated_at: string
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
          vehicle_type_id: string | null
          via_description: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_city?: string | null
          destination_state: string
          distance_km?: number | null
          id?: string
          origin_city?: string | null
          origin_state: string
          toll_value: number
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          vehicle_type_id?: string | null
          via_description?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_city?: string | null
          destination_state?: string
          distance_km?: number | null
          id?: string
          origin_city?: string | null
          origin_state?: string
          toll_value?: number
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          vehicle_type_id?: string | null
          via_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "toll_routes_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_cost_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          description: string | null
          id: string
          idempotency_key: string | null
          is_frozen: boolean
          manually_edited_at: string | null
          manually_edited_by: string | null
          order_id: string | null
          reference_id: string | null
          reference_key: string | null
          scope: string
          source: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          is_frozen?: boolean
          manually_edited_at?: string | null
          manually_edited_by?: string | null
          order_id?: string | null
          reference_id?: string | null
          reference_key?: string | null
          scope: string
          source?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          is_frozen?: boolean
          manually_edited_at?: string | null
          manually_edited_by?: string | null
          order_id?: string | null
          reference_id?: string | null
          reference_key?: string | null
          scope?: string
          source?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cost_items_manually_edited_by_fkey"
            columns: ["manually_edited_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trip_cost_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cost_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_cost_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_cost_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_cost_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_cost_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_cost_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_cost_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cost_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_cost_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      trip_orders: {
        Row: {
          apportion_factor: number
          apportion_key: string
          created_at: string
          id: string
          manual_percent: number | null
          order_id: string
          trip_id: string
        }
        Insert: {
          apportion_factor?: number
          apportion_key?: string
          created_at?: string
          id?: string
          manual_percent?: number | null
          order_id: string
          trip_id: string
        }
        Update: {
          apportion_factor?: number
          apportion_key?: string
          created_at?: string
          id?: string
          manual_percent?: number | null
          order_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "trip_orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      trips: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          departure_at: string | null
          driver_id: string
          financial_status: string
          id: string
          notes: string | null
          status_operational: string
          trip_number: string
          updated_at: string
          vehicle_plate: string
          vehicle_type_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          departure_at?: string | null
          driver_id: string
          financial_status?: string
          id?: string
          notes?: string | null
          status_operational?: string
          trip_number: string
          updated_at?: string
          vehicle_plate: string
          vehicle_type_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          departure_at?: string | null
          driver_id?: string
          financial_status?: string
          id?: string
          notes?: string | null
          status_operational?: string
          trip_number?: string
          updated_at?: string
          vehicle_plate?: string
          vehicle_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      unloading_cost_rates: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          unit: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          unit?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          unit?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "valid_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vehicle_types: {
        Row: {
          active: boolean
          ailog_category: string | null
          axes_count: number
          capacity_kg: number | null
          capacity_m3: number | null
          code: string
          created_at: string
          id: string
          name: string
          rolling_type: string | null
          updated_at: string
          user_id: string | null
          vehicle_profile: string | null
        }
        Insert: {
          active?: boolean
          ailog_category?: string | null
          axes_count: number
          capacity_kg?: number | null
          capacity_m3?: number | null
          code: string
          created_at?: string
          id?: string
          name: string
          rolling_type?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_profile?: string | null
        }
        Update: {
          active?: boolean
          ailog_category?: string | null
          axes_count?: number
          capacity_kg?: number | null
          capacity_m3?: number | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          rolling_type?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_profile?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          brand: string | null
          color: string | null
          created_at: string
          driver_id: string | null
          id: string
          model: string | null
          owner_id: string | null
          plate: string
          plate_2: string | null
          plate_2_mask: string | null
          plate_mask: string | null
          renavam: string | null
          updated_at: string
          vehicle_type_id: string | null
          year: number | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          color?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          model?: string | null
          owner_id?: string | null
          plate: string
          plate_2?: string | null
          plate_2_mask?: string | null
          plate_mask?: string | null
          renavam?: string | null
          updated_at?: string
          vehicle_type_id?: string | null
          year?: number | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          color?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          model?: string | null
          owner_id?: string | null
          plate?: string
          plate_2?: string | null
          plate_2_mask?: string | null
          plate_mask?: string | null
          renavam?: string | null
          updated_at?: string
          vehicle_type_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_time_rules: {
        Row: {
          context: string
          created_at: string
          created_by: string | null
          free_hours: number
          id: string
          min_charge: number | null
          rate_per_day: number | null
          rate_per_hour: number | null
          updated_at: string
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
          vehicle_type_id: string | null
        }
        Insert: {
          context?: string
          created_at?: string
          created_by?: string | null
          free_hours?: number
          id?: string
          min_charge?: number | null
          rate_per_day?: number | null
          rate_per_hour?: number | null
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          vehicle_type_id?: string | null
        }
        Update: {
          context?: string
          created_at?: string
          created_by?: string | null
          free_hours?: number
          id?: string
          min_charge?: number | null
          rate_per_day?: number | null
          rate_per_hour?: number | null
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          vehicle_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiting_time_rules_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_definitions: {
        Row: {
          active: boolean
          created_at: string
          entity_type: string
          id: string
          stages: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          entity_type: string
          id?: string
          stages: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          entity_type?: string
          id?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: []
      }
      workflow_event_logs: {
        Row: {
          action: string
          agent: string
          created_at: string
          details: Json | null
          event_id: string | null
          id: string
        }
        Insert: {
          action: string
          agent: string
          created_at?: string
          details?: Json | null
          event_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          agent?: string
          created_at?: string
          details?: Json | null
          event_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_event_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "workflow_events"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          error_message: string | null
          event_type: string
          execute_after: string | null
          id: string
          max_retries: number
          payload: Json
          processed_at: string | null
          retry_count: number
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          event_type: string
          execute_after?: string | null
          id?: string
          max_retries?: number
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          event_type?: string
          execute_after?: string | null
          id?: string
          max_retries?: number
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          status?: string
        }
        Relationships: []
      }
      workflow_transitions: {
        Row: {
          approval_type: string | null
          conditions: Json
          created_at: string
          description: string | null
          from_stage: string
          id: string
          post_actions: Json
          required_documents: Json
          required_fields: Json
          requires_approval: boolean
          to_stage: string
          workflow_id: string
        }
        Insert: {
          approval_type?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          from_stage: string
          id?: string
          post_actions?: Json
          required_documents?: Json
          required_fields?: Json
          requires_approval?: boolean
          to_stage: string
          workflow_id: string
        }
        Update: {
          approval_type?: string | null
          conditions?: Json
          created_at?: string
          description?: string | null
          from_stage?: string
          id?: string
          post_actions?: Json
          required_documents?: Json
          required_fields?: Json
          requires_approval?: boolean
          to_stage?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      financial_documents_kanban: {
        Row: {
          code: string | null
          created_at: string | null
          erp_reference: string | null
          erp_status: string | null
          id: string | null
          installments_pending: number | null
          installments_settled: number | null
          installments_total: number | null
          is_overdue: boolean | null
          next_due_date: string | null
          notes: string | null
          owner_id: string | null
          source_id: string | null
          source_type:
            | Database["public"]["Enums"]["financial_source_type"]
            | null
          status: string | null
          total_amount: number | null
          type: Database["public"]["Enums"]["financial_doc_type"] | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          erp_reference?: string | null
          erp_status?: string | null
          id?: string | null
          installments_pending?: never
          installments_settled?: never
          installments_total?: never
          is_overdue?: never
          next_due_date?: never
          notes?: string | null
          owner_id?: string | null
          source_id?: string | null
          source_type?:
            | Database["public"]["Enums"]["financial_source_type"]
            | null
          status?: string | null
          total_amount?: number | null
          type?: Database["public"]["Enums"]["financial_doc_type"] | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          erp_reference?: string | null
          erp_status?: string | null
          id?: string | null
          installments_pending?: never
          installments_settled?: never
          installments_total?: never
          is_overdue?: never
          next_due_date?: never
          notes?: string | null
          owner_id?: string | null
          source_id?: string | null
          source_type?:
            | Database["public"]["Enums"]["financial_source_type"]
            | null
          status?: string | null
          total_amount?: number | null
          type?: Database["public"]["Enums"]["financial_doc_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payable_kanban: {
        Row: {
          axes_count: number | null
          cargo_type: string | null
          carreteiro_antt: number | null
          carreteiro_real: number | null
          client_name: string | null
          code: string | null
          created_at: string | null
          delta_amount: number | null
          destination: string | null
          destination_cep: string | null
          erp_reference: string | null
          erp_status: string | null
          expected_amount: number | null
          freight_modality: string | null
          freight_type: string | null
          id: string | null
          installments_pending: number | null
          installments_settled: number | null
          installments_total: number | null
          is_overdue: boolean | null
          is_reconciled: boolean | null
          km_distance: number | null
          next_due_date: string | null
          notes: string | null
          order_value: number | null
          origin: string | null
          origin_cep: string | null
          owner_id: string | null
          paid_amount: number | null
          payment_term_adjustment: number | null
          payment_term_advance: number | null
          payment_term_code: string | null
          payment_term_days: number | null
          payment_term_name: string | null
          pricing_breakdown: Json | null
          proofs_count: number | null
          shipper_name: string | null
          source_id: string | null
          source_type:
            | Database["public"]["Enums"]["financial_source_type"]
            | null
          status: string | null
          toll_value: number | null
          total_amount: number | null
          trip_id: string | null
          trip_number: string | null
          type: Database["public"]["Enums"]["financial_doc_type"] | null
          updated_at: string | null
          vehicle_type_code: string | null
          vehicle_type_name: string | null
          volume: number | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      financial_receivable_kanban: {
        Row: {
          axes_count: number | null
          cargo_type: string | null
          client_name: string | null
          code: string | null
          created_at: string | null
          delta_amount: number | null
          destination: string | null
          destination_cep: string | null
          erp_reference: string | null
          erp_status: string | null
          expected_amount: number | null
          freight_modality: string | null
          freight_type: string | null
          id: string | null
          installments_pending: number | null
          installments_settled: number | null
          installments_total: number | null
          is_overdue: boolean | null
          is_reconciled: boolean | null
          km_distance: number | null
          next_due_date: string | null
          notes: string | null
          origin: string | null
          origin_cep: string | null
          owner_id: string | null
          paid_amount: number | null
          payment_term_adjustment: number | null
          payment_term_advance: number | null
          payment_term_code: string | null
          payment_term_days: number | null
          payment_term_name: string | null
          pricing_breakdown: Json | null
          proofs_count: number | null
          quote_value: number | null
          shipper_name: string | null
          source_id: string | null
          source_type:
            | Database["public"]["Enums"]["financial_source_type"]
            | null
          status: string | null
          toll_value: number | null
          total_amount: number | null
          type: Database["public"]["Enums"]["financial_doc_type"] | null
          updated_at: string | null
          vehicle_type_code: string | null
          vehicle_type_name: string | null
          volume: number | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_metrics_error_breakdown: {
        Row: {
          bucket_1h: string | null
          count: number | null
          environment: string | null
          error_code: string | null
          status: string | null
        }
        Relationships: []
      }
      insurance_metrics_latency: {
        Row: {
          bucket_5m: string | null
          environment: string | null
          p50_ms: number | null
          p95_ms: number | null
          p99_ms: number | null
        }
        Relationships: []
      }
      insurance_metrics_volume: {
        Row: {
          bucket_5m: string | null
          environment: string | null
          error_count: number | null
          error_rate: number | null
          fallback_count: number | null
          fallback_ratio: number | null
          rate_limit_count: number | null
          requests_total: number | null
          success_count: number | null
          timeout_count: number | null
        }
        Relationships: []
      }
      load_composition_discount_summary: {
        Row: {
          avg_final_margin_percent: number | null
          composition_id: string | null
          margin_rules_applied: string[] | null
          min_final_margin_percent: number | null
          shipper_count: number | null
          total_discount_offered: number | null
          total_final_price: number | null
          total_original_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "load_composition_discount_breakdown_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "load_composition_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_composition_discount_breakdown_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "load_composition_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      load_composition_summary: {
        Row: {
          approved_at: string | null
          base_km_total: number | null
          composed_km_total: number | null
          consolidation_score: number | null
          created_at: string | null
          delta_km_abs: number | null
          delta_km_percent: number | null
          estimated_savings_brl: number | null
          id: string | null
          num_stops: number | null
          quote_ids: string[] | null
          route_evaluation_model: string | null
          shipper_id: string | null
          status: string | null
          technical_explanation: string | null
          trigger_source: string | null
        }
        Insert: {
          approved_at?: string | null
          base_km_total?: number | null
          composed_km_total?: number | null
          consolidation_score?: number | null
          created_at?: string | null
          delta_km_abs?: number | null
          delta_km_percent?: number | null
          estimated_savings_brl?: number | null
          id?: string | null
          num_stops?: never
          quote_ids?: string[] | null
          route_evaluation_model?: string | null
          shipper_id?: string | null
          status?: string | null
          technical_explanation?: string | null
          trigger_source?: string | null
        }
        Update: {
          approved_at?: string | null
          base_km_total?: number | null
          composed_km_total?: number | null
          consolidation_score?: number | null
          created_at?: string | null
          delta_km_abs?: number | null
          delta_km_percent?: number | null
          estimated_savings_brl?: number | null
          id?: string | null
          num_stops?: never
          quote_ids?: string[] | null
          route_evaluation_model?: string | null
          shipper_id?: string | null
          status?: string | null
          technical_explanation?: string | null
          trigger_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_composition_suggestions_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_documents: {
        Row: {
          created_at: string | null
          file_name: string | null
          id: string | null
          order_id: string | null
          status: string | null
          type: Database["public"]["Enums"]["document_type"] | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          id?: string | null
          order_id?: string | null
          status?: never
          type?: Database["public"]["Enums"]["document_type"] | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          id?: string | null
          order_id?: string | null
          status?: never
          type?: Database["public"]["Enums"]["document_type"] | null
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
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_rs_per_km"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_payment_reconciliation"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_quote_order_divergence"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_trip_financial_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_risk_status"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orders_rs_per_km: {
        Row: {
          carreteiro_real: number | null
          client_name: string | null
          destination: string | null
          km_distance: number | null
          order_date: string | null
          order_id: string | null
          origin: string | null
          os_number: string | null
          rs_per_km: number | null
          tipo: string | null
          trip_id: string | null
          vehicle_type_id: string | null
          vehicle_type_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_financial_summary: {
        Row: {
          custos_diretos: number | null
          custos_os: number | null
          custos_trip: number | null
          driver_id: string | null
          financial_status: string | null
          margem_bruta: number | null
          margem_percent: number | null
          orders_count: number | null
          receita_bruta: number | null
          status_operational: string | null
          trip_id: string | null
          trip_number: string | null
          vehicle_plate: string | null
        }
        Insert: {
          custos_diretos?: never
          custos_os?: never
          custos_trip?: never
          driver_id?: string | null
          financial_status?: string | null
          margem_bruta?: never
          margem_percent?: never
          orders_count?: never
          receita_bruta?: never
          status_operational?: string | null
          trip_id?: string | null
          trip_number?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          custos_diretos?: never
          custos_os?: never
          custos_trip?: never
          driver_id?: string | null
          financial_status?: string | null
          margem_bruta?: never
          margem_percent?: never
          orders_count?: never
          receita_bruta?: never
          status_operational?: string | null
          trip_id?: string | null
          trip_number?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_cash_flow_summary: {
        Row: {
          doc_count: number | null
          pending_amount: number | null
          period: string | null
          settled_amount: number | null
          status: string | null
          total_amount: number | null
          type: Database["public"]["Enums"]["financial_doc_type"] | null
        }
        Relationships: []
      }
      v_order_payment_reconciliation: {
        Row: {
          delta_amount: number | null
          expected_amount: number | null
          has_expected_value: boolean | null
          is_reconciled: boolean | null
          last_paid_at: string | null
          order_id: string | null
          os_number: string | null
          paid_amount: number | null
          proofs_count: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      v_quote_order_divergence: {
        Row: {
          axes_divergence: boolean | null
          client_name: string | null
          delta_km: number | null
          delta_toll: number | null
          delta_value: number | null
          destination: string | null
          margem_percent_prevista: number | null
          order_axes_count: number | null
          order_created_at: string | null
          order_id: string | null
          order_km: number | null
          order_stage: Database["public"]["Enums"]["order_stage"] | null
          order_toll_value: number | null
          order_value: number | null
          origin: string | null
          os_number: string | null
          quote_axes_count: number | null
          quote_code: string | null
          quote_id: string | null
          quote_km: number | null
          quote_toll_value: number | null
          quote_value: number | null
        }
        Relationships: []
      }
      v_quote_payment_reconciliation: {
        Row: {
          delta_amount: number | null
          expected_amount: number | null
          is_reconciled: boolean | null
          paid_amount: number | null
          proofs_count: number | null
          quote_code: string | null
          quote_id: string | null
        }
        Insert: {
          delta_amount?: never
          expected_amount?: never
          is_reconciled?: never
          paid_amount?: never
          proofs_count?: never
          quote_code?: string | null
          quote_id?: string | null
        }
        Update: {
          delta_amount?: never
          expected_amount?: never
          is_reconciled?: never
          paid_amount?: never
          proofs_count?: never
          quote_code?: string | null
          quote_id?: string | null
        }
        Relationships: []
      }
      v_trip_financial_details: {
        Row: {
          carreteiro_previsto: number | null
          carreteiro_real: number | null
          descarga_previsto: number | null
          descarga_real: number | null
          gris_previsto: number | null
          is_avulsa: boolean | null
          order_id: string | null
          os_number: string | null
          pedagio_previsto: number | null
          pedagio_real: number | null
          receita_prevista: number | null
          receita_real: number | null
          trip_id: string | null
          trip_number: string | null
          trip_status: string | null
          tso_previsto: number | null
          vehicle_plate: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      v_trip_payment_reconciliation: {
        Row: {
          all_orders_reconciled: boolean | null
          delta_amount: number | null
          expected_amount: number | null
          financial_status: string | null
          last_paid_at: string | null
          orders_count: number | null
          paid_amount: number | null
          status_operational: string | null
          total_reconciled: boolean | null
          trip_id: string | null
          trip_number: string | null
          trip_reconciled: boolean | null
        }
        Relationships: []
      }
      valid_users: {
        Row: {
          email: string | null
          user_id: string | null
        }
        Insert: {
          email?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vw_ntc_publish_pattern: {
        Row: {
          dia_nome: string | null
          dia_semana: number | null
          hit_rate_pct: number | null
          hora_brt: number | null
          publicacoes_novas: number | null
          scrapes_com_dados: number | null
          total_tentativas: number | null
        }
        Relationships: []
      }
      vw_ntc_scrape_history: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          is_new_period: boolean | null
          periodo_referencia: string | null
          scraped_at_brt: string | null
          status: string | null
        }
        Relationships: []
      }
      vw_order_risk_status: {
        Row: {
          approval_request_id: string | null
          buonny_valid: boolean | null
          cargo_value: number | null
          criticality: Database["public"]["Enums"]["risk_criticality"] | null
          evaluation_id: string | null
          order_id: string | null
          os_number: string | null
          requirements: Json | null
          requirements_met: Json | null
          risk_status:
            | Database["public"]["Enums"]["risk_evaluation_status"]
            | null
          stage: Database["public"]["Enums"]["order_stage"] | null
          total_risk_cost: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_financial_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trip_payment_reconciliation"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "vw_trip_risk_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      vw_trip_risk_summary: {
        Row: {
          all_orders_approved: boolean | null
          max_criticality: string | null
          order_count: number | null
          status_operational: string | null
          total_cargo_value: number | null
          total_risk_cost: number | null
          trip_criticality:
            | Database["public"]["Enums"]["risk_criticality"]
            | null
          trip_id: string | null
          trip_number: string | null
          trip_risk_status:
            | Database["public"]["Enums"]["risk_evaluation_status"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_ai_budget: { Args: never; Returns: Json }
      copy_quote_adiantamento_to_fat: {
        Args: { p_fat_id: string; p_quote_id: string }
        Returns: undefined
      }
      current_user_profile: {
        Args: never
        Returns: Database["public"]["Enums"]["user_profile"]
      }
      ensure_financial_document: {
        Args: {
          doc_type: Database["public"]["Enums"]["financial_doc_type"]
          source_id_in: string
          total_amount_in?: number
        }
        Returns: Json
      }
      find_price_row_by_km: {
        Args: {
          p_km_numeric: number
          p_price_table_id: string
          p_rounding?: string
        }
        Returns: {
          cost_per_ton: number
          id: string
          km_from: number
          km_to: number
          matched_km: number
        }[]
      }
      generate_os_number: { Args: never; Returns: string }
      generate_quote_code: { Args: never; Returns: string }
      generate_trip_number: { Args: never; Returns: string }
      get_ai_daily_spend: { Args: never; Returns: number }
      get_ai_monthly_spend: { Args: never; Returns: number }
      get_ai_usage_stats: { Args: never; Returns: Json }
      get_card_full_data: {
        Args: { p_order_id?: string; p_quote_id?: string }
        Returns: Json
      }
      get_route_metrics: {
        Args: { p_from: string; p_to: string; p_vehicle_type_id?: string }
        Returns: {
          avg_km: number
          avg_paid: number
          avg_rs_per_km: number
          destination_uf: string
          orders_count: number
          origin_uf: string
          p50_rs_per_km: number
          p90_rs_per_km: number
          route_key: string
          vehicle_type_id: string
          vehicle_type_name: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_valid_transitions: {
        Args: { p_entity_type: string; p_from_stage: string }
        Returns: Json
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_profile: {
        Args: { allowed: Database["public"]["Enums"]["user_profile"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      link_order_to_target_trip: {
        Args: { p_order_id: string; p_trip_id: string }
        Returns: string
      }
      link_order_to_trip: { Args: { p_order_id: string }; Returns: string }
      mask_cep: { Args: { input: string }; Returns: string }
      mask_cnpj: { Args: { input: string }; Returns: string }
      mask_cpf: { Args: { input: string }; Returns: string }
      mask_plate: { Args: { input: string }; Returns: string }
      norm_plate: { Args: { input: string }; Returns: string }
      only_digits: { Args: { input: string }; Returns: string }
      set_user_profile: {
        Args: {
          new_profile: Database["public"]["Enums"]["user_profile"]
          target_user_id: string
        }
        Returns: undefined
      }
      sync_cost_items_from_breakdown: {
        Args: { p_trip_id: string }
        Returns: undefined
      }
      validate_api_key: {
        Args: { p_key: string; p_scope: string }
        Returns: boolean
      }
      validate_transition: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_from_stage: string
          p_to_stage: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "comercial" | "operacao" | "financeiro" | "leitura"
      compliance_check_status: "ok" | "warning" | "violation"
      compliance_check_type:
        | "pre_contratacao"
        | "pre_coleta"
        | "pre_entrega"
        | "auditoria_periodica"
      document_type:
        | "nfe"
        | "cte"
        | "pod"
        | "outros"
        | "cnh"
        | "crlv"
        | "comp_residencia"
        | "antt_motorista"
        | "mdfe"
        | "adiantamento"
        | "analise_gr"
        | "doc_rota"
        | "comprovante_vpo"
        | "adiantamento_carreteiro"
        | "saldo_carreteiro"
        | "comprovante_descarga"
        | "a_vista_fat"
        | "saldo_fat"
        | "a_prazo_fat"
      driver_qualification_status:
        | "pendente"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "bloqueado"
      financial_doc_type: "FAT" | "PAG"
      financial_installment_status: "pendente" | "baixado"
      financial_source_type: "quote" | "order"
      occurrence_severity: "baixa" | "media" | "alta" | "critica"
      order_stage:
        | "ordem_criada"
        | "busca_motorista"
        | "documentacao"
        | "coleta_realizada"
        | "em_transito"
        | "entregue"
      pedagio_charge_type:
        | "VALE_PEDAGIO_EMBARCADOR"
        | "PEDAGIO_DEBITADO_CTE"
        | "RATEIO_FRACIONADO"
      pricing_rule_category:
        | "taxa"
        | "estadia"
        | "veiculo"
        | "markup"
        | "imposto"
        | "prazo"
        | "carga_descarga"
        | "aluguel"
        | "risco"
        | "taxas_adicionais"
        | "conteiner"
        | "pedagio"
      pricing_rule_value_type: "fixed" | "percentage" | "per_km" | "per_ton"
      quote_stage:
        | "novo_pedido"
        | "qualificacao"
        | "precificacao"
        | "enviado"
        | "negociacao"
        | "ganho"
        | "perdido"
      risk_criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      risk_evaluation_status:
        | "pending"
        | "evaluated"
        | "approved"
        | "rejected"
        | "expired"
      route_stop_type: "origin" | "stop" | "destination"
      user_profile: "admin" | "operacional" | "financeiro" | "comercial"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "comercial", "operacao", "financeiro", "leitura"],
      compliance_check_status: ["ok", "warning", "violation"],
      compliance_check_type: [
        "pre_contratacao",
        "pre_coleta",
        "pre_entrega",
        "auditoria_periodica",
      ],
      document_type: [
        "nfe",
        "cte",
        "pod",
        "outros",
        "cnh",
        "crlv",
        "comp_residencia",
        "antt_motorista",
        "mdfe",
        "adiantamento",
        "analise_gr",
        "doc_rota",
        "comprovante_vpo",
        "adiantamento_carreteiro",
        "saldo_carreteiro",
        "comprovante_descarga",
        "a_vista_fat",
        "saldo_fat",
        "a_prazo_fat",
      ],
      driver_qualification_status: [
        "pendente",
        "em_analise",
        "aprovado",
        "reprovado",
        "bloqueado",
      ],
      financial_doc_type: ["FAT", "PAG"],
      financial_installment_status: ["pendente", "baixado"],
      financial_source_type: ["quote", "order"],
      occurrence_severity: ["baixa", "media", "alta", "critica"],
      order_stage: [
        "ordem_criada",
        "busca_motorista",
        "documentacao",
        "coleta_realizada",
        "em_transito",
        "entregue",
      ],
      pedagio_charge_type: [
        "VALE_PEDAGIO_EMBARCADOR",
        "PEDAGIO_DEBITADO_CTE",
        "RATEIO_FRACIONADO",
      ],
      pricing_rule_category: [
        "taxa",
        "estadia",
        "veiculo",
        "markup",
        "imposto",
        "prazo",
        "carga_descarga",
        "aluguel",
        "risco",
        "taxas_adicionais",
        "conteiner",
        "pedagio",
      ],
      pricing_rule_value_type: ["fixed", "percentage", "per_km", "per_ton"],
      quote_stage: [
        "novo_pedido",
        "qualificacao",
        "precificacao",
        "enviado",
        "negociacao",
        "ganho",
        "perdido",
      ],
      risk_criticality: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      risk_evaluation_status: [
        "pending",
        "evaluated",
        "approved",
        "rejected",
        "expired",
      ],
      route_stop_type: ["origin", "stop", "destination"],
      user_profile: ["admin", "operacional", "financeiro", "comercial"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.84.2 (currently installed v2.76.6)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
