-- v4.0.x: sync_cost_items_from_breakdown insere descarga com amount=0 para auditoria
-- Todas as categorias por OS passam a aparecer na pivot (R$ 0,00 quando não informada)

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
  v_descarga numeric;
  v_das numeric;
  v_gris numeric;
  v_tso numeric;
begin
  delete from public.trip_cost_items
  where trip_id = p_trip_id
    and source = 'breakdown';

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
      v_toll_total := v_toll_total + coalesce(
        (r.effective_pb->'components'->>'toll')::numeric, 0);
      v_carreteiro_total := v_carreteiro_total + coalesce(
        (r.effective_pb->'profitability'->>'custosCarreteiro')::numeric, 0);

      -- Descarga: inserir sempre (amount=0 quando não informada) para auditoria
      v_descarga := coalesce((r.effective_pb->'profitability'->>'custosDescarga')::numeric, 0);
      v_idempotency := p_trip_id::text || '_' || r.order_id::text || '_descarga_breakdown';
      insert into public.trip_cost_items (
        trip_id, order_id, scope, category, amount, source, idempotency_key
      ) values (
        p_trip_id, r.order_id, 'OS', 'descarga', v_descarga, 'breakdown', v_idempotency
      ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();

      -- DAS
      v_das := coalesce((r.effective_pb->'totals'->>'das')::numeric, 0);
      if v_das > 0 then
        v_idempotency := p_trip_id::text || '_' || r.order_id::text || '_das_breakdown';
        insert into public.trip_cost_items (
          trip_id, order_id, scope, category, amount, source, idempotency_key
        ) values (
          p_trip_id, r.order_id, 'OS', 'das', v_das, 'breakdown', v_idempotency
        ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
      end if;

      -- GRIS
      v_gris := coalesce((r.effective_pb->'components'->>'gris')::numeric, 0);
      if v_gris > 0 then
        v_idempotency := p_trip_id::text || '_' || r.order_id::text || '_gris_breakdown';
        insert into public.trip_cost_items (
          trip_id, order_id, scope, category, amount, source, idempotency_key
        ) values (
          p_trip_id, r.order_id, 'OS', 'gris', v_gris, 'breakdown', v_idempotency
        ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
      end if;

      -- TSO
      v_tso := coalesce((r.effective_pb->'components'->>'tso')::numeric, 0);
      if v_tso > 0 then
        v_idempotency := p_trip_id::text || '_' || r.order_id::text || '_tso_breakdown';
        insert into public.trip_cost_items (
          trip_id, order_id, scope, category, amount, source, idempotency_key
        ) values (
          p_trip_id, r.order_id, 'OS', 'tso', v_tso, 'breakdown', v_idempotency
        ) on conflict (idempotency_key) do update set amount = excluded.amount, updated_at = now();
      end if;
    end if;
  end loop;

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
