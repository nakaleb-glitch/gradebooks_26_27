-- Teacher Schedules Database Setup
-- Run this migration in Supabase SQL Editor

CREATE TABLE teacher_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL, -- 'primary' / 'secondary'
  class_name text NOT NULL,
  day smallint NOT NULL, -- 0 = Monday, 1 = Tuesday ... 4 = Friday
  period smallint NOT NULL,
  teacher_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(level, class_name, day, period)
);

-- Indexes
CREATE INDEX idx_teacher_schedules_level ON teacher_schedules(level);
CREATE INDEX idx_teacher_schedules_class ON teacher_schedules(class_name);
CREATE INDEX idx_teacher_schedules_teacher ON teacher_schedules(teacher_id);
CREATE INDEX idx_teacher_schedules_day_period ON teacher_schedules(day, period);

-- Enable RLS
ALTER TABLE teacher_schedules ENABLE ROW LEVEL SECURITY;

-- Admin and admin_teacher users can manage all schedules.
DROP POLICY IF EXISTS "Admins can manage teacher schedules" ON teacher_schedules;
CREATE POLICY "Admins can manage teacher schedules" ON teacher_schedules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'admin_teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'admin_teacher')
    )
  );

-- Teachers can view their own schedules
DROP POLICY IF EXISTS "Teachers can view their own schedules" ON teacher_schedules;
CREATE POLICY "Teachers can view their own schedules" ON teacher_schedules
  FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_teacher_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teacher_schedules_updated_at
  BEFORE UPDATE ON teacher_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_teacher_schedules_updated_at();