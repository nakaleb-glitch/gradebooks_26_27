-- ADD SCHOOL YEAR COLUMN TO ALL TABLES
-- Set default value to '2026 - 2027' for all existing data

-- First set default academic year
DO $$
DECLARE
    current_academic_year TEXT := '2026 - 2027';
    table_names TEXT[];
    tbl TEXT;
BEGIN

    -- Add school_year column to users table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'school_year') THEN
        ALTER TABLE users ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to students table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'school_year') THEN
        ALTER TABLE students ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to classes table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'school_year') THEN
        ALTER TABLE classes ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to class_students table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_students' AND column_name = 'school_year') THEN
        ALTER TABLE class_students ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to teacher_schedules table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_schedules' AND column_name = 'school_year') THEN
        ALTER TABLE teacher_schedules ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to assignments table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'school_year') THEN
        ALTER TABLE assignments ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to assignment_grades table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_grades' AND column_name = 'school_year') THEN
        ALTER TABLE assignment_grades ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to participation_grades table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'participation_grades' AND column_name = 'school_year') THEN
        ALTER TABLE participation_grades ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to weekly_plan_lessons table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'weekly_plan_lessons' AND column_name = 'school_year') THEN
        ALTER TABLE weekly_plan_lessons ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to teacher_announcements table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_announcements' AND column_name = 'school_year') THEN
        ALTER TABLE teacher_announcements ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to teacher_announcement_targets table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_announcement_targets' AND column_name = 'school_year') THEN
        ALTER TABLE teacher_announcement_targets ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to behavior_reports table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'behavior_reports' AND column_name = 'school_year') THEN
        ALTER TABLE behavior_reports ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to events_deadlines table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events_deadlines' AND column_name = 'school_year') THEN
        ALTER TABLE events_deadlines ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to resource_bookings table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_bookings' AND column_name = 'school_year') THEN
        ALTER TABLE resource_bookings ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Add school_year column to resources table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'school_year') THEN
        ALTER TABLE resources ADD COLUMN school_year TEXT DEFAULT current_academic_year;
    END IF;

    -- Update all existing NULL values to default academic year
    table_names := ARRAY[
        'users', 'students', 'classes', 'class_students', 'teacher_schedules',
        'assignments', 'assignment_grades', 'participation_grades', 'weekly_plan_lessons',
        'teacher_announcements', 'teacher_announcement_targets', 'behavior_reports',
        'events_deadlines', 'resource_bookings', 'resources'
    ];

    FOREACH tbl IN ARRAY table_names LOOP
        EXECUTE format('UPDATE %I SET school_year = %L WHERE school_year IS NULL', tbl, current_academic_year);
    END LOOP;

END $$;

-- Create index on school_year for all tables
CREATE INDEX IF NOT EXISTS idx_users_school_year ON users(school_year);
CREATE INDEX IF NOT EXISTS idx_students_school_year ON students(school_year);
CREATE INDEX IF NOT EXISTS idx_classes_school_year ON classes(school_year);
CREATE INDEX IF NOT EXISTS idx_class_students_school_year ON class_students(school_year);
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_school_year ON teacher_schedules(school_year);
CREATE INDEX IF NOT EXISTS idx_assignments_school_year ON assignments(school_year);
CREATE INDEX IF NOT EXISTS idx_assignment_grades_school_year ON assignment_grades(school_year);
CREATE INDEX IF NOT EXISTS idx_participation_grades_school_year ON participation_grades(school_year);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_lessons_school_year ON weekly_plan_lessons(school_year);
CREATE INDEX IF NOT EXISTS idx_teacher_announcements_school_year ON teacher_announcements(school_year);
CREATE INDEX IF NOT EXISTS idx_behavior_reports_school_year ON behavior_reports(school_year);
CREATE INDEX IF NOT EXISTS idx_events_deadlines_school_year ON events_deadlines(school_year);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_school_year ON resource_bookings(school_year);
CREATE INDEX IF NOT EXISTS idx_resources_school_year ON resources(school_year);