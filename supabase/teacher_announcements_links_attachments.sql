-- Run in Supabase SQL editor if teacher_announcements already exists without link/attachment columns.

alter table public.teacher_announcements
  add column if not exists link_url text;

alter table public.teacher_announcements
  add column if not exists attachment_url text;

alter table public.teacher_announcements
  add column if not exists attachment_name text;

comment on column public.teacher_announcements.attachment_url is
  'Path inside storage bucket announcement-files, e.g. {announcement_id}/file.pdf';
