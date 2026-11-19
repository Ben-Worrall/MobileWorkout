import { Alert } from 'react-native';
import { getSetting, setSetting, getDb, deleteSession } from './database';
import { cancelRestNotification } from './notifications';

// The in-progress workout is mirrored into user_settings so that closing or killing the app never loses it.
// Logged sets themselves live in SQLite (logged_sets); this blob only holds what is not in the database yet.
const KEY = 'active_workout';

export async function saveActiveWorkout(state) {
  await setSetting(KEY, JSON.stringify(state));
}

export async function clearActiveWorkout() {
  const db = await getDb();
  await db.runAsync('DELETE FROM user_settings WHERE key = ?', [KEY]);
}

// Returns the saved workout only if its session still exists and is unfinished.
export async function loadActiveWorkout() {
  const raw = await getSetting(KEY, null);
  if (!raw) return null;
  let state;
  try { state = JSON.parse(raw); } catch { await clearActiveWorkout(); return null; }
  if (!state || !state.sessionId) { await clearActiveWorkout(); return null; }
  const db = await getDb();
  const session = await db.getFirstAsync('SELECT id, finished_at FROM workout_sessions WHERE id = ?', [state.sessionId]);
  if (!session || session.finished_at) { await clearActiveWorkout(); return null; }
  const counts = await db.getFirstAsync('SELECT COUNT(*) AS c FROM logged_sets WHERE session_id = ?', [state.sessionId]);
  return { ...state, loggedCount: counts ? counts.c : 0 };
}

export async function discardActiveWorkout(sessionId) {
  await cancelRestNotification();
  if (sessionId) await deleteSession(sessionId);
  await clearActiveWorkout();
}

// Single entry point for starting a workout from anywhere (Home, routines, calendar).
// If one is already in progress, the user chooses between resuming it and replacing it.
export async function startOrResumeWorkout(router, params = {}) {
  const active = await loadActiveWorkout();
  if (!active) {
    router.push({ pathname: '/active-workout', params });
    return;
  }
  const detail = active.loggedCount > 0
    ? `"${active.name || 'Workout'}" has ${active.loggedCount} logged set${active.loggedCount === 1 ? '' : 's'}.`
    : `"${active.name || 'Workout'}" has no logged sets yet.`;
  Alert.alert('Workout in progress', `${detail} Resume it, or discard it and start a new one?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Resume', onPress: () => router.push({ pathname: '/active-workout', params: { resume: '1' } }) },
    {
      text: 'Discard & start new',
      style: 'destructive',
      onPress: async () => {
        await discardActiveWorkout(active.sessionId);
        router.push({ pathname: '/active-workout', params });
      },
    },
  ]);
}
