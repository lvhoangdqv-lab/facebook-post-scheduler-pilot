create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  caption text not null default '',
  scheduled_at timestamptz not null,
  page_id text,
  image_url text,
  first_comment text,
  format text not null default 'post',
  tags text,
  schedule_mode text not null default 'Custom Time',
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'publishing', 'mock_published', 'published', 'failed')),
  locked_at timestamptz,
  published_at timestamptz,
  publish_result jsonb,
  publish_error jsonb,
  error text,
  recoverable boolean not null default false,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  action text not null,
  actor text,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create index if not exists posts_status_scheduled_at_idx on public.posts (status, scheduled_at);
create index if not exists posts_locked_at_idx on public.posts (locked_at);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.posts enable row level security;
alter table public.audit_logs enable row level security;

-- No public RLS policies are created. The Cloudflare Worker uses the Supabase
-- service role key server-side. Do not expose the service role key to frontend code.

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;
