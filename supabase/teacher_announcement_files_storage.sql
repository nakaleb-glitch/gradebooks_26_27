-- Storage for teacher announcement PDFs. Run after teacher_announcements exists.
-- Path convention: {announcement_id}/{timestamp}-{safe_filename}.pdf

insert into storage.buckets (id, name, public)
values ('announcement-files', 'announcement-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Teachers upload announcement PDFs" on storage.objects;
create policy "Teachers upload announcement PDFs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'announcement-files'
  and exists (
    select 1
    from public.teacher_announcements ta
    where ta.id = split_part(name, '/', 1)::uuid
      and ta.teacher_id = auth.uid()
  )
);

drop policy if exists "Announcement PDFs readable by teacher or targeted students" on storage.objects;
create policy "Announcement PDFs readable by teacher or targeted students"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'announcement-files'
  and exists (
    select 1
    from public.teacher_announcements ta
    where ta.id = split_part(name, '/', 1)::uuid
      and (
        ta.teacher_id = auth.uid()
        or public.student_can_read_teacher_announcement(ta.id)
      )
  )
);

drop policy if exists "Teachers delete own announcement PDFs" on storage.objects;
create policy "Teachers delete own announcement PDFs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'announcement-files'
  and exists (
    select 1
    from public.teacher_announcements ta
    where ta.id = split_part(name, '/', 1)::uuid
      and ta.teacher_id = auth.uid()
  )
);

drop policy if exists "Admins can read announcement PDFs" on storage.objects;
create policy "Admins can read announcement PDFs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'announcement-files'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);
