-- PRD v2.0 Phase 2: Add real cost columns to orders for previsto vs real analysis

begin;

alter table public.orders
  add column if not exists pedagio_real numeric,
  add column if not exists descarga_real numeric;

comment on column public.orders.pedagio_real is 'Valor real de pedágio informado manualmente (para comparar com previsto do breakdown)';
comment on column public.orders.descarga_real is 'Valor real de carga/descarga informado manualmente (para comparar com previsto do breakdown)';

commit;
