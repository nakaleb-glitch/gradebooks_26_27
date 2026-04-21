alter table public.weekly_lesson_materials
  add column if not exists description text;

alter table public.weekly_lesson_materials
  drop constraint if exists weekly_lesson_materials_link_or_file_check;

alter table public.weekly_lesson_materials
  add constraint weekly_lesson_materials_has_source_check
  check (external_url is not null or storage_path is not null);
