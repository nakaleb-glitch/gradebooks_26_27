create table if not exists public.events_deadlines (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('event', 'deadline')),
  event_date date not null,
  title text not null,
  venue text not null,
  description text not null,
  plan_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_deadlines_type_idx
  on public.events_deadlines (item_type);

create index if not exists events_deadlines_date_idx
  on public.events_deadlines (event_date);

create or replace function public.set_events_deadlines_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_deadlines_updated_at on public.events_deadlines;
create trigger trg_events_deadlines_updated_at
before update on public.events_deadlines
for each row
execute function public.set_events_deadlines_updated_at();
