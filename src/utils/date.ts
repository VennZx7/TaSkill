const WIB_OFFSET_MINUTES = 7 * 60;
const WIB_OFFSET_MS = WIB_OFFSET_MINUTES * 60 * 1000;
const WIB_OFFSET_LABEL = '+07:00';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const CRITICAL_THRESHOLD_MS = 24 * HOUR_MS;
export const APPROACHING_THRESHOLD_MS = 72 * HOUR_MS;
/** The dashboard's urgent window: overdue, or due within the next two days. */
export const URGENT_WINDOW_MS = 48 * HOUR_MS;

export const INVALID_DATE_LABEL = 'Tanggal tidak valid';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Parses a stored deadline into an absolute instant.
 * Returns null for empty or unparseable values so callers must handle it.
 */
export function parseDeadline(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Formats an instant as `YYYY-MM-DD HH:mm` in WIB.
 * Uses UTC getters against a shifted date instead of toLocaleString so the
 * output never depends on the host locale or time zone.
 */
export function formatToWIB(value: string): string {
  const ms = parseDeadline(value);
  if (ms === null) return INVALID_DATE_LABEL;
  const shifted = new Date(ms + WIB_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    ` ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

/** `YYYY-MM-DDTHH:mm` in WIB, the shape a datetime-local input expects. */
export function formatToInputValue(value: string): string {
  const ms = parseDeadline(value);
  if (ms === null) return '';
  const shifted = new Date(ms + WIB_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

function parseInputParts(value: string): { y: number; mo: number; d: number; h: number; mi: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  return {
    y: Number(y),
    mo: Number(mo) - 1,
    d: Number(d),
    h: Number(h),
    mi: Number(mi),
  };
}

/** The instant a `datetime-local` wall-clock value represents, read as WIB. */
export function inputValueToInstant(value: string): number | null {
  const parts = parseInputParts(value);
  if (!parts) return null;
  const { y, mo, d, h, mi } = parts;
  if (mo < 0 || mo > 11 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const asUtc = Date.UTC(y, mo, d, h, mi);
  const probe = new Date(asUtc);
  // Rejects values like 2026-02-31 that Date.UTC would silently roll over.
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo || probe.getUTCDate() !== d) {
    return null;
  }
  return asUtc - WIB_OFFSET_MS;
}

/**
 * Converts a `datetime-local` value into the stored ISO-8601 form with an
 * explicit +07:00 offset. Never stores a bare date-only string.
 */
export function inputValueToStorageISO(value: string): string | null {
  const ms = inputValueToInstant(value);
  if (ms === null) return null;
  const shifted = new Date(ms + WIB_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:00${WIB_OFFSET_LABEL}`
  );
}

export type Urgency = 'invalid' | 'overdue' | 'critical' | 'approaching' | 'safe';

/**
 * Start of the current WIB calendar day as an absolute instant.
 * Never `setHours(0,0,0,0)` on a Date — that uses the machine's zone and shifts
 * the boundary by up to 7 hours. WIB has no daylight saving, so a day is
 * always exactly 24 hours wide.
 */
export function startOfWIBDay(now: number = Date.now()): number {
  const shifted = new Date(now + WIB_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - WIB_OFFSET_MS;
}

/** True when an instant falls inside today's WIB day. */
export function isWithinWIBDay(value: string, now: number = Date.now()): boolean {
  const ms = parseDeadline(value);
  if (ms === null) return false;
  const start = startOfWIBDay(now);
  return ms >= start && ms < start + DAY_MS;
}
export function getUrgency(deadline: string, now: number = Date.now()): Urgency {
  const ms = parseDeadline(deadline);
  if (ms === null) return 'invalid';
  if (ms < now) return 'overdue';
  if (ms - now < CRITICAL_THRESHOLD_MS) return 'critical';
  if (ms - now < APPROACHING_THRESHOLD_MS) return 'approaching';
  return 'safe';
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}`;
}

export function formatRemaining(deadline: string, now: number = Date.now()): string {
  const ms = parseDeadline(deadline);
  if (ms === null) return INVALID_DATE_LABEL;
  const diff = ms - now;
  const abs = Math.abs(diff);

  if (abs < HOUR_MS) {
    const minutes = Math.max(1, Math.round(abs / (60 * 1000)));
    return diff < 0 ? `Terlambat ${plural(minutes, 'menit')}` : `Sisa ${plural(minutes, 'menit')}`;
  }
  if (abs < DAY_MS) {
    const hours = Math.round(abs / HOUR_MS);
    return diff < 0 ? `Terlambat ${plural(hours, 'jam')}` : `Sisa ${plural(hours, 'jam')}`;
  }
  const days = Math.round(abs / DAY_MS);
  return diff < 0 ? `Terlambat ${plural(days, 'hari')}` : `Sisa ${plural(days, 'hari')}`;
}

/**
 * The single deadline comparator. Compares absolute instants, never strings.
 * Unparseable deadlines sort last; ties break on createdAt so the order is stable.
 */
export function compareByDeadline(
  a: { deadline: string; createdAt: string },
  b: { deadline: string; createdAt: string },
): number {
  const left = parseDeadline(a.deadline);
  const right = parseDeadline(b.deadline);

  if (left === null && right === null) return tieBreak(a, b);
  if (left === null) return 1;
  if (right === null) return -1;
  if (left !== right) return left - right;
  return tieBreak(a, b);
}

function tieBreak(
  a: { createdAt: string },
  b: { createdAt: string },
): number {
  const left = parseDeadline(a.createdAt);
  const right = parseDeadline(b.createdAt);
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

export function sortByDeadline<T extends { deadline: string; createdAt: string }>(tasks: T[]): T[] {
  return [...tasks].sort(compareByDeadline);
}
