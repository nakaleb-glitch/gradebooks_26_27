-- Fix weekly-material-files storage policies to use objects.name
-- (previous migration accidentally referenced classes.name in split_part()).

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
      where c.id = (
        case
          when split_part(objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then split_part(objects.name, '/', 1)::uuid
          else null
        end
      )
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
      where c.id = (
        case
          when split_part(objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then split_part(objects.name, '/', 1)::uuid
          else null
        end
      )
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
        and cs.class_id = (
          case
            when split_part(objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              then split_part(objects.name, '/', 1)::uuid
            else null
          end
        )
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
      where c.id = (
        case
          when split_part(objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then split_part(objects.name, '/', 1)::uuid
          else null
        end
      )
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
