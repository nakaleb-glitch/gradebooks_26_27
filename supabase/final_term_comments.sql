create table if not exists public.term_comments (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term text not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, student_id, term)
);

alter table public.term_comments enable row level security;

drop policy if exists "Teachers can manage own class term comments" on public.term_comments;
create policy "Teachers can manage own class term comments" on public.term_comments
for all
using (
  exists (
    select 1
    from public.classes c
    where c.id = term_comments.class_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = term_comments.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "Admins can manage term comments" on public.term_comments;
create policy "Admins can manage term comments" on public.term_comments
for all
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'admin_teacher')
  )
);
