alter table public.weekly_lesson_materials
  add column if not exists updated_by uuid references public.users(id);

create index if not exists idx_weekly_lesson_materials_updated_by
  on public.weekly_lesson_materials(updated_by);
