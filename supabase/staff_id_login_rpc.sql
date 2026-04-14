-- Allows pre-login Staff ID / Student ID -> email lookup while keeping RLS on users table.
-- Run once in Supabase SQL Editor.

create or replace function public.get_email_by_staff_id(p_staff_id text)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
DECLARE
  user_email text;
  normalized_id text;
BEGIN
  normalized_id := lower(trim(coalesce(p_staff_id, '')));

  -- Add a small constant delay to reduce identifier-enumeration signal.
  perform pg_sleep(0.25);

  -- Validate expected ID format and reject malformed probes.
  if normalized_id = '' or length(normalized_id) > 64 or normalized_id !~ '^[a-z0-9]+$' then
    return null;
  end if;

  -- First try uid lookup
  SELECT email INTO user_email
  FROM public.users u
  WHERE lower(u.uid) = normalized_id
  LIMIT 1;

  IF user_email IS NOT NULL THEN
    RETURN user_email;
  END IF;


  -- Try direct students table lookup
  SELECT u.email INTO user_email
  FROM public.students s
  JOIN public.users u ON u.student_id_ref = s.id
  WHERE lower(s.student_id) = normalized_id
  LIMIT 1;

  RETURN user_email;
END;
$$;

revoke all on function public.get_email_by_staff_id(text) from public;
grant execute on function public.get_email_by_staff_id(text) to anon, authenticated;