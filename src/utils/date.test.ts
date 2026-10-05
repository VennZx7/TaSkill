import { describe, expect, it } from 'vitest';
import { isWithinWIBDay, startOfWIBDay } from './date';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** An absolute instant expressed as a WIB wall-clock time. */
function wibInstant(year: number, month: number, day: number, hour: number, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) - WIB_OFFSET_MS;
}

describe('startOfWIBDay', () => {
  it('returns midnight WIB, not the machine midnight', () => {
    // 15:30 WIB on 5 Oct is 08:30 UTC — a UTC day start would be 7 hours off.
    const now = wibInstant(2026, 10, 5, 15, 30);
    const start = startOfWIBDay(now);

    expect(start).toBe(wibInstant(2026, 10, 5, 0, 0));
    expect(now - start).toBe(15.5 * HOUR_MS);
  });

  it('rolls back to the previous WIB day for times before 07:00 UTC', () => {
    // 02:00 WIB on 6 Oct is 19:00 UTC on 5 Oct, so the UTC date is already past.
    const now = wibInstant(2026, 10, 6, 2, 0);
    expect(startOfWIBDay(now)).toBe(wibInstant(2026, 10, 6, 0, 0));
  });

  it('spans exactly 24 hours because WIB has no daylight saving', () => {
    const start = startOfWIBDay(wibInstant(2026, 3, 8, 12, 0));
    expect(start + 24 * HOUR_MS).toBe(startOfWIBDay(wibInstant(2026, 3, 9, 12, 0)));
  });
});

describe('isWithinWIBDay', () => {
  const now = wibInstant(2026, 10, 5, 15, 30);

  it('accepts an instant later today', () => {
    expect(isWithinWIBDay('2026-10-05T18:00:00+07:00', now)).toBe(true);
  });

  it('accepts the first minute of today and rejects the last second of yesterday', () => {
    expect(isWithinWIBDay('2026-10-05T00:00:00+07:00', now)).toBe(true);
    expect(isWithinWIBDay('2026-10-04T23:59:59+07:00', now)).toBe(false);
  });

  it('accepts an instant earlier today, since it is still the same WIB day', () => {
    // Whether it is already past is a separate question the dashboard answers
    // by excluding it from Due Today; this helper is purely a day-boundary test.
    expect(isWithinWIBDay('2026-10-05T09:00:00+07:00', now)).toBe(true);
  });

  it('rejects a different day entirely', () => {
    expect(isWithinWIBDay('2026-10-06T10:00:00+07:00', now)).toBe(false);
  });

  it('is independent of how the stored string is written', () => {
    // 2026-10-05T15:00:00+07:00 and 2026-10-05T08:00:00Z are the same moment.
    expect(isWithinWIBDay('2026-10-05T08:00:00Z', now)).toBe(true);
  });

  it('returns false for an unparseable value instead of throwing', () => {
    expect(isWithinWIBDay('bukan tanggal', now)).toBe(false);
    expect(isWithinWIBDay('', now)).toBe(false);
  });
});
