create table if not exists public.student_attributes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term text not null,
  confident text check (confident in ('G', 'S', 'N')),
  responsible text check (responsible in ('G', 'S', 'N')),
  reflective text check (reflective in ('G', 'S', 'N')),
  innovative text check (innovative in ('G', 'S', 'N')),
  engaged text check (engaged in ('G', 'S', 'N')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id, term)
);

create index if not exists student_attributes_class_term_idx
  on public.student_attributes (class_id, term);

create or replace function public.set_student_attributes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_student_attributes_updated_at on public.student_attributes;
create trigger trg_student_attributes_updated_at
before update on public.student_attributes
for each row
execute function public.set_student_attributes_updated_at();
