-- ADD SCHOOL YEAR COLUMN TO ALL TABLES
-- Set default value to '2026 - 2027' for all existing data

-- Add school_year column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to class_students table
ALTER TABLE class_students ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to teacher_schedules table
ALTER TABLE teacher_schedules ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to assignment_grades table
ALTER TABLE assignment_grades ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to participation_grades table
ALTER TABLE participation_grades ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to weekly_plan_lessons table
ALTER TABLE weekly_plan_lessons ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to teacher_announcements table
ALTER TABLE teacher_announcements ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to teacher_announcement_targets table
ALTER TABLE teacher_announcement_targets ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to behavior_reports table
ALTER TABLE behavior_reports ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to events_deadlines table
ALTER TABLE events_deadlines ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to resource_bookings table
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Add school_year column to resources table
ALTER TABLE resources ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2026 - 2027';

-- Update all existing NULL values to default academic year
UPDATE users SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE students SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE classes SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE class_students SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE teacher_schedules SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE assignments SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE assignment_grades SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE participation_grades SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE weekly_plan_lessons SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE teacher_announcements SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE teacher_announcement_targets SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE behavior_reports SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE events_deadlines SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE resource_bookings SET school_year = '2026 - 2027' WHERE school_year IS NULL;
UPDATE resources SET school_year = '2026 - 2027' WHERE school_year IS NULL;

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