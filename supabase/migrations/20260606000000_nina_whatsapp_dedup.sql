-- Deduplication table for incoming WhatsApp messages processed by nina-orchestrator.
-- Prevents the same message from being processed twice (webhook retries, duplicate triggers).

create table if not exists public.nina_processed_messages (
  id            uuid primary key default gen_random_uuid(),
  wa_message_id text not null unique,
  sender_phone  text not null,
  direction     text not null default 'incoming' check (direction in ('incoming', 'outgoing')),
  status        text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  payload       jsonb,
  response      jsonb,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- Index for fast lookups by message_id (unique already creates one, but explicit for clarity)
create index if not exists idx_nina_processed_sender on public.nina_processed_messages (sender_phone, created_at desc);

-- Auto-cleanup: remove entries older than 7 days (via cron or manual)
-- Keeping 7 days allows debugging duplicate issues.

-- RLS: only service role can access (Edge Functions use service role key)
alter table public.nina_processed_messages enable row level security;

-- No RLS policies = only service_role can read/write (exactly what we want)
