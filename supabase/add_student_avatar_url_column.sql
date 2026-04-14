-- Add avatar_url column to students table
ALTER TABLE students
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_students_avatar_url ON students(avatar_url);

-- Update RLS policies to allow updates for students
DROP POLICY IF EXISTS "Students can update their own avatar" ON students;
CREATE POLICY "Students can update their own avatar" ON students
  FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM users WHERE student_id_ref = students.id))
  WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE student_id_ref = students.id));

-- Allow admins full access
DROP POLICY IF EXISTS "Admins can view all students" ON students;
CREATE POLICY "Admins can view all students" ON students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'admin_teacher')
    )
  );

-- Grant permissions
GRANT UPDATE(avatar_url) ON students TO authenticated;