drop extension if exists "pg_net";

create type "public"."user_profile" as enum ('admin', 'operacional', 'financeiro');

drop trigger if exists "update_price_tables_updated_at" on "public"."price_tables";

drop policy "Admins can view audit logs" on "public"."audit_logs";

drop policy "Admin can delete clients" on "public"."clients";

drop policy "Authenticated users can view clients" on "public"."clients";

drop policy "Comercial and Admin can create clients" on "public"."clients";

drop policy "Comercial and Admin can update clients" on "public"."clients";

drop policy "Admin and Operacao can insert conditional_fees" on "public"."conditional_fees";

drop policy "Admin and Operacao can update conditional_fees" on "public"."conditional_fees";

drop policy "Admin can delete conditional_fees" on "public"."conditional_fees";

drop policy "Authenticated users can view conditional_fees" on "public"."conditional_fees";

drop policy "Admin can delete documents" on "public"."documents";

drop policy "Authenticated users can create documents" on "public"."documents";

drop policy "Authenticated users can view documents" on "public"."documents";

drop policy "Uploader and Admin can update documents" on "public"."documents";

drop policy "Admin and Operacao can insert icms_rates" on "public"."icms_rates";

drop policy "Admin and Operacao can update icms_rates" on "public"."icms_rates";

drop policy "Admin can delete icms_rates" on "public"."icms_rates";

drop policy "Authenticated users can view icms_rates" on "public"."icms_rates";

drop policy "Admin can delete occurrences" on "public"."occurrences";

drop policy "Authenticated users can view occurrences" on "public"."occurrences";

drop policy "Operacao and Admin can create occurrences" on "public"."occurrences";

drop policy "Operacao and Admin can update occurrences" on "public"."occurrences";

drop policy "Admin can delete orders" on "public"."orders";

drop policy "Authenticated users can view orders" on "public"."orders";

drop policy "Operacao and Admin can update orders" on "public"."orders";

drop policy "Operacao, Comercial and Admin can create orders" on "public"."orders";

drop policy "Admin and Operacao can insert payment_terms" on "public"."payment_terms";

drop policy "Admin and Operacao can update payment_terms" on "public"."payment_terms";

drop policy "Admin can delete payment_terms" on "public"."payment_terms";

drop policy "Authenticated users can view payment_terms" on "public"."payment_terms";

drop policy "Admin and Operacao can insert price_table_rows" on "public"."price_table_rows";

drop policy "Admin and Operacao can update price_table_rows" on "public"."price_table_rows";

drop policy "Admin can delete price_table_rows" on "public"."price_table_rows";

drop policy "Authenticated users can view price_table_rows" on "public"."price_table_rows";

drop policy "Admin and Operacao can insert price_tables" on "public"."price_tables";

drop policy "Admin and Operacao can update price_tables" on "public"."price_tables";

drop policy "Admin can delete price_tables" on "public"."price_tables";

drop policy "Authenticated users can view price_tables" on "public"."price_tables";

drop policy "Admin and Operacao can insert pricing_parameters" on "public"."pricing_parameters";

drop policy "Admin and Operacao can update pricing_parameters" on "public"."pricing_parameters";

drop policy "Admin can delete pricing_parameters" on "public"."pricing_parameters";

drop policy "Authenticated users can view pricing_parameters" on "public"."pricing_parameters";

drop policy "Admins can update any profile" on "public"."profiles";

drop policy "Admins can view all profiles" on "public"."profiles";

drop policy "Users can update their own profile" on "public"."profiles";

drop policy "Users can view their own profile" on "public"."profiles";

drop policy "Admin can delete quotes" on "public"."quotes";

drop policy "Authenticated users can view quotes" on "public"."quotes";

drop policy "Comercial and Admin can create quotes" on "public"."quotes";

drop policy "Comercial and Admin can update quotes" on "public"."quotes";

drop policy "Admin and Operacao can insert tac_rates" on "public"."tac_rates";

drop policy "Admin and Operacao can update tac_rates" on "public"."tac_rates";

drop policy "Admin can delete tac_rates" on "public"."tac_rates";

drop policy "Authenticated users can view tac_rates" on "public"."tac_rates";

drop policy "Admin and Operacao can insert toll_routes" on "public"."toll_routes";

drop policy "Admin and Operacao can update toll_routes" on "public"."toll_routes";

drop policy "Admin can delete toll_routes" on "public"."toll_routes";

drop policy "Authenticated users can view toll_routes" on "public"."toll_routes";

drop policy "Admins can manage roles" on "public"."user_roles";

drop policy "Admins can view all roles" on "public"."user_roles";

drop policy "Users can view their own roles" on "public"."user_roles";

drop policy "Admin and Operacao can insert vehicle_types" on "public"."vehicle_types";

drop policy "Admin and Operacao can update vehicle_types" on "public"."vehicle_types";

drop policy "Admin can delete vehicle_types" on "public"."vehicle_types";

drop policy "Authenticated users can view vehicle_types" on "public"."vehicle_types";

drop policy "Admin and Operacao can insert waiting_time_rules" on "public"."waiting_time_rules";

drop policy "Admin and Operacao can update waiting_time_rules" on "public"."waiting_time_rules";

drop policy "Admin can delete waiting_time_rules" on "public"."waiting_time_rules";

drop policy "Authenticated users can view waiting_time_rules" on "public"."waiting_time_rules";

alter table "public"."price_tables" drop constraint "price_tables_created_by_fkey";

alter table "public"."shippers" drop constraint "shippers_created_by_fkey";

drop index if exists "public"."idx_price_tables_unique_active_modality";

alter type "public"."document_type" rename to "document_type__old_version_to_be_dropped";

create type "public"."document_type" as enum ('nfe', 'cte', 'pod', 'outros', 'cnh', 'crlv', 'comp_residencia', 'antt_motorista', 'mdfe', 'adiantamento');

alter table "public"."documents" alter column type type "public"."document_type" using type::text::"public"."document_type";

drop type "public"."document_type__old_version_to_be_dropped";

alter table "public"."clients" add column "user_id" uuid not null default auth.uid();

alter table "public"."conditional_fees" add column "user_id" uuid default auth.uid();

alter table "public"."documents" add column "fat_id" uuid;

alter table "public"."icms_rates" add column "user_id" uuid default auth.uid();

alter table "public"."payment_terms" add column "user_id" uuid default auth.uid();

alter table "public"."price_table_rows" add column "user_id" uuid default auth.uid();

alter table "public"."price_tables" add column "user_id" uuid default auth.uid();

alter table "public"."pricing_parameters" add column "user_id" uuid default auth.uid();

alter table "public"."profiles" add column "perfil" public.user_profile default 'operacional'::public.user_profile;

alter table "public"."profiles" alter column "email" drop not null;

alter table "public"."profiles" alter column "user_id" drop not null;

alter table "public"."shippers" alter column "cnpj" set data type character varying(18) using "cnpj"::character varying(18);

alter table "public"."tac_rates" add column "user_id" uuid default auth.uid();

alter table "public"."toll_routes" add column "user_id" uuid default auth.uid();

alter table "public"."vehicle_types" add column "user_id" uuid default auth.uid();

alter table "public"."waiting_time_rules" add column "user_id" uuid default auth.uid();

CREATE INDEX idx_clients_user_id ON public.clients USING btree (user_id);

CREATE INDEX idx_documents_fat_id ON public.documents USING btree (fat_id);

CREATE INDEX idx_documents_quote_id ON public.documents USING btree (quote_id);

CREATE INDEX idx_price_table_rows_cover ON public.price_table_rows USING btree (km_from DESC, km_to) INCLUDE (price_table_id) WHERE (price_table_id IS NOT NULL);

CREATE INDEX idx_price_tables_active ON public.price_tables USING btree (active);

CREATE INDEX idx_price_tables_validity ON public.price_tables USING btree (valid_from, valid_until);

CREATE INDEX idx_profiles_id ON public.profiles USING btree (id);

CREATE INDEX idx_profiles_perfil ON public.profiles USING btree (perfil);

CREATE UNIQUE INDEX shippers_cnpj_key ON public.shippers USING btree (cnpj);

CREATE UNIQUE INDEX uq_price_tables_name_version ON public.price_tables USING btree (name, version);

alter table "public"."clients" add constraint "clients_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT not valid;

alter table "public"."clients" validate constraint "clients_user_id_fkey";

alter table "public"."price_tables" add constraint "price_tables_check" CHECK (((valid_until IS NULL) OR (valid_from IS NULL) OR (valid_until >= valid_from))) not valid;

alter table "public"."price_tables" validate constraint "price_tables_check";

alter table "public"."price_tables" add constraint "uq_price_tables_name_version" UNIQUE using index "uq_price_tables_name_version";

alter table "public"."shippers" add constraint "shippers_cnpj_key" UNIQUE using index "shippers_cnpj_key";

alter table "public"."price_tables" add constraint "price_tables_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."price_tables" validate constraint "price_tables_created_by_fkey";

alter table "public"."shippers" add constraint "shippers_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."shippers" validate constraint "shippers_created_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.copy_quote_adiantamento_to_fat(p_quote_id uuid, p_fat_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  insert into public.documents (
    file_name,
    file_url,
    file_size,
    type,
    uploaded_by,
    quote_id,
    fat_id,
    nfe_key,
    validation_status
  )
  select
    d.file_name,
    d.file_url,
    d.file_size,
    d.type,
    d.uploaded_by,
    d.quote_id,
    p_fat_id,
    d.nfe_key,
    d.validation_status
  from public.documents d
  where d.quote_id = p_quote_id
    and d.type = 'adiantamento'::public.document_type;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_profile()
 RETURNS public.user_profile
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.perfil
  from public.profiles p
  where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_company_domain()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.email is null or lower(split_part(new.email,'@',2)) <> 'vectracargo.com.br' then
    update auth.users set banned_until = 'infinity' where id = new.id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, perfil)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'operacional')
  on conflict (id) do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.perfil = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_user_profile(target_user_id uuid, new_profile public.user_profile)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  update public.profiles
  set perfil = new_profile,
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'user_not_found';
  end if;
end;
$function$
;

create or replace view "public"."valid_users" as  SELECT id AS user_id,
    email
   FROM auth.users u
  WHERE (lower(split_part((email)::text, '@'::text, 2)) = 'vectracargo.com.br'::text);


CREATE OR REPLACE FUNCTION public.enforce_pod_before_entregue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only enforce when the resulting stage is 'entregue'
  IF NEW.stage = 'entregue' AND COALESCE(NEW.has_pod, false) = false THEN
    RAISE EXCEPTION 'POD obrigatório para finalizar (stage=entregue)';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_price_row_by_km(p_price_table_id uuid, p_km_numeric numeric, p_rounding text DEFAULT 'ceil'::text)
 RETURNS TABLE(id uuid, km_from integer, km_to integer, cost_per_ton numeric, matched_km integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_km integer;
BEGIN
  IF p_rounding = 'floor' THEN
    v_km := FLOOR(p_km_numeric)::int;
  ELSIF p_rounding = 'round' THEN
    v_km := ROUND(p_km_numeric)::int;
  ELSE
    v_km := CEILING(p_km_numeric)::int;
  END IF;

  RETURN QUERY
  SELECT r.id, r.km_from, r.km_to, r.cost_per_ton, v_km AS matched_km
  FROM public.price_table_rows r
  WHERE r.price_table_id = p_price_table_id
    AND r.km_from <= v_km
    AND r.km_to >= v_km
  ORDER BY r.km_from DESC
  LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'leitura');
  
  RETURN NEW;
END;
$function$
;


  create policy "Full access audit_logs"
  on "public"."audit_logs"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "clients_delete_own"
  on "public"."clients"
  as permissive
  for delete
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "clients_insert_own"
  on "public"."clients"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "clients_select_own"
  on "public"."clients"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "clients_update_own"
  on "public"."clients"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Full access conditional_fees"
  on "public"."conditional_fees"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "conditional_fees_delete_own"
  on "public"."conditional_fees"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "conditional_fees_insert_own"
  on "public"."conditional_fees"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "conditional_fees_select_own"
  on "public"."conditional_fees"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "conditional_fees_update_own"
  on "public"."conditional_fees"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access documents"
  on "public"."documents"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Full access icms_rates"
  on "public"."icms_rates"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "icms_rates_delete_own"
  on "public"."icms_rates"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "icms_rates_insert_own"
  on "public"."icms_rates"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "icms_rates_select_own"
  on "public"."icms_rates"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "icms_rates_update_own"
  on "public"."icms_rates"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access occurrences"
  on "public"."occurrences"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Full access orders"
  on "public"."orders"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Full access payment_terms"
  on "public"."payment_terms"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "payment_terms_delete_own"
  on "public"."payment_terms"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "payment_terms_insert_own"
  on "public"."payment_terms"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "payment_terms_select_own"
  on "public"."payment_terms"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "payment_terms_update_own"
  on "public"."payment_terms"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access price_table_rows"
  on "public"."price_table_rows"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "price_table_rows_delete_own"
  on "public"."price_table_rows"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "price_table_rows_insert_own"
  on "public"."price_table_rows"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "price_table_rows_select_own"
  on "public"."price_table_rows"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "price_table_rows_update_own"
  on "public"."price_table_rows"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access price_tables"
  on "public"."price_tables"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "price_tables_delete_own"
  on "public"."price_tables"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "price_tables_insert_own"
  on "public"."price_tables"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "price_tables_select_own"
  on "public"."price_tables"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "price_tables_update_own"
  on "public"."price_tables"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access pricing_parameters"
  on "public"."pricing_parameters"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "pricing_parameters_delete_own"
  on "public"."pricing_parameters"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "pricing_parameters_insert_own"
  on "public"."pricing_parameters"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "pricing_parameters_select_own"
  on "public"."pricing_parameters"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "pricing_parameters_update_own"
  on "public"."pricing_parameters"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access profiles"
  on "public"."profiles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "profiles_select_admin"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (public.is_admin());



  create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((id = auth.uid()));



  create policy "profiles_select_valid_domain"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth.uid() AS uid) IN ( SELECT valid_users.user_id
   FROM public.valid_users))));



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((id = auth.uid()))
with check ((id = auth.uid()));



  create policy "Full access quotes"
  on "public"."quotes"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "shippers_delete_policy"
  on "public"."shippers"
  as permissive
  for delete
  to public
using (( SELECT public.has_role(auth.uid(), 'admin'::public.app_role) AS has_role));



  create policy "shippers_insert_policy"
  on "public"."shippers"
  as permissive
  for insert
  to public
with check (( SELECT public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'operacao'::public.app_role]) AS has_any_role));



  create policy "shippers_select_policy"
  on "public"."shippers"
  as permissive
  for select
  to public
using (( SELECT public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'operacao'::public.app_role]) AS has_any_role));



  create policy "shippers_update_policy"
  on "public"."shippers"
  as permissive
  for update
  to public
using (( SELECT public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'operacao'::public.app_role]) AS has_any_role))
with check (( SELECT public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'operacao'::public.app_role]) AS has_any_role));



  create policy "Full access tac_rates"
  on "public"."tac_rates"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "tac_rates_delete_own"
  on "public"."tac_rates"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "tac_rates_insert_own"
  on "public"."tac_rates"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "tac_rates_select_own"
  on "public"."tac_rates"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "tac_rates_update_own"
  on "public"."tac_rates"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access toll_routes"
  on "public"."toll_routes"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "toll_routes_delete_own"
  on "public"."toll_routes"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "toll_routes_insert_own"
  on "public"."toll_routes"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "toll_routes_select_own"
  on "public"."toll_routes"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "toll_routes_update_own"
  on "public"."toll_routes"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access user_roles"
  on "public"."user_roles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Full access vehicle_types"
  on "public"."vehicle_types"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "vehicle_types_delete_own"
  on "public"."vehicle_types"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "vehicle_types_insert_own"
  on "public"."vehicle_types"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "vehicle_types_select_own"
  on "public"."vehicle_types"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "vehicle_types_update_own"
  on "public"."vehicle_types"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Full access waiting_time_rules"
  on "public"."waiting_time_rules"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "waiting_time_rules_delete_own"
  on "public"."waiting_time_rules"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "waiting_time_rules_insert_own"
  on "public"."waiting_time_rules"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "waiting_time_rules_select_own"
  on "public"."waiting_time_rules"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "waiting_time_rules_update_own"
  on "public"."waiting_time_rules"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));


CREATE TRIGGER trg_price_tables_set_updated_at BEFORE UPDATE ON public.price_tables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER shippers_set_updated_at BEFORE UPDATE ON public.shippers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

drop trigger if exists "on_auth_user_created" on "auth"."users";

CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

CREATE TRIGGER trg_enforce_company_domain AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.enforce_company_domain();


