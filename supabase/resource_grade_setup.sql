alter table public.resource_links
add column if not exists grade text;

create index if not exists resource_links_grade_idx
on public.resource_links (grade);
