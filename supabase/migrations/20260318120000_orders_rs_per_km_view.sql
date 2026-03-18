-- Phase: Reports — R$/KM por rota (OS reais)
-- View consumida pelo frontend em src/hooks/useRsPerKmByRoute.ts
-- Fonte de verdade: public.orders (carreteiro_real e km_distance)
-- Observação:
-- - Campo tipo (OS/VG) é derivado de orders.trip_id OU da existência em trip_orders
-- - Filtro de "apenas 1 destino" ainda não é aplicado aqui porque não há stops no schema de orders;
--   quando existir quote_route_stop/stops clonados para VG, adicionaremos stops_count/has_stops e o filtro.

create or replace view public.orders_rs_per_km as
select
  o.id as order_id,
  o.os_number,
  o.client_name,
  o.origin,
  o.destination,
  o.km_distance,
  o.carreteiro_real,
  (o.carreteiro_real / nullif(o.km_distance, 0)) as rs_per_km,
  o.vehicle_type_id,
  vt.name as vehicle_type_name,
  o.created_at as order_date,
  case
    when o.trip_id is not null
      or exists (select 1 from public.trip_orders to2 where to2.order_id = o.id)
    then 'VG'
    else 'OS'
  end as tipo,
  coalesce(o.trip_id, (select to2.trip_id from public.trip_orders to2 where to2.order_id = o.id limit 1)) as trip_id
from public.orders o
left join public.vehicle_types vt on vt.id = o.vehicle_type_id
where
  o.km_distance is not null and o.km_distance > 0
  and o.carreteiro_real is not null and o.carreteiro_real > 0;

