-- Reporting + moderation primitives

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  reported_user_id uuid references public.users(id) on delete set null,
  reported_bot_id uuid references public.bots(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_target_check check (
    (reported_user_id is not null and reported_bot_id is null)
    or (reported_user_id is null and reported_bot_id is not null)
  )
);

create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_reported_user_idx on public.reports (reported_user_id);
create index if not exists reports_reported_bot_idx on public.reports (reported_bot_id);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

create table if not exists public.mod_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  bot_id uuid references public.bots(id) on delete set null,
  action text not null,
  explanation text,
  created_at timestamptz not null default now()
);

create index if not exists mod_actions_actor_idx on public.mod_actions (actor_id);
create index if not exists mod_actions_user_idx on public.mod_actions (user_id);
create index if not exists mod_actions_bot_idx on public.mod_actions (bot_id);
create index if not exists mod_actions_created_at_idx on public.mod_actions (created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id);
create index if not exists notifications_is_read_idx on public.notifications (is_read);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

alter table if exists public.users
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_banned boolean not null default false,
  add column if not exists is_silenced boolean not null default false;
