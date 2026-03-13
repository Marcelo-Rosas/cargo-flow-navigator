-- =============================================================================
-- AUDITORIA POS-DEPLOY | Central de Regras + UI + Fallbacks (Pricing 360)
-- =============================================================================
-- Uso:
-- 1) Ajuste o quote_code na CTE "params" se quiser auditar outra cotacao alvo.
-- 2) Rode o arquivo inteiro no SQL Editor do Supabase.
-- 3) Leia os resultados em ordem de secoes.
--
-- Objetivo:
-- - Verificar migracao de aluguel/carga_descarga para pricing_rules_config
-- - Detectar conflitos/duplicidades de regras ativas
-- - Validar regras de risco (GRIS/TSO/RCTR-C) na Central
-- - Comparar "valor esperado" (faixa km + fallback Central) x breakdown salvo
-- - Auditar taxas condicionais (fonte: conditional_fees, nao pricing_rules_config)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PARAMETROS
-- ---------------------------------------------------------------------------
with params as (
  select
    'COT-2026-03-0006'::text as quote_code,
    100::int as sample_size
)
select * from params;

-- ---------------------------------------------------------------------------
-- 1) Snapshot da Central de Regras (categorias criticas)
-- ---------------------------------------------------------------------------
select
  pr.id,
  pr.key,
  pr.label,
  pr.category,
  pr.value_type,
  pr.value,
  pr.is_active,
  pr.vehicle_type_id,
  pr.metadata ->> 'unit' as unit,
  pr.metadata ->> 'legacy_table' as legacy_table,
  pr.metadata ->> 'legacy_id' as legacy_id,
  pr.updated_at
from public.pricing_rules_config pr
where pr.category in ('aluguel', 'carga_descarga', 'risco')
   or pr.key in (
     'gris_percent',
     'tso_percent',
     'cost_value_percent',
     'loading_unloading_fixed',
     'equipment_rental_forklift'
   )
order by pr.category, pr.key, pr.vehicle_type_id nulls first;

-- ---------------------------------------------------------------------------
-- 2) Regras possivelmente conflitantes (mesma key com mais de 1 ativa no escopo)
-- ---------------------------------------------------------------------------
select
  pr.key,
  pr.vehicle_type_id,
  count(*) filter (where pr.is_active) as active_count,
  array_agg(pr.id order by pr.updated_at desc) as rule_ids
from public.pricing_rules_config pr
group by pr.key, pr.vehicle_type_id
having count(*) filter (where pr.is_active) > 1
order by active_count desc, pr.key;

-- ---------------------------------------------------------------------------
-- 3) Seeds antigas que deveriam estar desativadas
-- ---------------------------------------------------------------------------
select
  pr.key,
  pr.is_active,
  pr.value,
  pr.updated_at,
  pr.metadata ->> 'deprecated_by_migration' as deprecated_by_migration
from public.pricing_rules_config pr
where pr.key in ('loading_unloading_fixed', 'equipment_rental_forklift')
order by pr.key;

-- ---------------------------------------------------------------------------
-- 4) Cobertura de migracao (legacy -> Central) por codigo
-- ---------------------------------------------------------------------------
with legacy as (
  select
    'equipment_rental_rates'::text as legacy_table,
    er.id as legacy_id,
    er.code as code,
    er.name as name,
    er.unit as unit,
    er.value as value,
    er.active as active
  from public.equipment_rental_rates er
  union all
  select
    'unloading_cost_rates'::text as legacy_table,
    uc.id as legacy_id,
    uc.code as code,
    uc.name as name,
    uc.unit as unit,
    uc.value as value,
    uc.active as active
  from public.unloading_cost_rates uc
),
central as (
  select
    pr.key,
    pr.label,
    pr.value,
    pr.is_active,
    pr.metadata ->> 'legacy_table' as legacy_table,
    pr.metadata ->> 'legacy_id' as legacy_id,
    pr.metadata ->> 'unit' as unit
  from public.pricing_rules_config pr
  where pr.category in ('aluguel', 'carga_descarga')
    and pr.vehicle_type_id is null
)
select
  l.legacy_table,
  l.legacy_id,
  l.code as legacy_code,
  l.name as legacy_name,
  l.unit as legacy_unit,
  l.value as legacy_value,
  l.active as legacy_active,
  c.key as central_key,
  c.label as central_label,
  c.unit as central_unit,
  c.value as central_value,
  c.is_active as central_active,
  case
    when c.key is null then 'MISSING_IN_CENTRAL'
    when coalesce(c.value, 0) <> coalesce(l.value, 0) then 'VALUE_DIFF'
    else 'OK'
  end as audit_status
from legacy l
left join central c
  on c.key = l.code
 and c.legacy_table = l.legacy_table
 and c.legacy_id = l.legacy_id::text
order by l.legacy_table, l.code;

-- ---------------------------------------------------------------------------
-- 5) Regras de risco efetivas na Central (global e por veiculo)
-- ---------------------------------------------------------------------------
select
  pr.key,
  pr.vehicle_type_id,
  pr.value,
  pr.is_active,
  pr.updated_at
from public.pricing_rules_config pr
where pr.key in ('gris_percent', 'tso_percent', 'cost_value_percent')
  and pr.is_active = true
order by pr.key, pr.vehicle_type_id nulls first, pr.updated_at desc;

-- ---------------------------------------------------------------------------
-- 6) Auditoria detalhada da cotacao alvo:
--    breakdown salvo x faixa km x regra Central (com fallback)
-- ---------------------------------------------------------------------------
with params as (
  select 'COT-2026-03-0006'::text as quote_code
),
q as (
  select
    qt.id,
    qt.quote_code,
    qt.created_at,
    qt.price_table_id,
    qt.vehicle_type_id,
    qt.km_distance,
    qt.freight_modality,
    qt.pricing_breakdown
  from public.quotes qt
  join params p on p.quote_code = qt.quote_code
),
ptr as (
  select
    q.id as quote_id,
    r.id as row_id,
    r.km_from,
    r.km_to,
    r.gris_percent as row_gris,
    r.tso_percent as row_tso,
    r.cost_value_percent as row_cost_value
  from q
  left join lateral (
    select r2.*
    from public.price_table_rows r2
    where r2.price_table_id = q.price_table_id
      and r2.km_from <= ceil(coalesce(q.km_distance, 0))::int
      and r2.km_to >= ceil(coalesce(q.km_distance, 0))::int
    order by r2.km_from desc
    limit 1
  ) r on true
),
rules as (
  select
    q.id as quote_id,
    coalesce(
      (select pr.value
       from public.pricing_rules_config pr
       where pr.is_active = true
         and pr.key = 'gris_percent'
         and pr.vehicle_type_id = q.vehicle_type_id
       order by pr.updated_at desc
       limit 1),
      (select pr.value
       from public.pricing_rules_config pr
       where pr.is_active = true
         and pr.key = 'gris_percent'
         and pr.vehicle_type_id is null
       order by pr.updated_at desc
       limit 1),
      0.3
    ) as rule_gris,
    coalesce(
      (select pr.value
       from public.pricing_rules_config pr
       where pr.is_active = true
         and pr.key = 'tso_percent'
         and pr.vehicle_type_id = q.vehicle_type_id
       order by pr.updated_at desc
       limit 1),
      (select pr.value
       from public.pricing_rules_config pr
       where pr.is_active = true
         and pr.key = 'tso_percent'
         and pr.vehicle_type_id is null
       order by pr.updated_at desc
       limit 1),
      0.15
    ) as rule_tso,
    coalesce(
      (select pr.value
       from public.pricing_rules_config pr
       where pr.is_active = true
         and pr.key = 'cost_value_percent'
         and pr.vehicle_type_id = q.vehicle_type_id
       order by pr.updated_at desc
       limit 1),
      (select pr.value
       from public.pricing_rules_config pr
       where pr.is_active = true
         and pr.key = 'cost_value_percent'
         and pr.vehicle_type_id is null
       order by pr.updated_at desc
       limit 1),
      0.3
    ) as rule_cost_value
  from q
),
bd as (
  select
    q.id as quote_id,
    coalesce(
      nullif((q.pricing_breakdown #>> '{rates,grisPercent}'), '')::numeric,
      nullif((q.pricing_breakdown #>> '{rates,gris_percent}'), '')::numeric
    ) as bd_gris,
    coalesce(
      nullif((q.pricing_breakdown #>> '{rates,tsoPercent}'), '')::numeric,
      nullif((q.pricing_breakdown #>> '{rates,tso_percent}'), '')::numeric
    ) as bd_tso,
    coalesce(
      nullif((q.pricing_breakdown #>> '{rates,costValuePercent}'), '')::numeric,
      nullif((q.pricing_breakdown #>> '{rates,cost_value_percent}'), '')::numeric
    ) as bd_cost_value
  from q
)
select
  q.quote_code,
  q.freight_modality,
  q.km_distance,
  ptr.km_from,
  ptr.km_to,
  ptr.row_gris,
  ptr.row_tso,
  ptr.row_cost_value,
  rules.rule_gris,
  rules.rule_tso,
  rules.rule_cost_value,
  case when coalesce(ptr.row_gris, 0) > 0 then ptr.row_gris else rules.rule_gris end as expected_gris,
  case when coalesce(ptr.row_tso, 0) > 0 then ptr.row_tso else rules.rule_tso end as expected_tso,
  case when coalesce(ptr.row_cost_value, 0) > 0 then ptr.row_cost_value else rules.rule_cost_value end as expected_cost_value,
  bd.bd_gris as breakdown_gris,
  bd.bd_tso as breakdown_tso,
  bd.bd_cost_value as breakdown_cost_value,
  (abs(coalesce(bd.bd_gris, -999) - (case when coalesce(ptr.row_gris, 0) > 0 then ptr.row_gris else rules.rule_gris end)) <= 0.0001) as gris_ok,
  (abs(coalesce(bd.bd_tso, -999) - (case when coalesce(ptr.row_tso, 0) > 0 then ptr.row_tso else rules.rule_tso end)) <= 0.0001) as tso_ok,
  (abs(coalesce(bd.bd_cost_value, -999) - (case when coalesce(ptr.row_cost_value, 0) > 0 then ptr.row_cost_value else rules.rule_cost_value end)) <= 0.0001) as cost_value_ok
from q
left join ptr on ptr.quote_id = q.id
left join rules on rules.quote_id = q.id
left join bd on bd.quote_id = q.id;

-- ---------------------------------------------------------------------------
-- 7) Auditoria em lote (ultimas N cotacoes): mismatch risco no breakdown
-- ---------------------------------------------------------------------------
with params as (
  select 100::int as sample_size
),
q as (
  select
    qt.id,
    qt.quote_code,
    qt.created_at,
    qt.price_table_id,
    qt.vehicle_type_id,
    qt.km_distance,
    qt.freight_modality,
    qt.pricing_breakdown
  from public.quotes qt
  order by qt.created_at desc
  limit (select sample_size from params)
),
ptr as (
  select
    q.id as quote_id,
    r.gris_percent as row_gris,
    r.tso_percent as row_tso,
    r.cost_value_percent as row_cost_value
  from q
  left join lateral (
    select r2.*
    from public.price_table_rows r2
    where r2.price_table_id = q.price_table_id
      and r2.km_from <= ceil(coalesce(q.km_distance, 0))::int
      and r2.km_to >= ceil(coalesce(q.km_distance, 0))::int
    order by r2.km_from desc
    limit 1
  ) r on true
),
rules as (
  select
    q.id as quote_id,
    coalesce(
      (select pr.value from public.pricing_rules_config pr
       where pr.is_active and pr.key='gris_percent' and pr.vehicle_type_id=q.vehicle_type_id
       order by pr.updated_at desc limit 1),
      (select pr.value from public.pricing_rules_config pr
       where pr.is_active and pr.key='gris_percent' and pr.vehicle_type_id is null
       order by pr.updated_at desc limit 1),
      0.3
    ) as rule_gris,
    coalesce(
      (select pr.value from public.pricing_rules_config pr
       where pr.is_active and pr.key='tso_percent' and pr.vehicle_type_id=q.vehicle_type_id
       order by pr.updated_at desc limit 1),
      (select pr.value from public.pricing_rules_config pr
       where pr.is_active and pr.key='tso_percent' and pr.vehicle_type_id is null
       order by pr.updated_at desc limit 1),
      0.15
    ) as rule_tso,
    coalesce(
      (select pr.value from public.pricing_rules_config pr
       where pr.is_active and pr.key='cost_value_percent' and pr.vehicle_type_id=q.vehicle_type_id
       order by pr.updated_at desc limit 1),
      (select pr.value from public.pricing_rules_config pr
       where pr.is_active and pr.key='cost_value_percent' and pr.vehicle_type_id is null
       order by pr.updated_at desc limit 1),
      0.3
    ) as rule_cost_value
  from q
),
bd as (
  select
    q.id as quote_id,
    coalesce(
      nullif((q.pricing_breakdown #>> '{rates,grisPercent}'), '')::numeric,
      nullif((q.pricing_breakdown #>> '{rates,gris_percent}'), '')::numeric
    ) as bd_gris,
    coalesce(
      nullif((q.pricing_breakdown #>> '{rates,tsoPercent}'), '')::numeric,
      nullif((q.pricing_breakdown #>> '{rates,tso_percent}'), '')::numeric
    ) as bd_tso,
    coalesce(
      nullif((q.pricing_breakdown #>> '{rates,costValuePercent}'), '')::numeric,
      nullif((q.pricing_breakdown #>> '{rates,cost_value_percent}'), '')::numeric
    ) as bd_cost_value
  from q
),
audit as (
  select
    q.quote_code,
    q.created_at,
    q.freight_modality,
    q.km_distance,
    case when coalesce(ptr.row_gris, 0) > 0 then ptr.row_gris else rules.rule_gris end as expected_gris,
    case when coalesce(ptr.row_tso, 0) > 0 then ptr.row_tso else rules.rule_tso end as expected_tso,
    case when coalesce(ptr.row_cost_value, 0) > 0 then ptr.row_cost_value else rules.rule_cost_value end as expected_cost_value,
    bd.bd_gris,
    bd.bd_tso,
    bd.bd_cost_value
  from q
  left join ptr on ptr.quote_id = q.id
  left join rules on rules.quote_id = q.id
  left join bd on bd.quote_id = q.id
)
select
  quote_code,
  created_at,
  freight_modality,
  km_distance,
  expected_gris,
  bd_gris,
  expected_tso,
  bd_tso,
  expected_cost_value,
  bd_cost_value
from audit
where abs(coalesce(bd_gris, -999) - expected_gris) > 0.0001
   or abs(coalesce(bd_tso, -999) - expected_tso) > 0.0001
   or abs(coalesce(bd_cost_value, -999) - expected_cost_value) > 0.0001
order by created_at desc;

-- ---------------------------------------------------------------------------
-- 8) Taxas condicionais ativas (fonte correta: conditional_fees)
-- ---------------------------------------------------------------------------
select
  cf.id,
  cf.code,
  cf.name,
  cf.fee_type,
  cf.fee_value,
  cf.min_value,
  cf.max_value,
  cf.applies_to,
  cf.active,
  cf.updated_at
from public.conditional_fees cf
where cf.active = true
order by cf.code;

-- ---------------------------------------------------------------------------
-- 9) Cotacao alvo: taxas condicionais salvas no breakdown + cadastro da fee
-- ---------------------------------------------------------------------------
with params as (
  select 'COT-2026-03-0006'::text as quote_code
),
q as (
  select
    qt.id,
    qt.quote_code,
    qt.pricing_breakdown
  from public.quotes qt
  join params p on p.quote_code = qt.quote_code
),
selected_ids as (
  select
    q.id as quote_id,
    jsonb_array_elements_text(
      coalesce(q.pricing_breakdown #> '{meta,selectedConditionalFeeIds}', '[]'::jsonb)
    ) as fee_id
  from q
),
breakdown_vals as (
  select
    q.id as quote_id,
    kv.key as fee_id,
    (kv.value)::numeric as fee_amount
  from q,
       jsonb_each_text(
         coalesce(q.pricing_breakdown #> '{conditionalFeesBreakdown}', '{}'::jsonb)
       ) kv
)
select
  q.quote_code,
  coalesce(s.fee_id, b.fee_id) as fee_id,
  cf.code as fee_code,
  cf.name as fee_name,
  cf.fee_type,
  cf.fee_value as configured_value,
  b.fee_amount as amount_in_breakdown,
  case
    when cf.id is null then 'FEE_NOT_FOUND'
    else 'OK'
  end as audit_status
from q
left join selected_ids s on s.quote_id = q.id
full join breakdown_vals b
  on b.quote_id = q.id
 and b.fee_id = s.fee_id
left join public.conditional_fees cf
  on cf.id::text = coalesce(s.fee_id, b.fee_id)
order by fee_code nulls last, fee_id;

-- ---------------------------------------------------------------------------
-- 10) Itens de aluguel/carga_descarga em breakdown sem mapeamento na Central
-- ---------------------------------------------------------------------------
with q as (
  select
    qt.quote_code,
    qt.pricing_breakdown
  from public.quotes qt
  where qt.created_at >= now() - interval '60 days'
),
items as (
  select
    q.quote_code,
    'equipmentRental'::text as section,
    e as item
  from q
  cross join lateral jsonb_array_elements(
    coalesce(q.pricing_breakdown #> '{meta,equipmentRental}', '[]'::jsonb)
  ) e
  union all
  select
    q.quote_code,
    'unloadingCost'::text as section,
    u as item
  from q
  cross join lateral jsonb_array_elements(
    coalesce(q.pricing_breakdown #> '{meta,unloadingCost}', '[]'::jsonb)
  ) u
)
select
  i.quote_code,
  i.section,
  i.item ->> 'ruleKey' as rule_key,
  i.item ->> 'code' as code,
  i.item ->> 'id' as legacy_or_rule_id,
  pr.id as matched_rule_id,
  pr.key as matched_rule_key,
  pr.category as matched_category,
  case
    when pr.id is null then 'NO_MATCH_IN_CENTRAL'
    else 'OK'
  end as audit_status
from items i
left join public.pricing_rules_config pr
  on pr.is_active = true
 and (
      pr.key = coalesce(nullif(i.item ->> 'ruleKey', ''), nullif(i.item ->> 'code', ''))
      or pr.id::text = nullif(i.item ->> 'id', '')
      or (pr.metadata ->> 'legacy_id') = nullif(i.item ->> 'id', '')
 )
where i.item is not null
order by i.quote_code desc, i.section;

