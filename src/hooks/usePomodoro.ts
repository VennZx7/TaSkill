import { useCallback, useEffect, useRef, useState } from 'react';

export type PomodoroMode = 'work' | 'short' | 'long';

const MINUTES: Record<PomodoroMode, number> = { work: 25, short: 5, long: 15 };
const CYCLES_PER_LONG_BREAK = 4;
const TICK_MS = 1000;
const STORAGE_KEY = 'student-tasks:pomodoro';

interface Session {
  mode: PomodoroMode;
  /** Epoch ms the current run ends. Null while paused. */
  endsAt: number | null;
  /** Seconds left. Authoritative only while paused. */
  remaining: number;
  /** Finished work sessions since the last long break. */
  cycles: number;
  taskId: string | null;
}

function defaultSession(): Session {
  return {
    mode: 'work',
    endsAt: null,
    remaining: MINUTES.work * 60,
    cycles: 0,
    taskId: null,
  };
}

/**
 * The run is stored as an absolute end instant, never as a counter that
 * decrements: a throttled or delayed tick then cannot make the clock drift.
 */
function restore(): Session {
  const fallback = defaultSession();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as Partial<Session>;
    const mode: PomodoroMode =
      stored.mode === 'short' || stored.mode === 'long' || stored.mode === 'work'
        ? stored.mode
        : 'work';
    const full = MINUTES[mode] * 60;
    const cycles = typeof stored.cycles === 'number' && stored.cycles >= 0 ? stored.cycles : 0;

    if (typeof stored.endsAt === 'number') {
      // A run was in flight. Recompute from the stored instant so a reload or a
      // backgrounded tab resumes at the right second instead of a stale one.
      const left = Math.max(0, Math.ceil((stored.endsAt - Date.now()) / 1000));
      if (left > 0) {
        return { mode, endsAt: stored.endsAt, remaining: left, cycles, taskId: stored.taskId ?? null };
      }
      // It finished while we were away; do not silently advance past the toast.
      return { mode, endsAt: null, remaining: full, cycles, taskId: stored.taskId ?? null };
    }

    const remaining =
      typeof stored.remaining === 'number' && stored.remaining >= 0
        ? Math.min(stored.remaining, full)
        : full;
    return { mode, endsAt: null, remaining, cycles, taskId: stored.taskId ?? null };
  } catch {
    return fallback;
  }
}

function persist(session: Session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Best-effort; the timer still runs correctly for this session.
  }
}

export function usePomodoro(onComplete: (finished: PomodoroMode) => void) {
  const [session, setSession] = useState<Session>(restore);

  // Held in a ref so a changing callback never re-subscribes the interval.
  const notify = useRef(onComplete);
  notify.current = onComplete;

  const update = useCallback((change: Partial<Session> | ((prev: Session) => Partial<Session>)) => {
    setSession((prev) => {
      const next = { ...prev, ...(typeof change === 'function' ? change(prev) : change) };
      persist(next);
      return next;
    });
  }, []);

  const finish = useCallback(() => {
    notify.current(session.mode);
    const nextMode: PomodoroMode =
      session.mode === 'work'
        ? (session.cycles + 1) % CYCLES_PER_LONG_BREAK === 0
          ? 'long'
          : 'short'
        : 'work';
    // Land on the next mode full and paused. Auto-starting it would burn a break
    // on whoever walked away from the keyboard at the end of a session.
    update({
      mode: nextMode,
      cycles: session.mode === 'work' ? session.cycles + 1 : session.cycles,
      endsAt: null,
      remaining: MINUTES[nextMode] * 60,
    });
  }, [session.mode, session.cycles, update]);

  const endsAt = session.endsAt;
  useEffect(() => {
    if (endsAt === null) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      if (left === 0) {
        // Stop this run before handing over: a tick queued in the same batch
        // would otherwise tick the *next* session down by a second or two.
        window.clearInterval(id);
        finish();
        return;
      }
      // A pure tick is never persisted: only the actions write storage.
      setSession((prev) => (prev.remaining === left ? prev : { ...prev, remaining: left }));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [endsAt, finish]);

  const start = useCallback(() => {
    update((prev) => ({
      endsAt: Date.now() + prev.remaining * 1000,
    }));
  }, [update]);

  const pause = useCallback(() => {
    update((prev) => ({
      endsAt: null,
      remaining: Math.max(0, Math.ceil(((prev.endsAt ?? Date.now()) - Date.now()) / 1000)),
    }));
  }, [update]);

  const reset = useCallback(() => {
    update({ endsAt: null, remaining: MINUTES[session.mode] * 60 });
  }, [session.mode, update]);

  /** Switching mode discards the current run; there is no cross-mode resume. */
  const setMode = useCallback(
    (mode: PomodoroMode) => {
      if (mode === session.mode) return;
      update({ mode, endsAt: null, remaining: MINUTES[mode] * 60 });
    },
    [session.mode, update],
  );

  const setTaskId = useCallback((taskId: string | null) => update({ taskId }), [update]);

  return {
    mode: session.mode,
    remaining: session.remaining,
    isRunning: session.endsAt !== null,
    taskId: session.taskId,
    start,
    pause,
    reset,
    setMode,
    setTaskId,
  };
}

export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}