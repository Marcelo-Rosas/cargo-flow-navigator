-- Fix: try_auto_group_order_to_trip cria viagem duplicada quando a OS reentra
-- em 'coleta_realizada' em outra data, deixando linhas trip_orders órfãs em
-- viagens anteriores (a OS passa a ser contada em duas VGs).
--
-- Causa: o trigger não verificava se a OS já estava vinculada a uma viagem.
-- Correção: retorna cedo quando new.trip_id já está preenchido, alinhando o
-- comportamento ao early-return de link_order_to_trip(p_order_id).

create or replace function public.try_auto_group_order_to_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_vehicle_plate text;
  v_driver_id uuid;
  v_order_value numeric;
  v_trip_id uuid;
  v_trip_number text;
  v_total_value numeric;
  v_factor numeric;
  r record;
begin
  -- Só executa quando stage muda para coleta_realizada
  if new.stage <> 'coleta_realizada' or (old.stage = new.stage and tg_op = 'UPDATE') then
    return new;
  end if;

  -- Já vinculada a uma viagem: não reagrupar (evita duplicar trip_orders em
  -- outra VG quando a OS reentra em coleta_realizada em data diferente)
  if new.trip_id is not null then
    return new;
  end if;

  v_order_id := new.id;
  v_vehicle_plate := trim(new.vehicle_plate);
  v_driver_id := new.driver_id;
  v_order_value := coalesce(new.value, 0);

  -- Exige vehicle_plate e driver_id para agrupar
  if v_vehicle_plate is null or v_vehicle_plate = '' or v_driver_id is null then
    return new;
  end if;

  -- Buscar trip existente: mesma placa, mesmo motorista, aberta, data de hoje
  select t.id into v_trip_id
  from public.trips t
  where t.vehicle_plate = v_vehicle_plate
    and t.driver_id = v_driver_id
    and t.status_operational in ('aberta', 'em_transito')
    and (t.departure_at::date = current_date or (t.departure_at is null and t.created_at::date = current_date))
  order by t.created_at desc
  limit 1;

  -- Se não encontrou, criar nova trip
  if v_trip_id is null then
    select public.generate_trip_number() into v_trip_number;
    insert into public.trips (
      trip_number, vehicle_plate, driver_id, departure_at, status_operational
    ) values (
      v_trip_number, v_vehicle_plate, v_driver_id, now(), 'aberta'
    )
    returning id into v_trip_id;
  end if;

  -- Inserir trip_orders (evitar duplicata)
  insert into public.trip_orders (trip_id, order_id, apportion_key, apportion_factor)
  values (v_trip_id, v_order_id, 'revenue', 0)
  on conflict (trip_id, order_id) do nothing;

  -- Atualizar orders.trip_id
  update public.orders set trip_id = v_trip_id, updated_at = now() where id = v_order_id;

  -- Recalcular apportion_factor (por receita)
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

  -- Sincronizar custos do breakdown
  perform public.sync_cost_items_from_breakdown(v_trip_id);

  return new;
end;
$$;
