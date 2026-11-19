import { supabase } from './supabase';
import { getDb } from './database';

// Upload all local SQLite data to Supabase under the current user.
// Called once after sign-up or first sign-in on a new device.
export async function uploadLocalData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const db = await getDb();

  // Custom exercises
  const customExercises = await db.getAllAsync('SELECT * FROM exercises WHERE is_custom = 1');
  if (customExercises.length) {
    await supabase.from('exercises').upsert(
      customExercises.map(e => ({ ...e, user_id: user.id })),
      { onConflict: 'id' }
    );
  }

  // Templates
  const templates = await db.getAllAsync('SELECT * FROM workout_templates');
  if (templates.length) {
    await supabase.from('workout_templates').upsert(
      templates.map(t => ({ ...t, user_id: user.id })),
      { onConflict: 'id' }
    );
  }

  // Template exercises
  const templateExercises = await db.getAllAsync('SELECT * FROM template_exercises');
  if (templateExercises.length) {
    await supabase.from('template_exercises').upsert(templateExercises, { onConflict: 'id' });
  }

  // Sessions
  const sessions = await db.getAllAsync('SELECT * FROM workout_sessions WHERE finished_at IS NOT NULL');
  if (sessions.length) {
    await supabase.from('workout_sessions').upsert(
      sessions.map(s => ({ ...s, user_id: user.id })),
      { onConflict: 'id' }
    );
  }

  // Logged sets
  const sets = await db.getAllAsync('SELECT * FROM logged_sets');
  if (sets.length) {
    await supabase.from('logged_sets').upsert(
      sets.map(s => ({ ...s, user_id: user.id })),
      { onConflict: 'id' }
    );
  }

  // Scheduled workouts
  const scheduled = await db.getAllAsync('SELECT * FROM scheduled_workouts');
  if (scheduled.length) {
    await supabase.from('scheduled_workouts').upsert(
      scheduled.map(s => ({ ...s, user_id: user.id })),
      { onConflict: 'id' }
    );
  }
}

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Restore everything stored in the signed-in user's cloud account into local SQLite.
// Order matters because of foreign keys. Existing local rows with the same id are overwritten.
export async function downloadCloudData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { restored: 0 };

  const db = await getDb();
  const plan = [
    ['exercises', ['id', 'name', 'muscle', 'category', 'equipment', 'is_custom', 'notes', 'created_at'], r => r.is_custom === 1],
    ['workout_templates', ['id', 'name', 'description', 'color', 'created_at']],
    ['template_exercises', ['id', 'template_id', 'exercise_id', 'default_sets', 'default_reps', 'sort_order']],
    ['workout_sessions', ['id', 'template_id', 'name', 'started_at', 'finished_at', 'notes']],
    ['logged_sets', ['id', 'session_id', 'exercise_id', 'exercise_name', 'set_number', 'weight', 'reps', 'completed', 'created_at']],
    ['scheduled_workouts', ['id', 'template_id', 'date', 'completed', 'session_id', 'notes']],
  ];

  let restored = 0;
  for (const [table, cols, keep] of plan) {
    const rows = (await fetchAll(table)).filter(r => (keep ? keep(r) : true));
    const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    for (const r of rows) {
      try {
        await db.runAsync(sql, cols.map(c => (r[c] === undefined ? null : r[c])));
        restored++;
      } catch (e) {
        console.warn(`[sync] restore ${table} ${r.id}:`, e.message);
      }
    }
  }
  return { restored };
}

// Sync a single record to Supabase. Fire-and-forget — never blocks UI.
export function syncRecord(table, record) {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    supabase.from(table).upsert({ ...record, user_id: user.id }, { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn(`[sync] ${table}:`, error.message);
    });
  });
}

export function syncDelete(table, id) {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    supabase.from(table).delete().eq('id', id).eq('user_id', user.id).then(({ error }) => {
      if (error) console.warn(`[sync] delete ${table}:`, error.message);
    });
  });
}
