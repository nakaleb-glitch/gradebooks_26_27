-- Weekly Plans Database Schema
CREATE TABLE IF NOT EXISTS weekly_plan_lessons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
    week integer NOT NULL,
    lesson_number integer NOT NULL,
    content text,
    objectives text,
    resources text,
    status text DEFAULT 'not_started', -- not_started, draft, submitted, approved
    submitted_at timestamp with time zone,
    submitted_by uuid REFERENCES users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(class_id, week, lesson_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_weekly_plans_class_week ON weekly_plan_lessons(class_id, week);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_week ON weekly_plan_lessons(week);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_submitted_by ON weekly_plan_lessons(submitted_by);

-- Enable RLS
ALTER TABLE weekly_plan_lessons ENABLE ROW LEVEL SECURITY;

-- Policies:
DROP POLICY IF EXISTS "Teachers can view all weekly plans" ON weekly_plan_lessons;
DROP POLICY IF EXISTS "Teachers can edit their own class weekly plans" ON weekly_plan_lessons;
DROP POLICY IF EXISTS "Teachers can update their own class weekly plans" ON weekly_plan_lessons;
DROP POLICY IF EXISTS "Admins have full access to weekly plans" ON weekly_plan_lessons;

-- Teachers can read plans for classes they are assigned to.
CREATE POLICY "Teachers can view own class weekly plans" ON weekly_plan_lessons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = weekly_plan_lessons.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

-- Teachers can only edit plans for classes they are assigned to
CREATE POLICY "Teachers can edit their own class weekly plans" ON weekly_plan_lessons
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE id = class_id 
            AND teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update their own class weekly plans" ON weekly_plan_lessons
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE id = class_id 
            AND teacher_id = auth.uid()
        )
    );

-- Admins have full access
CREATE POLICY "Admins have full access to weekly plans" ON weekly_plan_lessons
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'admin_teacher')
        )
    );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_weekly_plan_updated_at ON weekly_plan_lessons;
CREATE TRIGGER trigger_update_weekly_plan_updated_at
    BEFORE UPDATE ON weekly_plan_lessons
    FOR EACH ROW EXECUTE FUNCTION update_weekly_plan_updated_at();