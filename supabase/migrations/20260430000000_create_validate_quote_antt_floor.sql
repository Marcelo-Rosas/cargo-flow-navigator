-- RPC: validate_quote_antt_floor(quote_id)
-- Retorna JSON indicando se quote.value está abaixo do piso ANTT vigente.
-- Fonte única de verdade usada pela UI (gate PDF, banner, bloqueio CTAs).

CREATE OR REPLACE FUNCTION validate_quote_antt_floor(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value             numeric;
  v_km_distance       numeric;
  v_modality          text;
  v_axes_count        integer;
  v_antt_rate_id      uuid;
  v_ccd               numeric;
  v_cc                numeric;
  v_valid_from        timestamptz;
  v_piso              numeric := 0;
  v_breakdown_ts      text;
  v_is_stale          boolean := false;
  v_km_band           integer;
BEGIN
  -- Resolve cotação + modalidade + eixos
  SELECT
    q.value,
    q.km_distance,
    COALESCE(
      pt.modality,
      CASE WHEN q.pricing_breakdown->>'version' IS NOT NULL THEN
        CASE WHEN (q.pricing_breakdown->'profitability'->>'custoMotoristaAntt')::numeric > 0 THEN 'lotacao' ELSE 'fracionado' END
      END,
      'fracionado'
    ),
    vt.axes_count,
    (q.pricing_breakdown->'meta'->>'anttCalculatedAt')
  INTO v_value, v_km_distance, v_modality, v_axes_count, v_breakdown_ts
  FROM quotes q
  LEFT JOIN price_tables pt ON pt.id = q.price_table_id
  LEFT JOIN vehicle_types vt ON vt.id = q.vehicle_type_id
  WHERE q.id = p_quote_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_below_antt_floor', false,
      'piso', 0,
      'current_value', 0,
      'modality', null,
      'gap', 0,
      'rate_id', null,
      'evaluated_at', now(),
      'is_stale', false,
      'error', 'quote_not_found'
    );
  END IF;

  -- Piso só se aplica à lotação com eixos e km definidos
  IF v_modality = 'lotacao' AND v_axes_count IS NOT NULL AND v_axes_count > 0
     AND v_km_distance IS NOT NULL AND v_km_distance > 0 THEN

    v_km_band := CEIL(v_km_distance);

    SELECT id, ccd, cc, valid_from
    INTO v_antt_rate_id, v_ccd, v_cc, v_valid_from
    FROM antt_floor_rates
    WHERE operation_table = 'A'
      AND cargo_type = 'carga_geral'
      AND axes_count = v_axes_count
    ORDER BY valid_from DESC NULLS LAST
    LIMIT 1;

    IF v_ccd IS NOT NULL AND v_cc IS NOT NULL THEN
      v_piso := ROUND((v_km_band * v_ccd + v_cc)::numeric, 2);
    END IF;

    -- Staleness: breakdown calculado antes da vigência da taxa atual
    IF v_breakdown_ts IS NOT NULL AND v_valid_from IS NOT NULL THEN
      v_is_stale := (v_breakdown_ts::timestamptz < v_valid_from);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_below_antt_floor', (v_modality = 'lotacao' AND v_piso > 0 AND v_value < v_piso),
    'piso', v_piso,
    'current_value', v_value,
    'modality', v_modality,
    'gap', GREATEST(v_piso - COALESCE(v_value, 0), 0),
    'rate_id', v_antt_rate_id,
    'evaluated_at', now(),
    'is_stale', v_is_stale
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_quote_antt_floor(uuid) TO authenticated;
