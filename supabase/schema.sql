-- Gym Note cloud schema. Run in the Supabase SQL editor (or via the Management API).
-- Contains no credentials. Every table is protected by row level security: a user can only see and change rows they own,
-- and the anonymous role has no table access at all.

CREATE TABLE IF NOT EXISTS public.exercises (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  muscle TEXT NOT NULL,
  category TEXT NOT NULL,
  equipment TEXT,
  is_custom INTEGER DEFAULT 0,
  notes TEXT,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE TABLE IF NOT EXISTS public.workout_templates (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4d9fff',
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE TABLE IF NOT EXISTS public.template_exercises (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  default_sets INTEGER DEFAULT 3,
  default_reps INTEGER DEFAULT 10,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT,
  name TEXT NOT NULL,
  started_at BIGINT,
  finished_at BIGINT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.logged_sets (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER,
  weight REAL,
  reps INTEGER,
  completed INTEGER DEFAULT 1,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE TABLE IF NOT EXISTS public.scheduled_workouts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT,
  date TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  session_id TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sb_sessions_user ON public.workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sb_sets_session ON public.logged_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_sb_sets_user ON public.logged_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_sb_templates_user ON public.workout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_sb_scheduled_user ON public.scheduled_workouts(user_id);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logged_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercises_policy ON public.exercises;
DROP POLICY IF EXISTS templates_policy ON public.workout_templates;
DROP POLICY IF EXISTS template_exercises_policy ON public.template_exercises;
DROP POLICY IF EXISTS sessions_policy ON public.workout_sessions;
DROP POLICY IF EXISTS sets_policy ON public.logged_sets;
DROP POLICY IF EXISTS scheduled_policy ON public.scheduled_workouts;

CREATE POLICY exercises_policy ON public.exercises FOR ALL TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY templates_policy ON public.workout_templates FOR ALL TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY sessions_policy ON public.workout_sessions FOR ALL TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY sets_policy ON public.logged_sets FOR ALL TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY scheduled_policy ON public.scheduled_workouts FOR ALL TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY template_exercises_policy ON public.template_exercises FOR ALL TO authenticated
  USING (template_id IN (SELECT id FROM public.workout_templates WHERE user_id = (select auth.uid())))
  WITH CHECK (template_id IN (SELECT id FROM public.workout_templates WHERE user_id = (select auth.uid())));

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
NOTIFY pgrst, 'reload schema';
