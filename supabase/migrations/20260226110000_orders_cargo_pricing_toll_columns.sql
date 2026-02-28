-- Clone cargo data, pricing details and toll from quotes to orders
alter table public.orders
  add column if not exists cargo_type text,
  add column if not exists weight numeric,
  add column if not exists volume numeric,
  add column if not exists price_table_id uuid references public.price_tables(id),
  add column if not exists vehicle_type_id uuid references public.vehicle_types(id),
  add column if not exists payment_term_id uuid references public.payment_terms(id),
  add column if not exists km_distance numeric,
  add column if not exists toll_value numeric,
  add column if not exists pricing_breakdown jsonb,
  add column if not exists freight_type text,
  add column if not exists freight_modality text,
  add column if not exists shipper_id uuid,
  add column if not exists shipper_name text,
  add column if not exists origin_cep text,
  add column if not exists destination_cep text;
