-- VEC-297: Fix mutable search_path on all flagged functions
-- Prevents search_path injection. Does not alter any function logic.

-- public schema — no-arg functions (mostly triggers / validators)
ALTER FUNCTION public.check_ai_budget()                             SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.enqueue_agent_job()                          SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.fn_risk_evaluation_approved()                SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.generate_trip_number()                       SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_ai_daily_spend()                         SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_ai_monthly_spend()                       SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_ai_usage_stats()                         SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.price_table_rows_no_overlap()                SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.set_updated_at()                             SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.tr_identify_consolidation_on_quote_insert()  SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.tr_identify_consolidation_v7()               SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.update_delivery_assessments_updated_at()     SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.update_driver_qualification_updated_at()     SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.update_load_composition_updated_at()         SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.update_pricing_route_overrides_updated_at()  SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.update_updated_at_column()                   SET search_path = 'public', 'pg_temp';

-- public schema — functions with arguments
ALTER FUNCTION public.create_trip_from_composition(uuid, uuid, numeric, numeric, text)
  SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.find_price_row_by_km(uuid, numeric, text)
  SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_route_metrics(timestamptz, timestamptz, uuid)
  SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.mask_cep(text)    SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.mask_cnpj(text)   SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.mask_cpf(text)    SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.mask_plate(text)  SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.norm_plate(text)  SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.only_digits(text) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.rank_drivers_for_quote(uuid, text, varchar, text, varchar, int, int, int, int, int, int, uuid[])
  SET search_path = 'public', 'pg_temp';

-- vectraclip schema
ALTER FUNCTION vectraclip.agent_execution_configs_sync_company_agent() SET search_path = 'vectraclip', 'public', 'pg_temp';
ALTER FUNCTION vectraclip.handle_updated_at()                          SET search_path = 'vectraclip', 'public', 'pg_temp';
ALTER FUNCTION vectraclip.sipoc_company_id()                           SET search_path = 'vectraclip', 'public', 'pg_temp';
ALTER FUNCTION vectraclip.validate_heartbeat_model_id()                SET search_path = 'vectraclip', 'public', 'pg_temp';
ALTER FUNCTION vectraclip.increment_task_cost(uuid, numeric)           SET search_path = 'vectraclip', 'public', 'pg_temp';
