-- Week-scoped cover assignments for teacher schedules.
CREATE TABLE IF NOT EXISTS public.teacher_schedule_covers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_schedule_id uuid NOT NULL REFERENCES public.teacher_schedules(id) ON DELETE CASCADE,
  week smallint NOT NULL CHECK (week >= 0 AND week <= 39),
  cover_teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notes text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (base_schedule_id, week)
);

CREATE INDEX IF NOT EXISTS idx_teacher_schedule_covers_week
  ON public.teacher_schedule_covers(week);
CREATE INDEX IF NOT EXISTS idx_teacher_schedule_covers_cover_teacher
  ON public.teacher_schedule_covers(cover_teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schedule_covers_base_schedule
  ON public.teacher_schedule_covers(base_schedule_id);

ALTER TABLE public.teacher_schedule_covers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage teacher schedule covers" ON public.teacher_schedule_covers;
CREATE POLICY "Admins can manage teacher schedule covers"
  ON public.teacher_schedule_covers
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

DROP POLICY IF EXISTS "Teachers can view related schedule covers" ON public.teacher_schedule_covers;
CREATE POLICY "Teachers can view related schedule covers"
  ON public.teacher_schedule_covers
  FOR SELECT
  TO authenticated
  USING (
    cover_teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.teacher_schedules ts
      WHERE ts.id = teacher_schedule_covers.base_schedule_id
        AND ts.teacher_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.update_teacher_schedule_covers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_teacher_schedule_covers_updated_at ON public.teacher_schedule_covers;
CREATE TRIGGER update_teacher_schedule_covers_updated_at
  BEFORE UPDATE ON public.teacher_schedule_covers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_teacher_schedule_covers_updated_at();

CREATE OR REPLACE FUNCTION public.update_schedule_audit_from_cover()
RETURNS TRIGGER AS $$
DECLARE
  target_level text;
BEGIN
  SELECT ts.level
  INTO target_level
  FROM public.teacher_schedules ts
  WHERE ts.id = COALESCE(NEW.base_schedule_id, OLD.base_schedule_id);

  IF target_level IS NOT NULL THEN
    UPDATE public.schedule_audit
    SET last_updated_at = now(),
        last_updated_by = auth.uid()
    WHERE level = target_level;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_schedule_audit_from_cover ON public.teacher_schedule_covers;
CREATE TRIGGER trigger_update_schedule_audit_from_cover
  AFTER INSERT OR UPDATE OR DELETE ON public.teacher_schedule_covers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedule_audit_from_cover();
