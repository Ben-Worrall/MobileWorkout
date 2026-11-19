// Timer state is stored as timestamps (never as a ticking counter), so it stays correct when the app is
// backgrounded, the screen is off, or JS is suspended. Display values are derived from Date.now().

export function remainingSecs(endAt, now = Date.now()) {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

// Rest timer: { endAt, total, pausedRemaining }
//   running: endAt is a timestamp, pausedRemaining is null
//   paused:  endAt is null, pausedRemaining is whole seconds left
export function startRest(totalSecs, now = Date.now()) {
  return { endAt: now + totalSecs * 1000, total: totalSecs, pausedRemaining: null };
}

export function restRemaining(rest, now = Date.now()) {
  if (!rest) return 0;
  if (rest.pausedRemaining != null) return rest.pausedRemaining;
  return remainingSecs(rest.endAt, now);
}

export function restIsRunning(rest) {
  return !!rest && rest.pausedRemaining == null;
}

export function pauseRest(rest, now = Date.now()) {
  if (!rest || rest.pausedRemaining != null) return rest;
  return { ...rest, endAt: null, pausedRemaining: remainingSecs(rest.endAt, now) };
}

export function resumeRest(rest, now = Date.now()) {
  if (!rest || rest.pausedRemaining == null) return rest;
  return { ...rest, endAt: now + rest.pausedRemaining * 1000, pausedRemaining: null };
}

export function adjustRest(rest, deltaSecs, now = Date.now()) {
  if (!rest) return rest;
  let next;
  if (rest.pausedRemaining != null) {
    next = { ...rest, pausedRemaining: Math.max(0, rest.pausedRemaining + deltaSecs) };
  } else {
    next = { ...rest, endAt: rest.endAt + deltaSecs * 1000 };
  }
  return { ...next, total: Math.max(next.total, restRemaining(next, now)) };
}

// Workout timer: { running, startedAt, accum }  (accum = ms accumulated before the current running segment)
export const newWorkoutTimer = () => ({ running: false, startedAt: 0, accum: 0 });

export function workoutElapsed(timer, now = Date.now()) {
  if (!timer) return 0;
  return timer.accum + (timer.running ? Math.max(0, now - timer.startedAt) : 0);
}

export function startWorkoutTimer(timer, now = Date.now()) {
  if (timer.running) return timer;
  return { ...timer, running: true, startedAt: now };
}

export function pauseWorkoutTimer(timer, now = Date.now()) {
  if (!timer.running) return timer;
  return { running: false, startedAt: 0, accum: workoutElapsed(timer, now) };
}

export function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatSecs(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
