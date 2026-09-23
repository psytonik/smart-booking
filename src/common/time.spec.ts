import {
  addCalendarDays,
  calendarDayOf,
  dayRange,
  formatClock,
  isCalendarDay,
  parseClock,
  parseDateTimeIn,
  todayIn,
  wallClockToInstant,
  weekdayOf,
} from './time';

describe('time helpers', () => {
  it('converts local wall-clock time to UTC, DST included', () => {
    // Europe/Berlin switches from UTC+1 to UTC+2 on 2030-03-31.
    expect(
      wallClockToInstant('2030-03-30', 9 * 60, 'Europe/Berlin').toISOString(),
    ).toBe('2030-03-30T08:00:00.000Z');
    expect(
      wallClockToInstant('2030-03-31', 9 * 60, 'Europe/Berlin').toISOString(),
    ).toBe('2030-03-31T07:00:00.000Z');
  });

  it('spans 23 hours on a spring-forward day', () => {
    const { start, end } = dayRange('2030-03-31', 'Europe/Berlin');
    expect(start.toISOString()).toBe('2030-03-30T23:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it('resolves "today" in the business timezone', () => {
    const now = new Date('2030-01-07T23:30:00Z');
    expect(todayIn('UTC', now)).toBe('2030-01-07');
    expect(todayIn('Asia/Tokyo', now)).toBe('2030-01-08');
    expect(calendarDayOf(now, 'America/Los_Angeles')).toBe('2030-01-07');
  });

  it('does calendar arithmetic independent of the server timezone', () => {
    expect(addCalendarDays('2030-12-31', 1)).toBe('2031-01-01');
    expect(weekdayOf('2030-01-07')).toBe(1); // Monday
    expect(isCalendarDay('2030-02-28')).toBe(true);
    expect(isCalendarDay('2030-02-30')).toBe(false);
    expect(isCalendarDay('30-02-2030')).toBe(false);
  });

  it('parses and formats clock times', () => {
    expect(parseClock('09:30')).toBe(570);
    expect(formatClock(570)).toBe('09:30');
  });

  describe('parseDateTimeIn', () => {
    it('treats a time without offset as local to the business', () => {
      expect(
        parseDateTimeIn('2030-01-07T09:00', 'Asia/Jerusalem')?.toISOString(),
      ).toBe('2030-01-07T07:00:00.000Z');
    });

    it('honours an explicit offset', () => {
      expect(
        parseDateTimeIn('2030-01-07T09:00+01:00', 'UTC')?.toISOString(),
      ).toBe('2030-01-07T08:00:00.000Z');
    });

    it('returns null for garbage', () => {
      expect(parseDateTimeIn('not-a-date', 'UTC')).toBeNull();
    });
  });
});
