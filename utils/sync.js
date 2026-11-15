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
