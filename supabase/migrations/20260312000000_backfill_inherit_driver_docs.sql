-- Backfill: herda documentação do motorista para OSs já vinculadas a viagens
-- (vinculadas antes do deploy da feature de herança)

do $$
declare
  r_trip record;
  r_dest record;
  v_src_order_id uuid;
  v_src_has_cnh boolean;
  v_src_has_crlv boolean;
  v_src_has_comp_residencia boolean;
  v_src_has_antt_motorista boolean;
  v_dest_has_all boolean;
begin
  for r_trip in
    select t.id as trip_id
    from public.trips t
    where exists (
      select 1 from public.trip_orders tro
      where tro.trip_id = t.id
      group by tro.trip_id
      having count(*) > 1
    )
  loop
    for r_dest in
      select o.id as order_id, o.driver_id
      from public.trip_orders tro
      join public.orders o on o.id = tro.order_id
      where tro.trip_id = r_trip.trip_id
    loop
      -- Destino já tem todos os docs?
      select coalesce(
        (select has_cnh and has_crlv and has_comp_residencia and has_antt_motorista
         from public.orders where id = r_dest.order_id),
        false
      ) into v_dest_has_all;

      if not v_dest_has_all then
        -- Buscar outra OS na trip com mesmo motorista e docs completos
        select o2.id, o2.has_cnh, o2.has_crlv, o2.has_comp_residencia, o2.has_antt_motorista
          into v_src_order_id, v_src_has_cnh, v_src_has_crlv, v_src_has_comp_residencia, v_src_has_antt_motorista
        from public.trip_orders tro
        join public.orders o2 on o2.id = tro.order_id
        where tro.trip_id = r_trip.trip_id
          and o2.id != r_dest.order_id
          and o2.driver_id = r_dest.driver_id
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
          where id = r_dest.order_id;

          insert into public.documents (order_id, type, file_name, file_url, file_size, uploaded_by, source)
          select r_dest.order_id, d.type, d.file_name, d.file_url, d.file_size, d.uploaded_by, 'inherited'
          from public.documents d
          where d.order_id = v_src_order_id
            and d.type in ('cnh', 'crlv', 'comp_residencia', 'antt_motorista')
            and not exists (
              select 1 from public.documents d2
              where d2.order_id = r_dest.order_id and d2.type = d.type
            );
        end if;
      end if;
    end loop;
  end loop;
end;
$$;
