-- Herda documentação do motorista (flags + registros documents) quando OS é vinculada
-- a uma viagem que já possui outra OS com o mesmo motorista e docs completos.

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
  v_src_order_id uuid;
  v_src_has_cnh boolean;
  v_src_has_crlv boolean;
  v_src_has_comp_residencia boolean;
  v_src_has_antt_motorista boolean;
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

  -- Herdar documentação do motorista de outra OS na mesma viagem com mesmo motorista
  select o2.id, o2.has_cnh, o2.has_crlv, o2.has_comp_residencia, o2.has_antt_motorista
    into v_src_order_id, v_src_has_cnh, v_src_has_crlv, v_src_has_comp_residencia, v_src_has_antt_motorista
  from public.trip_orders tro
  join public.orders o2 on o2.id = tro.order_id
  where tro.trip_id = v_trip_id
    and o2.id != p_order_id
    and o2.driver_id = v_order.driver_id
    and coalesce(o2.has_cnh, false)
    and coalesce(o2.has_crlv, false)
    and coalesce(o2.has_comp_residencia, false)
    and coalesce(o2.has_antt_motorista, false)
  limit 1;

  if v_src_order_id is not null then
    update public.orders set
      has_cnh = v_src_has_cnh,
      has_crlv = v_src_has_crlv,
      has_comp_residencia = v_src_has_comp_residencia,
      has_antt_motorista = v_src_has_antt_motorista,
      updated_at = now()
    where id = p_order_id;

    insert into public.documents (order_id, type, file_name, file_url, file_size, uploaded_by)
    select p_order_id, d.type, d.file_name, d.file_url, d.file_size, d.uploaded_by
    from public.documents d
    where d.order_id = v_src_order_id
      and d.type in ('cnh', 'crlv', 'comp_residencia', 'antt_motorista');
  end if;

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
