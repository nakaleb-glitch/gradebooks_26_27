create table if not exists public.behavior_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  incident_date date not null,
  incident_type text not null,
  severity text not null check (severity in ('Low', 'Medium', 'High')),
  description text not null,
  action_taken text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists behavior_reports_reporter_idx
  on public.behavior_reports (reporter_id);

create index if not exists behavior_reports_incident_date_idx
  on public.behavior_reports (incident_date);

create or replace function public.set_behavior_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_behavior_reports_updated_at on public.behavior_reports;
create trigger trg_behavior_reports_updated_at
before update on public.behavior_reports
for each row
execute function public.set_behavior_reports_updated_at();

alter table public.behavior_reports enable row level security;

drop policy if exists "Teachers can create behavior reports" on public.behavior_reports;
create policy "Teachers can create behavior reports"
on public.behavior_reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
);

drop policy if exists "Teachers can read own behavior reports" on public.behavior_reports;
create policy "Teachers can read own behavior reports"
on public.behavior_reports
for select
to authenticated
using (
  reporter_id = auth.uid()
);

drop policy if exists "Admins can manage behavior reports" on public.behavior_reports;
create policy "Admins can manage behavior reports"
on public.behavior_reports
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'admin_teacher')
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'admin_teacher')
  )
);
