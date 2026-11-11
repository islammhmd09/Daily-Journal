-- Run once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists public.records (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind      text not null,                 -- 'journal' | 'task' (new features just add new kinds)
  id        text not null,
  data      jsonb,
  updated_at timestamptz not null,         -- set by the app, used for last-write-wins
  deleted   boolean not null default false,
  synced_at timestamptz not null default clock_timestamp(), -- set by the server, used to pull changes
  primary key (user_id, kind, id)
);
create index if not exists records_pull_idx on public.records (user_id, synced_at);

alter table public.records enable row level security;
drop policy if exists "own records" on public.records;
create policy "own records" on public.records for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_synced_at() returns trigger language plpgsql as $$
begin new.synced_at = clock_timestamp(); return new; end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_synced_at();
