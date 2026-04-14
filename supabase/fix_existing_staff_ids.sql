-- Run this ONCE in Supabase SQL Editor to fix existing student profiles with incorrect casing
UPDATE public.users 
SET staff_id = LOWER(TRIM(staff_id)) 
WHERE role = 'student' 
AND staff_id IS NOT NULL
AND staff_id != LOWER(TRIM(staff_id));

-- Verify how many records were fixed
SELECT COUNT(*) as fixed_student_accounts
FROM public.users
WHERE role = 'student';