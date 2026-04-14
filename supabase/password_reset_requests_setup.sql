create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null,
  status text not null default 'new' check (status in ('new', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists password_reset_requests_status_idx
  on public.password_reset_requests (status);

create index if not exists password_reset_requests_staff_id_idx
  on public.password_reset_requests (staff_id);

create unique index if not exists password_reset_requests_one_open_per_staff_idx
  on public.password_reset_requests ((lower(staff_id)))
  where status = 'new';

alter table public.password_reset_requests enable row level security;

drop policy if exists "Anyone can create password reset request" on public.password_reset_requests;
create policy "Anyone can create password reset request"
on public.password_reset_requests
for insert
to anon, authenticated
with check (
  length(trim(staff_id)) > 0
  and status = 'new'
);

drop policy if exists "Admins can read password reset requests" on public.password_reset_requests;
create policy "Admins can read password reset requests"
on public.password_reset_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'admin_teacher')
  )
);

drop policy if exists "Admins can update password reset requests" on public.password_reset_requests;
create policy "Admins can update password reset requests"
on public.password_reset_requests
for update
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
