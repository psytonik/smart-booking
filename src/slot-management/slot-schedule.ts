import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import {
  MAX_TIME_PER_CLIENT,
  MIN_TIME_PER_CLIENT,
  WEEK_DAYS,
} from './slot-management.constants';

/**
 * Pure scheduling math: no Nest, no database. Calendar days are plain
 * `yyyy-MM-dd` strings and clock times are wall-clock times in the business's
 * IANA timezone; everything returned is an absolute instant (a UTC `Date`).
 */

export interface ScheduleInput {
  openingHours: string;
  closingHours: string;
  lunchDuration: string;
  timePerClient: string;
}

export interface Schedule {
  openingMinutes: number;
  timePerClient: number;
  totalSlots: number;
  lunchStartSlot: number;
  lunchEndSlot: number;
}

export interface SlotInterval {
  start: Date;
  end: Date;
  isBreak: boolean;
}

export class InvalidScheduleError extends Error {}

/**
 * Validates working hours and turns them into a slot grid. Rejects input
 * that would produce no slots, a slot past closing time, or an unbounded
 * loop (e.g. `timePerClient: "0 min"`).
 */
export function buildSchedule(input: ScheduleInput): Schedule {
  const openingMinutes = parseClock(input.openingHours);
  const closingMinutes = parseClock(input.closingHours);
  const lunchDuration = parseInt(input.lunchDuration, 10);
  const timePerClient = parseInt(input.timePerClient, 10);

  if (
    !(timePerClient >= MIN_TIME_PER_CLIENT) ||
    timePerClient > MAX_TIME_PER_CLIENT
  ) {
    throw new InvalidScheduleError(
      `timePerClient must be between ${MIN_TIME_PER_CLIENT} and ${MAX_TIME_PER_CLIENT} minutes`,
    );
  }
  const workMinutes = closingMinutes - openingMinutes;
  if (!(workMinutes > 0)) {
    throw new InvalidScheduleError('closingHours must be after openingHours');
  }
  if (!(lunchDuration >= 0) || lunchDuration >= workMinutes) {
    throw new InvalidScheduleError(
      'lunchDuration must be shorter than the working day',
    );
  }
  const totalSlots = Math.floor(workMinutes / timePerClient);
  if (totalSlots === 0) {
    throw new InvalidScheduleError(
      'timePerClient is longer than the working day',
    );
  }
  const lunchStartSlot = Math.floor(totalSlots / 2);
  const lunchEndSlot = Math.min(
    totalSlots,
    lunchStartSlot + Math.ceil(lunchDuration / timePerClient),
  );
  return {
    openingMinutes,
    timePerClient,
    totalSlots,
    lunchStartSlot,
    lunchEndSlot,
  };
}

/**
 * Slots for one calendar day. Each slot's start and end are computed as
 * wall-clock times in `timeZone`, so a 09:00 opening stays 09:00 local on
 * daylight-saving transition days.
 */
export function generateDaySlots(
  day: string,
  schedule: Schedule,
  timeZone: string,
): SlotInterval[] {
  const slots: SlotInterval[] = [];
  for (let i = 0; i < schedule.totalSlots; i++) {
    const startMinutes = schedule.openingMinutes + i * schedule.timePerClient;
    slots.push({
      start: wallClockToInstant(day, startMinutes, timeZone),
      end: wallClockToInstant(
        day,
        startMinutes + schedule.timePerClient,
        timeZone,
      ),
      isBreak: i >= schedule.lunchStartSlot && i < schedule.lunchEndSlot,
    });
  }
  return slots;
}

/**
 * Calendar days in `[firstDay, firstDay + weeks * 7)` that fall on one of
 * `workDays` and aren't listed in `holidays`.
 */
export function weeklyDays(
  firstDay: string,
  weeks: number,
  workDays: string[],
  holidays: string[] = [],
): string[] {
  const workDayIndexes = new Set(
    workDays.map((d) => WEEK_DAYS.indexOf(d as (typeof WEEK_DAYS)[number])),
  );
  const skip = new Set(holidays);
  const days: string[] = [];
  for (let offset = 0; offset < weeks * 7; offset++) {
    const day = addCalendarDays(firstDay, offset);
    if (workDayIndexes.has(weekdayOf(day)) && !skip.has(day)) {
      days.push(day);
    }
  }
  return days;
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
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && addCalendarDays(value, 0) === value
  );
}

export function formatInTimeZone(instant: Date, timeZone: string): string {
  return format(
    new TZDate(instant.getTime(), timeZone),
    "yyyy-MM-dd HH:mm '('xxx')'",
  );
}

function parseClock(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function wallClockToInstant(
  day: string,
  minutesOfDay: number,
  timeZone: string,
): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, minutesOfDay, timeZone).getTime());
}

// Calendar arithmetic in UTC so it's unaffected by the server's timezone
// and DST.
function addCalendarDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
