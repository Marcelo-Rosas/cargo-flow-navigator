-- v4.0.x: RPC para vincular OS a uma Trip específica (correção de vínculo no Board Financeiro)
-- Mantém link_order_to_trip(p_order_id) inalterado para fluxo automático

create or replace function public.link_order_to_target_trip(p_order_id uuid, p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_old_trip_id uuid;
  v_total_value numeric;
  v_factor numeric;
  r record;
begin
  select id, trip_id into v_order
  from public.orders
  where id = p_order_id;

  if v_order.id is null then
    raise exception 'Ordem não encontrada: %', p_order_id;
  end if;

  if not exists (select 1 from public.trips where id = p_trip_id) then
    raise exception 'Trip não encontrada: %', p_trip_id;
  end if;

  -- Já vinculada à trip alvo
  if v_order.trip_id = p_trip_id then
    return p_trip_id;
  end if;

  v_old_trip_id := v_order.trip_id;

  -- Remover da trip atual (se houver)
  if v_old_trip_id is not null then
    delete from public.trip_orders
    where trip_id = v_old_trip_id
      and order_id = p_order_id;

    -- Recalcular apportion na trip de origem
    select coalesce(sum(o.value), 0) into v_total_value
    from public.trip_orders to2
    join public.orders o on o.id = to2.order_id
    where to2.trip_id = v_old_trip_id;

    if v_total_value > 0 then
      for r in
        select to2.id, o.value
        from public.trip_orders to2
        join public.orders o on o.id = to2.order_id
        where to2.trip_id = v_old_trip_id
      loop
        v_factor := coalesce(r.value, 0) / v_total_value;
        update public.trip_orders set apportion_factor = v_factor where id = r.id;
      end loop;
    end if;

    perform public.sync_cost_items_from_breakdown(v_old_trip_id);
  end if;

  -- Vincular à trip alvo
  insert into public.trip_orders (trip_id, order_id, apportion_key, apportion_factor)
  values (p_trip_id, p_order_id, 'revenue', 0)
  on conflict (trip_id, order_id) do update set apportion_factor = excluded.apportion_factor;

  update public.orders set trip_id = p_trip_id, updated_at = now() where id = p_order_id;

  -- Recalcular apportion na trip destino
  select coalesce(sum(o.value), 0) into v_total_value
  from public.trip_orders to2
  join public.orders o on o.id = to2.order_id
  where to2.trip_id = p_trip_id;

  if v_total_value > 0 then
    for r in
      select to2.id, o.value
      from public.trip_orders to2
      join public.orders o on o.id = to2.order_id
      where to2.trip_id = p_trip_id
    loop
      v_factor := coalesce(r.value, 0) / v_total_value;
      update public.trip_orders set apportion_factor = v_factor where id = r.id;
    end loop;
  end if;

  perform public.sync_cost_items_from_breakdown(p_trip_id);

  return p_trip_id;
end;
$$;
