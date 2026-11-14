import * as SQLite from 'expo-sqlite';

let db = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('mobileworkout.db');
    await initSchema(db);
  }
  return db;
}

async function initSchema(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      muscle TEXT NOT NULL,
      category TEXT NOT NULL,
      equipment TEXT,
      is_custom INTEGER DEFAULT 0,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#4d9fff',
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS template_exercises (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      default_sets INTEGER DEFAULT 3,
      default_reps INTEGER DEFAULT 10,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      template_id TEXT,
      name TEXT NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      notes TEXT,
      FOREIGN KEY (template_id) REFERENCES workout_templates(id)
    );

    CREATE TABLE IF NOT EXISTS logged_sets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      set_number INTEGER,
      weight REAL,
      reps INTEGER,
      completed INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scheduled_workouts (
      id TEXT PRIMARY KEY,
      template_id TEXT,
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      session_id TEXT,
      notes TEXT,
      FOREIGN KEY (template_id) REFERENCES workout_templates(id)
    );

    CREATE INDEX IF NOT EXISTS idx_logged_sets_session ON logged_sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_logged_sets_exercise ON logged_sets(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_logged_sets_created ON logged_sets(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON workout_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_date ON scheduled_workouts(date);
  `);
}

// ── Exercises ────────────────────────────────────────────────────

export async function getAllExercises() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM exercises ORDER BY muscle, name');
}

export async function getCustomExercises() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM exercises WHERE is_custom = 1 ORDER BY name');
}

export async function addCustomExercise({ id, name, muscle, category, equipment, notes }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO exercises (id, name, muscle, category, equipment, is_custom, notes) VALUES (?, ?, ?, ?, ?, 1, ?)',
    [id, name, muscle, category, equipment || 'Bodyweight', notes || null]
  );
}

export async function deleteCustomExercise(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM exercises WHERE id = ? AND is_custom = 1', [id]);
}

// ── Templates ────────────────────────────────────────────────────

export async function getTemplates() {
  const db = await getDb();
  const templates = await db.getAllAsync('SELECT * FROM workout_templates ORDER BY name');
  for (const t of templates) {
    t.exercises = await db.getAllAsync(`
      SELECT te.*, e.name as exercise_name, e.muscle, e.equipment
      FROM template_exercises te
      JOIN exercises e ON e.id = te.exercise_id
      WHERE te.template_id = ?
      ORDER BY te.sort_order
    `, [t.id]);
  }
  return templates;
}

export async function getTemplate(id) {
  const db = await getDb();
  const t = await db.getFirstAsync('SELECT * FROM workout_templates WHERE id = ?', [id]);
  if (!t) return null;
  t.exercises = await db.getAllAsync(`
    SELECT te.*, e.name as exercise_name, e.muscle, e.equipment
    FROM template_exercises te
    JOIN exercises e ON e.id = te.exercise_id
    WHERE te.template_id = ?
    ORDER BY te.sort_order
  `, [id]);
  return t;
}

export async function saveTemplate({ id, name, description, color, exercises }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO workout_templates (id, name, description, color) VALUES (?, ?, ?, ?)',
    [id, name, description || null, color || '#4d9fff']
  );
  await db.runAsync('DELETE FROM template_exercises WHERE template_id = ?', [id]);
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    await db.runAsync(
      'INSERT INTO template_exercises (id, template_id, exercise_id, default_sets, default_reps, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [uid(), id, ex.exercise_id || ex.id, ex.default_sets || 3, ex.default_reps || 10, i]
    );
  }
}

export async function deleteTemplate(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [id]);
}

// ── Sessions ─────────────────────────────────────────────────────

export async function getSessions(limit = 50) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM workout_sessions WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT ?',
    [limit]
  );
}

export async function getSession(id) {
  const db = await getDb();
  const session = await db.getFirstAsync('SELECT * FROM workout_sessions WHERE id = ?', [id]);
  if (!session) return null;
  session.sets = await db.getAllAsync(
    'SELECT * FROM logged_sets WHERE session_id = ? ORDER BY exercise_name, set_number',
    [id]
  );
  return session;
}

export async function createSession({ id, name, templateId }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO workout_sessions (id, name, template_id, started_at) VALUES (?, ?, ?, ?)',
    [id, name, templateId || null, Date.now()]
  );
}

export async function finishSession(id, notes) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE workout_sessions SET finished_at = ?, notes = ? WHERE id = ?',
    [Date.now(), notes || null, id]
  );
}

export async function logSet({ id, sessionId, exerciseId, exerciseName, setNumber, weight, reps }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO logged_sets (id, session_id, exercise_id, exercise_name, set_number, weight, reps, completed) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    [id, sessionId, exerciseId, exerciseName, setNumber, weight, reps]
  );
}

export async function deleteSet(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM logged_sets WHERE id = ?', [id]);
}

export async function deleteSession(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [id]);
}

// ── Schedule ─────────────────────────────────────────────────────

export async function getScheduledWorkouts(fromDate, toDate) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT sw.*, wt.name as template_name, wt.color FROM scheduled_workouts sw LEFT JOIN workout_templates wt ON wt.id = sw.template_id WHERE sw.date >= ? AND sw.date <= ? ORDER BY sw.date',
    [fromDate, toDate]
  );
}

export async function scheduleWorkout({ id, templateId, date, notes }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO scheduled_workouts (id, template_id, date, notes) VALUES (?, ?, ?, ?)',
    [id, templateId || null, date, notes || null]
  );
}

export async function markScheduledComplete(id, sessionId) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE scheduled_workouts SET completed = 1, session_id = ? WHERE id = ?',
    [sessionId, id]
  );
}

export async function deleteScheduled(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM scheduled_workouts WHERE id = ?', [id]);
}

// ── Analytics ────────────────────────────────────────────────────

export async function getVolumeByMuscle(days = 30) {
  const db = await getDb();
  const since = Date.now() - days * 86400000;
  return db.getAllAsync(`
    SELECT e.muscle,
      SUM(ls.weight * ls.reps) as total_volume,
      COUNT(DISTINCT ls.session_id) as sessions,
      COUNT(*) as total_sets,
      MAX(ls.weight) as max_weight
    FROM logged_sets ls
    JOIN exercises e ON e.id = ls.exercise_id
    JOIN workout_sessions ws ON ws.id = ls.session_id
    WHERE ws.started_at >= ? AND ws.finished_at IS NOT NULL
    GROUP BY e.muscle
    ORDER BY total_volume DESC
  `, [since]);
}

export async function getVolumeOverTime(exerciseId, days = 90) {
  const db = await getDb();
  const since = Date.now() - days * 86400000;
  return db.getAllAsync(`
    SELECT
      date(ws.started_at / 1000, 'unixepoch') as workout_date,
      SUM(ls.weight * ls.reps) as volume,
      MAX(ls.weight) as max_weight,
      SUM(ls.reps) as total_reps,
      COUNT(*) as sets
    FROM logged_sets ls
    JOIN workout_sessions ws ON ws.id = ls.session_id
    WHERE ls.exercise_id = ? AND ws.started_at >= ? AND ws.finished_at IS NOT NULL
    GROUP BY workout_date
    ORDER BY workout_date ASC
  `, [exerciseId, since]);
}

export async function getMuscleVolumeOverTime(muscle, days = 90) {
  const db = await getDb();
  const since = Date.now() - days * 86400000;
  return db.getAllAsync(`
    SELECT
      date(ws.started_at / 1000, 'unixepoch') as workout_date,
      SUM(ls.weight * ls.reps) as volume,
      COUNT(*) as sets
    FROM logged_sets ls
    JOIN exercises e ON e.id = ls.exercise_id
    JOIN workout_sessions ws ON ws.id = ls.session_id
    WHERE e.muscle = ? AND ws.started_at >= ? AND ws.finished_at IS NOT NULL
    GROUP BY workout_date
    ORDER BY workout_date ASC
  `, [muscle, since]);
}

export async function getPersonalRecords() {
  const db = await getDb();
  return db.getAllAsync(`
    SELECT ls.exercise_id, ls.exercise_name, e.muscle,
      MAX(ls.weight) as max_weight,
      MAX(ls.reps) as max_reps
    FROM logged_sets ls
    LEFT JOIN exercises e ON e.id = ls.exercise_id
    WHERE ls.weight > 0
    GROUP BY ls.exercise_id
    ORDER BY e.muscle, ls.exercise_name
  `);
}

export async function getWeeklyFrequency(weeks = 12) {
  const db = await getDb();
  const since = Date.now() - weeks * 7 * 86400000;
  return db.getAllAsync(`
    SELECT
      strftime('%Y-W%W', ws.started_at / 1000, 'unixepoch') as week,
      COUNT(*) as workouts,
      SUM(CASE WHEN ls.session_id IS NOT NULL THEN 1 ELSE 0 END) as total_sets
    FROM workout_sessions ws
    LEFT JOIN logged_sets ls ON ls.session_id = ws.id
    WHERE ws.started_at >= ? AND ws.finished_at IS NOT NULL
    GROUP BY week
    ORDER BY week ASC
  `, [since]);
}

export async function getLastSessionPerMuscle() {
  const db = await getDb();
  return db.getAllAsync(`
    SELECT e.muscle, MAX(ws.started_at) as last_trained
    FROM logged_sets ls
    JOIN exercises e ON e.id = ls.exercise_id
    JOIN workout_sessions ws ON ws.id = ls.session_id
    WHERE ws.finished_at IS NOT NULL
    GROUP BY e.muscle
  `);
}

export async function getRecentSetsForExercise(exerciseId, limit = 10) {
  const db = await getDb();
  return db.getAllAsync(`
    SELECT ls.*, ws.started_at as session_date
    FROM logged_sets ls
    JOIN workout_sessions ws ON ws.id = ls.session_id
    WHERE ls.exercise_id = ? AND ws.finished_at IS NOT NULL
    ORDER BY ws.started_at DESC, ls.set_number ASC
    LIMIT ?
  `, [exerciseId, limit]);
}

// ── Seed built-in exercises ───────────────────────────────────────

export async function seedExercises(builtinExercises) {
  const db = await getDb();
  const existing = await db.getFirstAsync('SELECT COUNT(*) as count FROM exercises WHERE is_custom = 0');
  if (existing.count > 0) return;
  for (const ex of builtinExercises) {
    await db.runAsync(
      'INSERT OR IGNORE INTO exercises (id, name, muscle, category, equipment, is_custom) VALUES (?, ?, ?, ?, ?, 0)',
      [ex.id, ex.name, ex.muscle, ex.category, ex.equipment]
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
