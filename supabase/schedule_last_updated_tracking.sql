-- Schedule Last Updated tracking
CREATE TABLE IF NOT EXISTS schedule_audit (
  level text PRIMARY KEY,
  last_updated_at timestamptz DEFAULT now(),
  last_updated_by uuid REFERENCES users(id)
);

-- Insert initial records
INSERT INTO schedule_audit (level) VALUES ('primary') ON CONFLICT DO NOTHING;
INSERT INTO schedule_audit (level) VALUES ('secondary') ON CONFLICT DO NOTHING;

-- Function to update audit
CREATE OR REPLACE FUNCTION update_schedule_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- DELETE triggers do not have NEW, so coalesce NEW/OLD safely.
  UPDATE schedule_audit 
  SET last_updated_at = now(),
      last_updated_by = auth.uid()
  WHERE level = COALESCE(NEW.level, OLD.level);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for any schedule change
DROP TRIGGER IF EXISTS trigger_update_schedule_audit ON teacher_schedules;
CREATE TRIGGER trigger_update_schedule_audit
AFTER INSERT OR UPDATE OR DELETE ON teacher_schedules
FOR EACH ROW EXECUTE FUNCTION update_schedule_audit();