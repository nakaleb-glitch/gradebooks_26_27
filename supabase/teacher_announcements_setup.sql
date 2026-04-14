create table if not exists public.teacher_announcements (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  scope text not null check (scope in ('all_my_classes', 'selected_classes', 'single_class')),
  link_url text,
  attachment_url text,
  attachment_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- attachment_url stores the object path inside the "announcement-files" storage bucket (not a public URL).

create table if not exists public.teacher_announcement_targets (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.teacher_announcements(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (announcement_id, class_id)
);

create index if not exists teacher_announcements_teacher_created_idx
  on public.teacher_announcements (teacher_id, created_at desc);

create index if not exists teacher_announcement_targets_class_idx
  on public.teacher_announcement_targets (class_id);

create index if not exists teacher_announcement_targets_announcement_idx
  on public.teacher_announcement_targets (announcement_id);

create or replace function public.set_teacher_announcements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_teacher_announcements_updated_at on public.teacher_announcements;
create trigger trg_teacher_announcements_updated_at
before update on public.teacher_announcements
for each row
execute function public.set_teacher_announcements_updated_at();

alter table public.teacher_announcements enable row level security;
alter table public.teacher_announcement_targets enable row level security;

create or replace function public.student_can_read_teacher_announcement(announcement_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.class_students cs
      on cs.student_id = u.student_id_ref
    join public.teacher_announcement_targets tat
      on tat.class_id = cs.class_id
    where u.id = auth.uid()
      and u.role = 'student'
      and tat.announcement_id = announcement_uuid
  );
$$;

drop policy if exists "Teachers can create own announcements" on public.teacher_announcements;
create policy "Teachers can create own announcements"
on public.teacher_announcements
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('teacher', 'admin_teacher')
  )
);

drop policy if exists "Teachers can read own announcements" on public.teacher_announcements;
create policy "Teachers can read own announcements"
on public.teacher_announcements
for select
to authenticated
using (
  teacher_id = auth.uid()
);

drop policy if exists "Teachers can update own announcements" on public.teacher_announcements;
create policy "Teachers can update own announcements"
on public.teacher_announcements
for update
to authenticated
using (
  teacher_id = auth.uid()
)
with check (
  teacher_id = auth.uid()
);

drop policy if exists "Teachers can delete own announcements" on public.teacher_announcements;
create policy "Teachers can delete own announcements"
on public.teacher_announcements
for delete
to authenticated
using (
  teacher_id = auth.uid()
);

drop policy if exists "Students can read class-targeted announcements" on public.teacher_announcements;
create policy "Students can read class-targeted announcements"
on public.teacher_announcements
for select
to authenticated
using (
  public.student_can_read_teacher_announcement(teacher_announcements.id)
);

drop policy if exists "Teachers can read own announcement targets" on public.teacher_announcement_targets;
create policy "Teachers can read own announcement targets"
on public.teacher_announcement_targets
for select
to authenticated
using (
  exists (
    select 1
    from public.teacher_announcements ta
    where ta.id = teacher_announcement_targets.announcement_id
      and ta.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can create own announcement targets" on public.teacher_announcement_targets;
create policy "Teachers can create own announcement targets"
on public.teacher_announcement_targets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.teacher_announcements ta
    where ta.id = teacher_announcement_targets.announcement_id
      and ta.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can delete own announcement targets" on public.teacher_announcement_targets;
create policy "Teachers can delete own announcement targets"
on public.teacher_announcement_targets
for delete
to authenticated
using (
  exists (
    select 1
    from public.teacher_announcements ta
    where ta.id = teacher_announcement_targets.announcement_id
      and ta.teacher_id = auth.uid()
  )
);

drop policy if exists "Students can read announcement targets for enrolled classes" on public.teacher_announcement_targets;
create policy "Students can read announcement targets for enrolled classes"
on public.teacher_announcement_targets
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.class_students cs
      on cs.student_id = u.student_id_ref
    where u.id = auth.uid()
      and u.role = 'student'
      and cs.class_id = teacher_announcement_targets.class_id
  )
);

drop policy if exists "Admins can read all teacher announcements" on public.teacher_announcements;
create policy "Admins can read all teacher announcements"
on public.teacher_announcements
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
);

drop policy if exists "Admins can read all teacher announcement targets" on public.teacher_announcement_targets;
create policy "Admins can read all teacher announcement targets"
on public.teacher_announcement_targets
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
);
