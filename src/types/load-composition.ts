export type TriggerSource = 'batch' | 'on_save' | 'manual';

export interface LoadCompositionSuggestion {
  id: string;
  shipper_id: string;
  quote_ids: string[];
  consolidation_score: number;
  estimated_savings_brl: number;
  distance_increase_percent: number;
  validation_warnings: string[];
  is_feasible: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  created_order_id?: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  trigger_source: TriggerSource;
  anchor_quote_id?: string;
  technical_explanation?: string;
  delta_km_abs?: number;
  delta_km_percent?: number;
  base_km_total?: number;
  composed_km_total?: number;
  route_evaluation_model?: string;
  suggested_vehicle_type_id?: string | null;
  suggested_vehicle_type_name?: string | null;
  suggested_axes_count?: number | null;
  total_combined_weight_kg?: number | null;
  total_combined_volume_m3?: number | null;
  total_toll_centavos?: number | null;
  total_toll_tag_centavos?: number | null;
  encoded_polyline?: string | null;
  url_mapa_view?: string | null;
  webrouter_id_rota?: number | null;
}

export interface RoutingLeg {
  id: string;
  composition_id: string;
  route_sequence: number;
  quote_id?: string;
  leg_distance_km: number;
  leg_duration_min: number;
  leg_polyline: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
  estimated_arrival?: string;
  is_feasible: boolean;
  created_at: string;
}

export interface CompositionMetric {
  id: string;
  composition_id: string;
  original_total_cost: number;
  composed_total_cost: number;
  savings_brl: number;
  savings_percent: number;
  original_km_total: number;
  composed_km_total: number;
  km_efficiency_percent?: number;
  co2_reduction_kg?: number;
  created_at: string;
}

export interface DiscountProposal {
  id: string;
  composition_id: string;
  quote_id: string;
  shipper_id: string;
  original_quote_price_brl: number;
  original_freight_cost_brl: number;
  original_margin_brl: number;
  original_margin_percent: number;
  max_discount_allowed_brl: number;
  discount_offered_brl: number;
  discount_percent: number;
  final_quote_price_brl: number;
  final_margin_brl: number;
  final_margin_percent: number;
  margin_rule_source: string;
  minimum_margin_percent_applied: number;
  discount_strategy: string;
  is_feasible: boolean;
  validation_warnings: string[];
  created_by?: string;
  created_at: string;
}

export interface LoadCompositionSuggestionWithDetails extends LoadCompositionSuggestion {
  routings?: RoutingLeg[];
  metrics?: CompositionMetric;
  discounts?: DiscountProposal[];
}
