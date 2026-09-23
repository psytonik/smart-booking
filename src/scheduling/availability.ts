import { addMinutesTo, wallClockToInstant } from '../common/time';

/**
 * Pure availability math: which start times can a service be booked at on
 * one day for one staff member. No Nest, no database.
 */

export const START_TIME_STEP_MINUTES = 15;

/** Working time on one day, in minutes since local midnight. */
export interface WorkingInterval {
  startMinute: number;
  endMinute: number;
}

/** Time already taken: an appointment (including its buffer) or a block. */
export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface AvailabilityInput {
  day: string;
  timeZone: string;
  working: WorkingInterval[];
  busy: BusyInterval[];
  durationMinutes: number;
  bufferMinutes: number;
  /** Starts before this instant are excluded (normally "now"). */
  notBefore?: Date;
  stepMinutes?: number;
}

/**
 * Free start times, on a fixed local grid (every 15 minutes by default).
 *
 * A start fits when the service itself ends within a working interval, and
 * the service plus its buffer overlaps nothing busy. The buffer may run past
 * closing time; it only has to stay clear of other appointments and blocks.
 */
export function availableStarts(input: AvailabilityInput): Date[] {
  const step = input.stepMinutes ?? START_TIME_STEP_MINUTES;
  const starts = new Map<number, Date>();

  for (const interval of input.working) {
    const workEnd = wallClockToInstant(
      input.day,
      interval.endMinute,
      input.timeZone,
    );
    const first = Math.ceil(interval.startMinute / step) * step;
    for (let minute = first; minute < interval.endMinute; minute += step) {
      const start = wallClockToInstant(input.day, minute, input.timeZone);
      const serviceEnd = addMinutesTo(start, input.durationMinutes);
      if (serviceEnd > workEnd) {
        break;
      }
      const occupiedEnd = addMinutesTo(serviceEnd, input.bufferMinutes);
      if (input.notBefore && start < input.notBefore) {
        continue;
      }
      if (input.busy.some((b) => start < b.end && b.start < occupiedEnd)) {
        continue;
      }
      // Keyed by instant: on a DST gap two local times can map to one.
      starts.set(start.getTime(), start);
    }
  }
  return [...starts.values()].sort((a, b) => a.getTime() - b.getTime());
}

/**
 * The working intervals that apply on a day: the date's overrides if it has
 * any (an override with no intervals is a day off), otherwise the weekly
 * template for that weekday.
 */
export function workingIntervalsFor(
  weekly: WorkingInterval[],
  overrides: WorkingInterval[] | undefined,
): WorkingInterval[] {
  return overrides ?? weekly;
}

/** Rejects overlapping or inverted intervals; returns them sorted. */
export function normalizeIntervals(
  intervals: WorkingInterval[],
): WorkingInterval[] {
  const sorted = [...intervals].sort((a, b) => a.startMinute - b.startMinute);
  sorted.forEach((interval, i) => {
    if (interval.endMinute <= interval.startMinute) {
      throw new InvalidIntervalsError('Each interval must end after it starts');
    }
    if (i > 0 && interval.startMinute < sorted[i - 1].endMinute) {
      throw new InvalidIntervalsError('Intervals must not overlap');
    }
  });
  return sorted;
}

export class InvalidIntervalsError extends Error {}
