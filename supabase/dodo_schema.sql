-- Dodo Payments adapter schema.
-- Run this in Supabase SQL editor after the base schema.sql.

-- ─── Payment sessions ────────────────────────────────────────────────────────
-- One row per payment challenge issued to an AI agent.
-- Status lifecycle: pending → paid  (or expires via expires_at TTL check in app)

create table if not exists public.dodo_sessions (
  session_id       text        primary key,   -- our internal UUID
  dodo_session_id  text,                      -- Dodo's checkout session_id
  dodo_payment_id  text,                      -- Dodo's payment_id (set when paid)
  publisher_id     text        not null,      -- wallet address or publisher slug
  content_id       text        not null,      -- resource path (e.g. "/articles/ai")
  amount_usd       numeric(12, 6) not null,   -- requested price in USD
  status           text        not null default 'pending',  -- 'pending' | 'paid'
  expires_at       timestamptz not null,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists dodo_sessions_publisher_idx on public.dodo_sessions (publisher_id);
create index if not exists dodo_sessions_status_idx    on public.dodo_sessions (status);
create index if not exists dodo_sessions_expires_idx   on public.dodo_sessions (expires_at);
create unique index if not exists dodo_sessions_dodo_payment_idx
  on public.dodo_sessions (dodo_payment_id)
  where dodo_payment_id is not null;

-- ─── Usage billing events ────────────────────────────────────────────────────
-- Immutable log of every paid access. Used for per-publisher revenue reporting
-- and as the source of truth for the DodoPayoutsService.getPublisherBalance().

create table if not exists public.dodo_usage_events (
  id               bigserial   primary key,
  publisher_id     text        not null,
  content_id       text        not null,
  session_id       text        not null references public.dodo_sessions(session_id),
  dodo_payment_id  text        not null unique,  -- prevents duplicate events on webhook retry
  amount_usd       numeric(12, 6) not null,
  bot_identity     text,                         -- UA or detected bot name
  created_at       timestamptz not null default now()
);

create index if not exists dodo_usage_publisher_idx    on public.dodo_usage_events (publisher_id);
create index if not exists dodo_usage_created_idx      on public.dodo_usage_events (created_at desc);
create index if not exists dodo_usage_content_idx      on public.dodo_usage_events (content_id);
