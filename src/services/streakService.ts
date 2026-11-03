import { readJson, writeJson } from './localStorage';

const KEY = 'student-tasks:streak';

interface StreakState {
  lastDay: string; // YYYY-MM-DD in WIB
  count: number;
}

function wibDayKey(date: Date = new Date()): string {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

export function getStreakCount(): number {
  try {
    const stored = readJson<StreakState>(KEY);
    if (stored && typeof stored.count === 'number') return stored.count;
  } catch {
    // ignore
  }
  return 0;
}
export function recordStreakActivity(): { count: number; isNewDay: boolean } {
  let state: StreakState = { lastDay: '', count: 0 };
  try {
    const stored = readJson<StreakState>(KEY);
    if (stored && typeof stored.lastDay === 'string' && typeof stored.count === 'number') {
      state = stored;
    }
  } catch {
    // first run
  }

  const today = wibDayKey();
  if (state.lastDay === today) {
    return { count: state.count, isNewDay: false };
  }

  // consecutive day?
  const yesterday = wibDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const count = state.lastDay === yesterday ? state.count + 1 : 1;
  const next: StreakState = { lastDay: today, count };
  try {
    writeJson(KEY, next);
  } catch {
    // best-effort
  }
  return { count, isNewDay: true };
}