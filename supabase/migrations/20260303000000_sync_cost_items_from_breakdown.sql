-- RPC sync_cost_items_from_breakdown(trip_id): popula trip_cost_items a partir do pricing_breakdown das OS
-- Mapeamento conforme plano: components.toll->pedagio, profitability.custosCarreteiro->carreteiro,
-- profitability.custosDescarga->descarga, totals.das->das, components.gris->gris, components.tso->tso

create or replace function public.sync_cost_items_from_breakdown(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_toll_total numeric := 0;
  v_carreteiro_total numeric := 0;
  v_idempotency text;
begin
  -- Limpar itens existentes com source='breakdown' para esta trip (idempotência via replace)
  delete from public.trip_cost_items
  where trip_id = p_trip_id
    and source = 'breakdown';

  -- Acumular totais TRIP (soma das OS) e inserir itens OS
  for r in
    select
      o.id as order_id,
      o.pricing_breakdown as pb,
      coalesce(q.pricing_breakdown, o.pricing_breakdown) as effective_pb
    from public.trip_orders to2
    join public.orders o on o.id = to2.order_id
    left join public.quotes q on q.id = o.quote_id
    where to2.trip_id = p_trip_id
  loop
    if r.effective_pb is not null then
      -- Acumular para TRIP
      v_toll_total := v_toll_total + coalesce(
        (r.effective_pb->'components'->>'toll')::numeric, 0);
      v_carreteiro_total := v_carreteiro_total + coalesce(
        (r.effective_pb->'profitability'->>'custosCarreteiro')::numeric, 0);

      -- Itens OS (scope=OS, order_id obrigatório)
      if coalesce((r.effective_pb->'profitability'->>'custosDescarga')::numeric, 0) > 0 then
        v_idempotency := p_trip_id::text || '_' || r.order_id::text || '_descarga_breakdown';
        insert into public.trip_cost_items (
          trip_id, order_id, scope, category, amount, source, idempotency_key
        ) values (
          p_trip_id, r.order_id, 'OS', 'descarga',
          (r.effective_pb->'profitability'->>'custosDescarga')::numeric,
          'breakdown', v_idempotency
        ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
      end if;

      if coalesce((r.effective_pb->'totals'->>'das')::numeric, 0) > 0 then
        v_idempotency := p_trip_id::text || '_' || r.order_id::text || '_das_breakdown';
        insert into public.trip_cost_items (
          trip_id, order_id, scope, category, amount, source, idempotency_key
        ) values (
          p_trip_id, r.order_id, 'OS', 'das',
          (r.effective_pb->'totals'->>'das')::numeric,
          'breakdown', v_idempotency
        ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
      end if;

      if coalesce((r.effective_pb->'components'->>'gris')::numeric, 0) > 0 then
        v_idempotency := p_trip_id::text || '_' || r.order_id::text || '_gris_breakdown';
        insert into public.trip_cost_items (
          trip_id, order_id, scope, category, amount, source, idempotency_key
        ) values (
          p_trip_id, r.order_id, 'OS', 'gris',
          (r.effective_pb->'components'->>'gris')::numeric,
          'breakdown', v_idempotency
        ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
      end if;

      if coalesce((r.effective_pb->'components'->>'tso')::numeric, 0) > 0 then
        v_idempotency := p_trip_id::text || '_' || r.order_id::text || '_tso_breakdown';
        insert into public.trip_cost_items (
          trip_id, order_id, scope, category, amount, source, idempotency_key
        ) values (
          p_trip_id, r.order_id, 'OS', 'tso',
          (r.effective_pb->'components'->>'tso')::numeric,
          'breakdown', v_idempotency
        ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
      end if;
    end if;
  end loop;

  -- Itens TRIP (scope=TRIP, order_id null)
  if v_toll_total > 0 then
    v_idempotency := p_trip_id::text || '_pedagio_breakdown';
    insert into public.trip_cost_items (
      trip_id, order_id, scope, category, amount, source, idempotency_key
    ) values (
      p_trip_id, null, 'TRIP', 'pedagio', v_toll_total, 'breakdown', v_idempotency
    ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
  end if;

  if v_carreteiro_total > 0 then
    v_idempotency := p_trip_id::text || '_carreteiro_breakdown';
    insert into public.trip_cost_items (
      trip_id, order_id, scope, category, amount, source, idempotency_key
    ) values (
      p_trip_id, null, 'TRIP', 'carreteiro', v_carreteiro_total, 'breakdown', v_idempotency
    ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
  end if;
end;
$$;
