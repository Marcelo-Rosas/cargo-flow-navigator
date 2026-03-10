-- ═══════════════════════════════════════════════════════
-- News Items — Notícias que impactam precificação de frete
-- Usado pelo news-agent (Edge Function)
-- ═══════════════════════════════════════════════════════

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  source_type text not null check (source_type in ('email', 'web')),
  source_name text,
  source_url text,
  relevance_score int check (relevance_score between 1 and 10),
  created_at timestamptz default now(),
  raw_snippet text
);

create index if not exists idx_news_items_created_at on public.news_items(created_at desc);
create index if not exists idx_news_items_source_url on public.news_items(source_url) where source_url is not null;

-- RLS: authenticated pode ler; inserção apenas via service role (Edge Function)
alter table public.news_items enable row level security;

create policy "news_items_select_authenticated"
  on public.news_items for select
  to authenticated
  using (true);

-- Inserção via service_role (nenhuma policy INSERT para authenticated)
create policy "news_items_insert_service_role"
  on public.news_items for insert
  to service_role
  with check (true);
