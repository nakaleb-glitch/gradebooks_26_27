alter table public.assignment_grades
add column if not exists comment text;

alter table public.progress_test_grades
add column if not exists comment text;
