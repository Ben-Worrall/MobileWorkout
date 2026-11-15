const { Client } = require('pg');

const client = new Client({
  host: 'db.shrawyvdtfrccroetnxy.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'sb_secret_5NHJF',
  ssl: { rejectUnauthorized: false },
});

const SQL = `
-- exercises (built-in have user_id = null, custom have user_id set)
CREATE TABLE IF NOT EXISTS public.exercises (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sb_sessions_user ON public.workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sb_sets_session ON public.logged_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_sb_sets_user ON public.logged_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_sb_templates_user ON public.workout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_sb_scheduled_user ON public.scheduled_workouts(user_id);

-- Row Level Security
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logged_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
DROP POLICY IF EXISTS exercises_policy ON public.exercises;
CREATE POLICY exercises_policy ON public.exercises
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS templates_policy ON public.workout_templates;
CREATE POLICY templates_policy ON public.workout_templates
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS template_exercises_policy ON public.template_exercises;
CREATE POLICY template_exercises_policy ON public.template_exercises
  USING (
    template_id IN (
      SELECT id FROM public.workout_templates WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS sessions_policy ON public.workout_sessions;
CREATE POLICY sessions_policy ON public.workout_sessions
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS sets_policy ON public.logged_sets;
CREATE POLICY sets_policy ON public.logged_sets
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS scheduled_policy ON public.scheduled_workouts;
CREATE POLICY scheduled_policy ON public.scheduled_workouts
  USING (user_id = auth.uid());
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase');
    await client.query(SQL);
    console.log('Schema created successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
