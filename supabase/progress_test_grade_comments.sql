alter table public.progress_test_grades
add column if not exists test_comment text;

update public.progress_test_grades
set test_comment = comment
where test_comment is null
  and comment is not null;
