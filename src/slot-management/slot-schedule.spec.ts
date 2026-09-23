import {
  buildSchedule,
  calendarDayOf,
  dayRange,
  generateDaySlots,
  InvalidScheduleError,
  isCalendarDay,
  parseDateTimeIn,
  todayIn,
  weeklyDays,
} from './slot-schedule';

const hours = (overrides = {}) => ({
  openingHours: '09:00',
  closingHours: '17:00',
  lunchDuration: '0 min',
  timePerClient: '60 min',
  ...overrides,
});

describe('slot-schedule', () => {
  describe('buildSchedule', () => {
    it.each([
      ['0 min per client', { timePerClient: '0 min' }],
      ['more than 480 min per client', { timePerClient: '481 min' }],
      [
        'closing before opening',
        { openingHours: '17:00', closingHours: '09:00' },
      ],
      ['equal opening and closing', { closingHours: '09:00' }],
      ['lunch as long as the day', { lunchDuration: '480 min' }],
      ['a slot longer than the day', { closingHours: '09:30' }],
    ])('rejects %s', (_, overrides) => {
      expect(() => buildSchedule(hours(overrides))).toThrow(
        InvalidScheduleError,
      );
    });

    it('floors durations that do not divide the day', () => {
      // 7.5h / 45 min = 10 slots, not 10.67
      const schedule = buildSchedule(
        hours({ openingHours: '09:30', timePerClient: '45 min' }),
      );
      expect(schedule.totalSlots).toBe(10);
    });

    it('places the lunch break in the middle', () => {
      const schedule = buildSchedule(
        hours({ timePerClient: '30 min', lunchDuration: '45 min' }),
      );
      expect(schedule).toMatchObject({
        totalSlots: 16,
        lunchStartSlot: 8,
        lunchEndSlot: 10,
      });
    });
  });

  describe('generateDaySlots', () => {
    const iso = (d: Date) => d.toISOString();

    it('converts wall-clock times in the business timezone to UTC', () => {
      const slots = generateDaySlots(
        '2030-01-07',
        buildSchedule(hours({ closingHours: '11:00' })),
        'America/New_York',
      );
      expect(slots.map((s) => iso(s.start))).toEqual([
        '2030-01-07T14:00:00.000Z',
        '2030-01-07T15:00:00.000Z',
      ]);
    });

    it('keeps local opening hours on the spring-forward day', () => {
      // Europe/Berlin switches from UTC+1 to UTC+2 on 2030-03-31.
      const before = generateDaySlots(
        '2030-03-30',
        buildSchedule(hours()),
        'Europe/Berlin',
      );
      const on = generateDaySlots(
        '2030-03-31',
        buildSchedule(hours()),
        'Europe/Berlin',
      );
      expect(iso(before[0].start)).toBe('2030-03-30T08:00:00.000Z');
      expect(iso(on[0].start)).toBe('2030-03-31T07:00:00.000Z');
      expect(iso(on[on.length - 1].end)).toBe('2030-03-31T15:00:00.000Z');
    });

    it('marks lunch slots as breaks and never runs past closing', () => {
      const slots = generateDaySlots(
        '2030-01-07',
        buildSchedule(
          hours({
            openingHours: '09:30',
            timePerClient: '45 min',
            lunchDuration: '45 min',
          }),
        ),
        'UTC',
      );
      expect(slots.filter((s) => s.isBreak)).toHaveLength(1);
      expect(iso(slots[slots.length - 1].end)).toBe('2030-01-07T17:00:00.000Z');
    });
  });

  describe('weeklyDays', () => {
    it('covers every requested week and skips holidays', () => {
      expect(
        weeklyDays('2030-01-07', 3, ['Monday', 'Wednesday'], ['2030-01-09']),
      ).toEqual([
        '2030-01-07',
        '2030-01-14',
        '2030-01-16',
        '2030-01-21',
        '2030-01-23',
      ]);
    });

    it('starts mid-week from the given day', () => {
      expect(weeklyDays('2030-01-09', 1, ['Monday', 'Friday'])).toEqual([
        '2030-01-11',
        '2030-01-14',
      ]);
    });
  });

  describe('dayRange / calendar helpers', () => {
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

    it('validates calendar days', () => {
      expect(isCalendarDay('2030-02-28')).toBe(true);
      expect(isCalendarDay('2030-02-30')).toBe(false);
      expect(isCalendarDay('30-02-2030')).toBe(false);
    });
  });

  describe('parseDateTimeIn', () => {
    it('treats a time without offset as local to the business', () => {
      expect(
        parseDateTimeIn('2030-01-07T09:00', 'Asia/Jerusalem')?.toISOString(),
      ).toBe('2030-01-07T07:00:00.000Z');
    });

    it('honours an explicit offset', () => {
      expect(
        parseDateTimeIn('2030-01-07T09:00Z', 'Asia/Jerusalem')?.toISOString(),
      ).toBe('2030-01-07T09:00:00.000Z');
      expect(
        parseDateTimeIn('2030-01-07T09:00+01:00', 'UTC')?.toISOString(),
      ).toBe('2030-01-07T08:00:00.000Z');
    });

    it('returns null for garbage', () => {
      expect(parseDateTimeIn('not-a-date', 'UTC')).toBeNull();
    });
  });
});
