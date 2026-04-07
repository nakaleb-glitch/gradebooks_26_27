-- 1) Core tables expected by the app
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users',
    'students',
    'classes',
    'class_students',
    'resource_links',
    'participation_grades',
    'assignments',
    'assignment_grades',
    'progress_test_grades',
    'term_comments',
    'events_deadlines',
    'student_attributes'
  )
order by table_name;

-- 2) Required columns for newer features
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'resource_links' and column_name = 'grade')
    or (table_name = 'assignment_grades' and column_name = 'comment')
    or (table_name = 'progress_test_grades' and column_name = 'comment')
    or (table_name = 'users' and column_name in ('staff_id', 'must_change_password'))
    or (table_name = 'events_deadlines' and column_name in ('item_type', 'event_date', 'title', 'venue', 'description', 'plan_url'))
    or (table_name = 'student_attributes' and column_name in ('confident', 'responsible', 'reflective', 'innovative', 'engaged'))
  )
order by table_name, column_name;

-- 3) Check unique/index expectations used by upserts
select
  t.relname as table_name,
  i.relname as index_name,
  ix.indisunique as is_unique,
  pg_get_indexdef(i.oid) as index_def
from pg_class t
join pg_index ix on t.oid = ix.indrelid
join pg_class i on i.oid = ix.indexrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in (
    'students',
    'class_students',
    'participation_grades',
    'assignment_grades',
    'progress_test_grades',
    'term_comments',
    'student_attributes'
  )
order by t.relname, i.relname;

-- 4) Row counts (quick sanity check for data flow)
select 'users' as table_name, count(*) as rows from public.users
union all
select 'students', count(*) from public.students
union all
select 'classes', count(*) from public.classes
union all
select 'class_students', count(*) from public.class_students
union all
select 'resource_links', count(*) from public.resource_links
union all
select 'participation_grades', count(*) from public.participation_grades
union all
select 'assignments', count(*) from public.assignments
union all
select 'assignment_grades', count(*) from public.assignment_grades
union all
select 'progress_test_grades', count(*) from public.progress_test_grades
union all
select 'term_comments', count(*) from public.term_comments
union all
select 'events_deadlines', count(*) from public.events_deadlines
union all
select 'student_attributes', count(*) from public.student_attributes
order by table_name;

-- 5) Spot-check latest event/deadline records
select id, item_type, event_date, title, venue, created_at
from public.events_deadlines
order by event_date asc, created_at desc
limit 20;

-- 6) Spot-check latest student attributes
select class_id, student_id, term, confident, responsible, reflective, innovative, engaged, updated_at
from public.student_attributes
order by updated_at desc nulls last
limit 20;
