-- Singleton JSON store for admin Period Allocation tool (survives deploys).

CREATE TABLE IF NOT EXISTS public.period_allocation_state (
  id text PRIMARY KEY DEFAULT 'default',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT period_allocation_state_singleton CHECK (id = 'default')
);

COMMENT ON TABLE public.period_allocation_state IS 'Period allocation grids (bilingual/integrated); admin-only via RLS.';

ALTER TABLE public.period_allocation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles can read period allocation state"
  ON public.period_allocation_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'admin_teacher')
    )
  );

CREATE POLICY "Admin roles can insert period allocation state"
  ON public.period_allocation_state
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'admin_teacher')
    )
  );

CREATE POLICY "Admin roles can update period allocation state"
  ON public.period_allocation_state
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'admin_teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'admin_teacher')
    )
  );
