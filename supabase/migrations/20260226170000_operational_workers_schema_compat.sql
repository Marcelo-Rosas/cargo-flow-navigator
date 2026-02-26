-- =====================================================
-- Operational workers schema compatibility
-- Aligns existing tables/columns with worker expectations
-- =====================================================

begin;

-- -----------------------------------------------------
-- approval_requests: worker reads resolved_at
-- -----------------------------------------------------
alter table if exists public.approval_requests
  add column if not exists resolved_at timestamptz;

-- -----------------------------------------------------
-- notification_logs: workers write metadata and sent_at
-- -----------------------------------------------------
alter table if exists public.notification_logs
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists sent_at timestamptz;

-- -----------------------------------------------------
-- driver_qualifications: operationalInsights reads these fields
-- -----------------------------------------------------
alter table if exists public.driver_qualifications
  add column if not exists driver_id uuid,
  add column if not exists qualification_type text,
  add column if not exists expires_at timestamptz;

-- -----------------------------------------------------
-- compliance_checks: workers write/read result + violation_type + entity_type
-- -----------------------------------------------------
alter table if exists public.compliance_checks
  add column if not exists result jsonb,
  add column if not exists violation_type text,
  add column if not exists entity_type text;

-- backfill result from ai_analysis where available
update public.compliance_checks
set result = coalesce(result, ai_analysis)
where result is null;

-- -----------------------------------------------------
-- regulatory_updates: worker expects source_url/source_name/analysis
-- -----------------------------------------------------
alter table if exists public.regulatory_updates
  add column if not exists source_url text,
  add column if not exists source_name text,
  add column if not exists impact_areas text[] not null default '{}',
  add column if not exists recommendation text,
  add column if not exists analysis jsonb;

-- backfill compatibility fields from legacy columns
update public.regulatory_updates
set
  source_name = coalesce(source_name, source),
  source_url = coalesce(source_url, url),
  analysis = coalesce(analysis, ai_analysis)
where true;

create index if not exists idx_regulatory_updates_source_url
  on public.regulatory_updates(source_url);

create unique index if not exists idx_regulatory_updates_source_name_url
  on public.regulatory_updates(source_name, source_url)
  where source_url is not null;

-- -----------------------------------------------------
-- notification_queue: used by regulatory and report workers
-- -----------------------------------------------------
create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  channel text not null default 'both',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  external_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_notification_queue_pending
  on public.notification_queue(status, created_at)
  where status = 'pending';

alter table public.notification_queue enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_queue'
      and policyname = 'Authenticated users can view notification_queue'
  ) then
    create policy "Authenticated users can view notification_queue"
      on public.notification_queue for select
      to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_queue'
      and policyname = 'Authenticated users can insert notification_queue'
  ) then
    create policy "Authenticated users can insert notification_queue"
      on public.notification_queue for insert
      to authenticated with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_queue'
      and policyname = 'Authenticated users can update notification_queue'
  ) then
    create policy "Authenticated users can update notification_queue"
      on public.notification_queue for update
      to authenticated using (true);
  end if;
end $$;

-- -----------------------------------------------------
-- Compatibility view: operationalReportWorker reads order_documents.status
-- map from documents.validation_status
-- -----------------------------------------------------
create or replace view public.order_documents as
select
  d.id,
  d.order_id,
  coalesce(nullif(d.validation_status, ''), 'pending') as status,
  d.type,
  d.file_name,
  d.created_at
from public.documents d
where d.order_id is not null;

grant select on public.order_documents to authenticated;

commit;
