import * as SQLite from 'expo-sqlite';
import { syncRecord, syncDelete } from './sync';
import { EXERCISE_SEED_VERSION } from '../constants/exercises';

let db = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('mobileworkout.db');
    await initSchema(db);
    await migrate(db);
  }
  return db;
}

async function addColumnIfMissing(db, table, column, definition) {
  const cols = await db.getAllAsync(`PRAGMA table_info(${table})`);
  if (!cols.some(c => c.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Versioned, idempotent schema upgrades for existing installs (SQLite has no ADD COLUMN IF NOT EXISTS).
async function migrate(db) {
  const row = await db.getFirstAsync('PRAGMA user_version');
  const version = row ? row.user_version : 0;
  if (version < 1) {
    await addColumnIfMissing(db, 'logged_sets', 'rir', 'INTEGER');
    await addColumnIfMissing(db, 'logged_sets', 'side', 'TEXT');
    await addColumnIfMissing(db, 'exercises', 'is_unilateral', 'INTEGER DEFAULT 0');
    await db.execAsync('PRAGMA user_version = 1');
  }
}

// A unilateral set is logged as two rows (L and R) but counts as ONE set.
const SET_COUNT = "SUM(CASE WHEN ls.side = 'R' THEN 0 ELSE 1 END)";

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

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_logged_sets_session ON logged_sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_logged_sets_exercise ON logged_sets(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_logged_sets_created ON logged_sets(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON workout_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_date ON scheduled_workouts(date);
  `);
}

// ── User Settings ────────────────────────────────────────────────

export async function getSetting(key, defaultValue = null) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT value FROM user_settings WHERE key = ?', [key]);
  return row ? row.value : defaultValue;
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)', [key, String(value)]);
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

export async function addCustomExercise({ id, name, muscle, category, equipment, notes, isUnilateral }) {
  const db = await getDb();
  const uni = isUnilateral ? 1 : 0;
  await db.runAsync(
    'INSERT INTO exercises (id, name, muscle, category, equipment, is_custom, notes, is_unilateral) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    [id, name, muscle, category, equipment || 'Bodyweight', notes || null, uni]
  );
  syncRecord('exercises', { id, name, muscle, category, equipment: equipment || 'Bodyweight', is_custom: 1, notes: notes || null, is_unilateral: uni });
}

export async function updateCustomExercise({ id, name, muscle, category, equipment, notes, isUnilateral }) {
  const db = await getDb();
  const uni = isUnilateral ? 1 : 0;
  await db.runAsync(
    'UPDATE exercises SET name = ?, muscle = ?, category = ?, equipment = ?, notes = ?, is_unilateral = ? WHERE id = ? AND is_custom = 1',
    [name, muscle, category, equipment || 'Bodyweight', notes || null, uni, id]
  );
  const row = await db.getFirstAsync('SELECT * FROM exercises WHERE id = ?', [id]);
  if (row) syncRecord('exercises', row);
}

export async function exerciseNameExists(name, exceptId = null) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT id FROM exercises WHERE lower(name) = lower(?) AND id != ? LIMIT 1',
    [name.trim(), exceptId || '']
  );
  return !!row;
}

export async function deleteCustomExercise(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM exercises WHERE id = ? AND is_custom = 1', [id]);
  syncDelete('exercises', id);
}

// ── Templates ────────────────────────────────────────────────────

export async function getTemplates() {
  const db = await getDb();
  const templates = await db.getAllAsync('SELECT * FROM workout_templates ORDER BY name');
  for (const t of templates) {
    t.exercises = await db.getAllAsync(`
      SELECT te.*, e.name as exercise_name, e.muscle, e.equipment, e.is_unilateral
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
    SELECT te.*, e.name as exercise_name, e.muscle, e.equipment, e.is_unilateral
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
  syncRecord('workout_templates', { id, name, description: description || null, color: color || '#4d9fff' });
  await db.runAsync('DELETE FROM template_exercises WHERE template_id = ?', [id]);
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const teId = uid();
    await db.runAsync(
      'INSERT INTO template_exercises (id, template_id, exercise_id, default_sets, default_reps, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [teId, id, ex.exercise_id || ex.id, ex.default_sets || 3, ex.default_reps || 10, i]
    );
    syncRecord('template_exercises', { id: teId, template_id: id, exercise_id: ex.exercise_id || ex.id, default_sets: ex.default_sets || 3, default_reps: ex.default_reps || 10, sort_order: i });
  }
}

export async function deleteTemplate(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [id]);
  syncDelete('workout_templates', id);
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
    'SELECT * FROM logged_sets WHERE session_id = ? ORDER BY exercise_name, set_number, side',
    [id]
  );
  return session;
}

export async function createSession({ id, name, templateId }) {
  const db = await getDb();
  const startedAt = Date.now();
  await db.runAsync(
    'INSERT INTO workout_sessions (id, name, template_id, started_at) VALUES (?, ?, ?, ?)',
    [id, name, templateId || null, startedAt]
  );
  syncRecord('workout_sessions', { id, name, template_id: templateId || null, started_at: startedAt });
}

export async function finishSession(id, notes) {
  const db = await getDb();
  const finishedAt = Date.now();
  await db.runAsync(
    'UPDATE workout_sessions SET finished_at = ?, notes = ? WHERE id = ?',
    [finishedAt, notes || null, id]
  );
  const session = await db.getFirstAsync('SELECT * FROM workout_sessions WHERE id = ?', [id]);
  if (session) syncRecord('workout_sessions', session);
}

export async function logSet({ id, sessionId, exerciseId, exerciseName, setNumber, weight, reps, rir = null, side = null }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO logged_sets (id, session_id, exercise_id, exercise_name, set_number, weight, reps, completed, rir, side) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [id, sessionId, exerciseId, exerciseName, setNumber, weight, reps, rir, side]
  );
  syncRecord('logged_sets', { id, session_id: sessionId, exercise_id: exerciseId, exercise_name: exerciseName, set_number: setNumber, weight, reps, completed: 1, rir, side });
}

export async function updateSet(id, weight, reps, rir) {
  const db = await getDb();
  if (rir === undefined) {
    await db.runAsync('UPDATE logged_sets SET weight = ?, reps = ? WHERE id = ?', [weight, reps, id]);
  } else {
    await db.runAsync('UPDATE logged_sets SET weight = ?, reps = ?, rir = ? WHERE id = ?', [weight, reps, rir, id]);
  }
  const row = await db.getFirstAsync('SELECT * FROM logged_sets WHERE id = ?', [id]);
  if (row) syncRecord('logged_sets', row);
}

export async function updateSession(id, name, notes) {
  const db = await getDb();
  await db.runAsync('UPDATE workout_sessions SET name = ?, notes = ? WHERE id = ?', [name, notes || null, id]);
  const row = await db.getFirstAsync('SELECT * FROM workout_sessions WHERE id = ?', [id]);
  if (row) syncRecord('workout_sessions', row);
}

export async function deleteSet(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM logged_sets WHERE id = ?', [id]);
  syncDelete('logged_sets', id);
}

export async function deleteSession(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [id]);
  syncDelete('workout_sessions', id);
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
  syncRecord('scheduled_workouts', { id, template_id: templateId || null, date, notes: notes || null, completed: 0 });
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
  syncDelete('scheduled_workouts', id);
}

// ── Analytics ────────────────────────────────────────────────────

export async function getVolumeByMuscle(days = 30) {
  const db = await getDb();
  const since = Date.now() - days * 86400000;
  return db.getAllAsync(`
    SELECT e.muscle,
      SUM(ls.weight * ls.reps) as total_volume,
      COUNT(DISTINCT ls.session_id) as sessions,
      ${SET_COUNT} as total_sets,
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
      ${SET_COUNT} as sets
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
      ${SET_COUNT} as sets
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

export async function getSessionSummaries(limit = 500) {
  const db = await getDb();
  return db.getAllAsync(`
    SELECT ws.id, ws.name, ws.started_at, ws.finished_at, ws.notes,
      SUM(CASE WHEN ls.id IS NULL OR ls.side = 'R' THEN 0 ELSE 1 END) as total_sets,
      COALESCE(SUM(ls.weight * ls.reps), 0) as volume,
      COUNT(DISTINCT ls.exercise_id) as exercises,
      GROUP_CONCAT(DISTINCT e.muscle) as muscles
    FROM workout_sessions ws
    LEFT JOIN logged_sets ls ON ls.session_id = ws.id
    LEFT JOIN exercises e ON e.id = ls.exercise_id
    WHERE ws.finished_at IS NOT NULL
    GROUP BY ws.id
    ORDER BY ws.started_at DESC
    LIMIT ?
  `, [limit]);
}

// Per-muscle volume and set counts bucketed by week, for the overview chart.
export async function getMuscleStatsByWeek(days = 90) {
  const db = await getDb();
  const since = Date.now() - days * 86400000;
  return db.getAllAsync(`
    SELECT e.muscle,
      strftime('%Y-%W', ws.started_at / 1000, 'unixepoch') as week,
      MIN(date(ws.started_at / 1000, 'unixepoch')) as week_start,
      SUM(ls.weight * ls.reps) as volume,
      ${SET_COUNT} as sets
    FROM logged_sets ls
    JOIN exercises e ON e.id = ls.exercise_id
    JOIN workout_sessions ws ON ws.id = ls.session_id
    WHERE ws.started_at >= ? AND ws.finished_at IS NOT NULL
    GROUP BY e.muscle, week
    ORDER BY week ASC
  `, [since]);
}

// Totals per muscle within an arbitrary time window (used to compare to the previous period).
export async function getMuscleTotalsBetween(fromMs, toMs) {
  const db = await getDb();
  return db.getAllAsync(`
    SELECT e.muscle,
      SUM(ls.weight * ls.reps) as volume,
      ${SET_COUNT} as sets
    FROM logged_sets ls
    JOIN exercises e ON e.id = ls.exercise_id
    JOIN workout_sessions ws ON ws.id = ls.session_id
    WHERE ws.started_at >= ? AND ws.started_at < ? AND ws.finished_at IS NOT NULL
    GROUP BY e.muscle
  `, [fromMs, toMs]);
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

let seedingPromise = null;

// Upserts the built-in library. Skipped when the same library version was already seeded (cheap on every launch).
export function seedExercises(builtinExercises) {
  if (!seedingPromise) {
    seedingPromise = doSeed(builtinExercises).finally(() => { seedingPromise = null; });
  }
  return seedingPromise;
}

async function doSeed(builtinExercises) {
  const db = await getDb();
  const signature = `${EXERCISE_SEED_VERSION}:${builtinExercises.length}`;
  const row = await db.getFirstAsync("SELECT value FROM user_settings WHERE key = 'exercise_seed_sig'");
  const haveRows = await db.getFirstAsync('SELECT COUNT(*) AS c FROM exercises WHERE is_custom = 0');
  if (row && row.value === signature && haveRows.c >= builtinExercises.length) return;

  await db.withTransactionAsync(async () => {
    for (const ex of builtinExercises) {
      await db.runAsync(
        `INSERT INTO exercises (id, name, muscle, category, equipment, is_custom, notes, is_unilateral)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           muscle = excluded.muscle,
           category = excluded.category,
           equipment = excluded.equipment,
           notes = excluded.notes,
           is_unilateral = excluded.is_unilateral
         WHERE exercises.is_custom = 0`,
        [ex.id, ex.name, ex.muscle, ex.category, ex.equipment, ex.notes || null, ex.unilateral ? 1 : 0]
      );
    }
    await db.runAsync("INSERT OR REPLACE INTO user_settings (key, value) VALUES ('exercise_seed_sig', ?)", [signature]);
  });
}

export async function getExercise(id) {
  const db = await getDb();
  return db.getFirstAsync('SELECT * FROM exercises WHERE id = ?', [id]);
}

// ── Helpers ──────────────────────────────────────────────────────

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
