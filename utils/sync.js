import { supabase } from './supabase';
import {
  getDb, getSetting, setSetting, seedExercises, clearLocalUserData, addTombstone, removeTombstone, getTombstones,
} from './database';
import { BUILTIN_EXERCISES } from '../constants/exercises';

// All cloud writes go through one queue so they reach the server in the order they were made
// (a routine must exist in the cloud before its exercises, a set after its workout, a delete after its last edit).
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch(err => { console.warn('[sync]', err && err.message ? err.message : err); markDirty(); });
  return queue;
}

// Reads the saved session from device storage; unlike getUser() this needs no network round trip.
async function currentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session && session.user ? session.user.id : null;
}

// "Dirty" = some change did not reach the cloud (usually because the phone was offline). It is retried on the
// next app start / return to the app, see syncIfDirty().
let dirty = null; // null = not read from storage yet
function markDirty() {
  dirty = true;
  setSetting('sync_dirty', '1').catch(() => {});
}

// Sync a single record to Supabase. Fire-and-forget: never blocks the UI, silently skipped when signed out.
export function syncRecord(table, record) {
  enqueue(async () => {
    const uid = await currentUserId();
    if (!uid) return;
    const { error } = await supabase.from(table).upsert({ ...record, user_id: uid }, { onConflict: 'id' });
    if (error) { console.warn(`[sync] ${table}:`, error.message); markDirty(); }
  });
}

export function syncDelete(table, id) {
  enqueue(async () => {
    const uid = await currentUserId();
    if (!uid) return;
    await addTombstone(table, id); // remembered until the cloud confirms, so it cannot come back on a restore
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', uid);
    if (error) { console.warn(`[sync] delete ${table}:`, error.message); markDirty(); return; }
    await removeTombstone(table, id);
  });
}

async function flushDeletes() {
  const uid = await currentUserId();
  if (!uid) return;
  for (const t of await getTombstones()) {
    const { error } = await supabase.from(t.tbl).delete().eq('id', t.id).eq('user_id', uid);
    if (error) throw new Error(`delete ${t.tbl}: ${error.message}`);
    await removeTombstone(t.tbl, t.id);
  }
}

// Called when the app opens or comes back to the foreground: pushes missed changes, does nothing if all is synced.
export async function syncIfDirty() {
  const uid = await currentUserId();
  if (!uid) return;
  if (dirty === null) dirty = (await getSetting('sync_dirty', '0')) === '1';
  if (!dirty) return;
  try {
    await uploadLocalData();
    dirty = false;
    await setSetting('sync_dirty', '0');
  } catch (e) {
    console.warn('[sync] retry failed:', e && e.message);
  }
}

async function upsertChunked(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// Push everything stored on this device to the signed-in account. Throws if any part fails.
export async function uploadLocalData() {
  const uid = await currentUserId();
  if (!uid) return;
  await queue; // let pending single-record writes land first
  await flushDeletes();

  const db = await getDb();
  const mine = rows => rows.map(r => ({ ...r, user_id: uid }));

  await upsertChunked('exercises', mine(await db.getAllAsync('SELECT * FROM exercises WHERE is_custom = 1')));
  await upsertChunked('workout_templates', mine(await db.getAllAsync('SELECT * FROM workout_templates')));
  await upsertChunked('template_exercises', mine(await db.getAllAsync('SELECT * FROM template_exercises')));
  await upsertChunked('workout_sessions', mine(await db.getAllAsync('SELECT * FROM workout_sessions WHERE finished_at IS NOT NULL')));
  // Only sets of uploaded (finished) workouts: a set whose workout is missing in the cloud would fail the whole batch.
  await upsertChunked('logged_sets', mine(await db.getAllAsync(
    'SELECT ls.* FROM logged_sets ls JOIN workout_sessions ws ON ws.id = ls.session_id WHERE ws.finished_at IS NOT NULL'
  )));
  await upsertChunked('scheduled_workouts', mine(await db.getAllAsync('SELECT * FROM scheduled_workouts')));
}

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Copy the signed-in account's cloud data onto this device. Rows are merged by id (updated in place, never
// delete-and-reinsert, so nothing that is stored locally gets removed along the way).
export async function downloadCloudData() {
  const uid = await currentUserId();
  if (!uid) return { restored: 0 };

  await seedExercises(BUILTIN_EXERCISES); // routines point at built-in exercises, which must exist first
  const db = await getDb();
  const plan = [
    ['exercises', ['id', 'name', 'muscle', 'category', 'equipment', 'is_custom', 'notes', 'is_unilateral', 'created_at'], r => r.is_custom === 1],
    ['workout_templates', ['id', 'name', 'description', 'color', 'created_at']],
    ['template_exercises', ['id', 'template_id', 'exercise_id', 'default_sets', 'default_reps', 'sort_order']],
    ['workout_sessions', ['id', 'template_id', 'name', 'started_at', 'finished_at', 'notes']],
    ['logged_sets', ['id', 'session_id', 'exercise_id', 'exercise_name', 'set_number', 'weight', 'reps', 'completed', 'rir', 'side', 'created_at']],
    ['scheduled_workouts', ['id', 'template_id', 'date', 'completed', 'session_id', 'notes']],
  ];

  const dead = new Set((await getTombstones()).map(t => t.tbl + ':' + t.id)); // deleted here, not yet deleted in the cloud
  const fetched = [];
  for (const [table, cols, keep] of plan) {
    fetched.push([table, cols, (await fetchAll(table)).filter(r => (keep ? keep(r) : true) && !dead.has(table + ':' + r.id)
      && !(table === 'logged_sets' && dead.has('workout_sessions:' + r.session_id))
      && !(table === 'template_exercises' && dead.has('workout_templates:' + r.template_id)))]);
  }

  let restored = 0;
  await db.withTransactionAsync(async () => {
    for (const [table, cols, rows] of fetched) {
      const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
      for (const r of rows) {
        try {
          await db.runAsync(sql, cols.map(c => (r[c] === undefined ? null : r[c])));
          restored++;
        } catch (e) {
          console.warn(`[sync] restore ${table} ${r.id}:`, e.message);
        }
      }
    }
  });
  return { restored };
}

// Run after every login / sign-up / "Sync now".
//  - Data left by a DIFFERENT account on this device is cleared first, so it can never leak into this account.
//  - Local data is pushed before the cloud copy is pulled, so unsynced local changes are never overwritten.
export async function syncAfterLogin() {
  const uid = await currentUserId();
  if (!uid) return;
  const owner = await getSetting('data_owner', null);
  if (owner && owner !== uid) await clearLocalUserData();
  await uploadLocalData();
  await downloadCloudData();
  await setSetting('data_owner', uid);
  dirty = false;
  await setSetting('sync_dirty', '0');
}
