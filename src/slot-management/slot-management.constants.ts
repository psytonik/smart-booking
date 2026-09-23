export const WEEK_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** 24h clock time, e.g. `09:00` or `17:30`. */
export const CLOCK_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const CLOCK_TIME_MESSAGE = '$property must be HH:mm, e.g. 09:00';

/** Whole minutes, optionally suffixed: `15`, `15min`, `15 min`. */
export const DURATION_REGEX = /^\d{1,4}\s*(min)?$/;
export const DURATION_MESSAGE = '$property must be minutes, e.g. "15 min"';

export const MIN_TIME_PER_CLIENT = 5;
export const MAX_TIME_PER_CLIENT = 480;
export const MAX_WEEKS_AHEAD = 12;
