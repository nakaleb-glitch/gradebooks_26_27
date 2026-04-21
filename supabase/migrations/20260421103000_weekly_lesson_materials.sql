-- Weekly lesson materials uploaded by class teachers and shown to students by week.

create table if not exists public.weekly_lesson_materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  week integer not null check (week >= 0 and week <= 39),
  lesson_number integer,
  title text not null,
  material_type text not null check (material_type in ('link', 'file')),
  external_url text,
  storage_path text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  created_by uuid not null references public.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint weekly_lesson_materials_link_or_file_check
    check (
      (material_type = 'link' and external_url is not null and storage_path is null)
      or
      (material_type = 'file' and storage_path is not null and external_url is null)
    )
);

create index if not exists idx_weekly_lesson_materials_class_week
  on public.weekly_lesson_materials(class_id, week);

create index if not exists idx_weekly_lesson_materials_class_week_lesson
  on public.weekly_lesson_materials(class_id, week, lesson_number);

create or replace function public.update_weekly_lesson_materials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_lesson_materials_updated_at on public.weekly_lesson_materials;
create trigger trg_weekly_lesson_materials_updated_at
before update on public.weekly_lesson_materials
for each row
execute function public.update_weekly_lesson_materials_updated_at();

alter table public.weekly_lesson_materials enable row level security;

drop policy if exists "Teachers and admins can read weekly lesson materials" on public.weekly_lesson_materials;
create policy "Teachers and admins can read weekly lesson materials"
on public.weekly_lesson_materials
for select
to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = weekly_lesson_materials.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
);

drop policy if exists "Students can read weekly lesson materials for enrolled classes" on public.weekly_lesson_materials;
create policy "Students can read weekly lesson materials for enrolled classes"
on public.weekly_lesson_materials
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.class_students cs on cs.student_id = u.student_id_ref
    where u.id = auth.uid()
      and u.role = 'student'
      and cs.class_id = weekly_lesson_materials.class_id
  )
);

drop policy if exists "Teachers and admins can create weekly lesson materials" on public.weekly_lesson_materials;
create policy "Teachers and admins can create weekly lesson materials"
on public.weekly_lesson_materials
for insert
to authenticated
with check (
  exists (
    select 1
    from public.classes c
    where c.id = weekly_lesson_materials.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
);

drop policy if exists "Teachers and admins can update weekly lesson materials" on public.weekly_lesson_materials;
create policy "Teachers and admins can update weekly lesson materials"
on public.weekly_lesson_materials
for update
to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = weekly_lesson_materials.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = weekly_lesson_materials.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
);

drop policy if exists "Teachers and admins can delete weekly lesson materials" on public.weekly_lesson_materials;
create policy "Teachers and admins can delete weekly lesson materials"
on public.weekly_lesson_materials
for delete
to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = weekly_lesson_materials.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
);

insert into storage.buckets (id, name, public)
values ('weekly-material-files', 'weekly-material-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Teachers and admins upload weekly material files" on storage.objects;
create policy "Teachers and admins upload weekly material files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'weekly-material-files'
  and (
    exists (
      select 1
      from public.classes c
      where c.id = split_part(name, '/', 1)::uuid
        and c.teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'admin_teacher')
    )
  )
);

drop policy if exists "Class members can read weekly material files" on storage.objects;
create policy "Class members can read weekly material files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'weekly-material-files'
  and (
    exists (
      select 1
      from public.classes c
      where c.id = split_part(name, '/', 1)::uuid
        and c.teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'admin_teacher')
    )
    or exists (
      select 1
      from public.users u
      join public.class_students cs on cs.student_id = u.student_id_ref
      where u.id = auth.uid()
        and u.role = 'student'
        and cs.class_id = split_part(name, '/', 1)::uuid
    )
  )
);

drop policy if exists "Teachers and admins delete weekly material files" on storage.objects;
create policy "Teachers and admins delete weekly material files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'weekly-material-files'
  and (
    exists (
      select 1
      from public.classes c
      where c.id = split_part(name, '/', 1)::uuid
        and c.teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'admin_teacher')
    )
  )
);
