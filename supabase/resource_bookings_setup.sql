-- Resource Bookings Table
CREATE TABLE resource_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week INTEGER NOT NULL,
  location_id TEXT NOT NULL,
  period INTEGER NOT NULL,
  day INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  staff_name TEXT NOT NULL,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent double booking
CREATE UNIQUE INDEX idx_resource_bookings_unique_slot 
ON resource_bookings(week, location_id, period, day);

-- Index for fast lookups
CREATE INDEX idx_resource_bookings_week_location 
ON resource_bookings(week, location_id);

-- Enable RLS
ALTER TABLE resource_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_bookings_read_all ON resource_bookings;
DROP POLICY IF EXISTS resource_bookings_create ON resource_bookings;
DROP POLICY IF EXISTS resource_bookings_modify ON resource_bookings;
DROP POLICY IF EXISTS resource_bookings_delete ON resource_bookings;

-- Authenticated users can read bookings for operational coordination.
CREATE POLICY resource_bookings_read_all ON resource_bookings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Authenticated users can create bookings
CREATE POLICY resource_bookings_create ON resource_bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only owner or admin can update/delete
CREATE POLICY resource_bookings_modify ON resource_bookings
  FOR UPDATE USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'admin_teacher')
    )
  );

CREATE POLICY resource_bookings_delete ON resource_bookings
  FOR DELETE USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'admin_teacher')
    )
  );