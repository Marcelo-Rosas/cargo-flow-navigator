-- RPC para vinculação manual de OS à viagem (permite agrupar quando o trigger não rodou)

create or replace function public.link_order_to_trip(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_trip_id uuid;
  v_trip_number text;
  v_total_value numeric;
  v_factor numeric;
  r record;
begin
  select id, vehicle_plate, driver_id, value, trip_id into v_order
  from public.orders
  where id = p_order_id;

  if v_order.id is null then
    raise exception 'Ordem não encontrada: %', p_order_id;
  end if;

  -- Se já vinculada, retornar
  if v_order.trip_id is not null then
    return v_order.trip_id;
  end if;

  -- Exige vehicle_plate e driver_id
  if trim(coalesce(v_order.vehicle_plate, '')) = '' or v_order.driver_id is null then
    raise exception 'Informe placa e motorista na OS antes de vincular à viagem';
  end if;

  -- Buscar trip existente
  select t.id into v_trip_id
  from public.trips t
  where t.vehicle_plate = trim(v_order.vehicle_plate)
    and t.driver_id = v_order.driver_id
    and t.status_operational in ('aberta', 'em_transito')
    and (t.departure_at::date = current_date or (t.departure_at is null and t.created_at::date = current_date))
  order by t.created_at desc
  limit 1;

  if v_trip_id is null then
    select public.generate_trip_number() into v_trip_number;
    insert into public.trips (trip_number, vehicle_plate, driver_id, departure_at, status_operational)
    values (v_trip_number, trim(v_order.vehicle_plate), v_order.driver_id, now(), 'aberta')
    returning id into v_trip_id;
  end if;

  insert into public.trip_orders (trip_id, order_id, apportion_key, apportion_factor)
  values (v_trip_id, p_order_id, 'revenue', 0)
  on conflict (trip_id, order_id) do nothing;

  update public.orders set trip_id = v_trip_id, updated_at = now() where id = p_order_id;

  select coalesce(sum(o.value), 0) into v_total_value
  from public.trip_orders to2
  join public.orders o on o.id = to2.order_id
  where to2.trip_id = v_trip_id;

  if v_total_value > 0 then
    for r in
      select to2.id, o.value
      from public.trip_orders to2
      join public.orders o on o.id = to2.order_id
      where to2.trip_id = v_trip_id
    loop
      v_factor := coalesce(r.value, 0) / v_total_value;
      update public.trip_orders set apportion_factor = v_factor where id = r.id;
    end loop;
  end if;

  perform public.sync_cost_items_from_breakdown(v_trip_id);

  return v_trip_id;
end;
$$;
