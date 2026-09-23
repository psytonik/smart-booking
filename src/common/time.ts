import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/**
 * Time-zone helpers. Calendar days are plain `yyyy-MM-dd` strings; clock
 * times are minutes since local midnight in a business's IANA timezone;
 * everything returned is an absolute instant (a UTC `Date`).
 */

/** 24h clock time, e.g. `09:00` or `17:30`. */
export const CLOCK_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const CLOCK_TIME_MESSAGE = '$property must be HH:mm, e.g. 09:00';

/** A calendar day, `yyyy-mm-dd`. */
export const CALENDAR_DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const CALENDAR_DAY_MESSAGE = '$property must be yyyy-mm-dd';

export const WEEK_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function parseClock(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The instant of `minutesOfDay` (may exceed 24h) on `day` in `timeZone`. */
export function wallClockToInstant(
  day: string,
  minutesOfDay: number,
  timeZone: string,
): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, minutesOfDay, timeZone).getTime());
}

/** `[start, end)` of a calendar day in `timeZone`, as absolute instants. */
export function dayRange(
  day: string,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: wallClockToInstant(day, 0, timeZone),
    end: wallClockToInstant(addCalendarDays(day, 1), 0, timeZone),
  };
}

/** Today's calendar date in `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return calendarDayOf(now, timeZone);
}

/** The calendar date an instant falls on in `timeZone`. */
export function calendarDayOf(instant: Date, timeZone: string): string {
  return format(new TZDate(instant.getTime(), timeZone), 'yyyy-MM-dd');
}

/**
 * Parses an ISO-8601 date-time. With an explicit offset (`Z`, `+02:00`) it is
 * an absolute instant; without one it is wall-clock time in `timeZone`.
 */
export function parseDateTimeIn(value: string, timeZone: string): Date | null {
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
    const instant = new Date(value);
    return isNaN(instant.getTime()) ? null : instant;
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(
      value,
    );
  if (!match) {
    return null;
  }
  const [, y, mo, d, h, mi] = match.map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, timeZone).getTime());
}

export function isCalendarDay(value: string): boolean {
  return CALENDAR_DAY_REGEX.test(value) && addCalendarDays(value, 0) === value;
}

export function formatInTimeZone(instant: Date, timeZone: string): string {
  return format(
    new TZDate(instant.getTime(), timeZone),
    "yyyy-MM-dd HH:mm '('xxx')'",
  );
}

// Calendar arithmetic in UTC so it's unaffected by the server's timezone
// and DST.
export function addCalendarDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addMinutesTo(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}
