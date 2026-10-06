import { readJson, writeJson } from './localStorage';

const STORAGE_KEY = 'student-tasks:user';

/** XP that fills one level. */
export const XP_PER_LEVEL = 100;
/** Rewards, kept next to the profile so callers cannot drift apart. */
export const TASK_XP = 20;
export const POMODORO_XP = 10;

/** RPG titles, one per level; the last title is kept for every level beyond. */
export const LEVEL_TITLES = [
  'Pemula',
  'Murid Tekun',
  'Penuntut Ilmu',
  'Sarjana Muda',
  'Ahli Muda',
  'Pakar Handal',
  'Master Akademik',
  'Legenda Kampus',
] as const;

export type LevelTitle = (typeof LEVEL_TITLES)[number];

export interface UserProfile {
  xp: number;
}

export interface AwardResult {
  xp: number;
  level: number;
  title: LevelTitle;
  /** XP into the current level, 0–99. */
  progress: number;
  leveledUp: boolean;
  previousLevel: number;
}

export function levelFor(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export function titleFor(level: number): LevelTitle {
  return LEVEL_TITLES[Math.min(Math.max(1, level) - 1, LEVEL_TITLES.length - 1)];
}

export function progressFor(xp: number): number {
  return Math.max(0, xp) % XP_PER_LEVEL;
}

function resultOf(xp: number, previousLevel: number): AwardResult {
  const level = levelFor(xp);
  return {
    xp,
    level,
    title: titleFor(level),
    progress: progressFor(xp),
    leveledUp: level > previousLevel,
    previousLevel,
  };
}

/**
 * Reads the profile. A missing blob is a first run (zero XP); a corrupt
 * one resets rather than breaking the app — gamification is cosmetic,
 * unlike the task list, which surfaces its own error state.
 */
export function readProfile(): UserProfile {
  try {
    const stored = readJson<UserProfile>(STORAGE_KEY);
    const xp =
      typeof stored?.xp === 'number' && Number.isFinite(stored.xp) && stored.xp >= 0
        ? stored.xp
        : 0;
    return { xp };
  } catch {
    return { xp: 0 };
  }
}

/**
 * Awards XP and persists the new total. Only XP is stored: level and
 * title are derived from it, so there is one source of truth. Writing
 * is best-effort — in private mode the award still counts for the
 * session, it just does not survive a reload.
 */
export function awardXP(rawAmount: number): AwardResult {
  const amount = Number.isFinite(rawAmount)
    ? Math.max(0, Math.floor(rawAmount))
    : 0;

  const current = readProfile();
  const previousLevel = levelFor(current.xp);
  const xp = current.xp + amount;

  try {
    writeJson(STORAGE_KEY, { xp });
  } catch {
    // Best-effort persistence; the award still stands.
  }

  return resultOf(xp, previousLevel);
}
