import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Current time that refreshes while `active` is true, and immediately when the app returns to the foreground.
// Lets a small component tick on its own instead of re-rendering its whole screen twice a second.
export function useNow(active, intervalMs = 500) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()); });
    return () => { clearInterval(id); sub.remove(); };
  }, [active, intervalMs]);

  return now;
}
