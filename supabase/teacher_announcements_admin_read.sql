-- Allow admins to view teacher announcements when browsing classes (RLS).
-- Run once in Supabase SQL editor if teacher_announcements_setup.sql was applied before these policies existed.

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
      and u.role = 'admin'
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
      and u.role = 'admin'
  )
);
