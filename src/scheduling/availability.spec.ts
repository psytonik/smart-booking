import {
  availableStarts,
  InvalidIntervalsError,
  normalizeIntervals,
  workingIntervalsFor,
} from './availability';

const at = (iso: string) => new Date(iso);
const hhmm = (dates: Date[]) => dates.map((d) => d.toISOString().slice(11, 16));

describe('availableStarts', () => {
  const base = {
    day: '2030-01-07',
    timeZone: 'UTC',
    working: [{ startMinute: 9 * 60, endMinute: 11 * 60 }],
    busy: [],
    durationMinutes: 30,
    bufferMinutes: 0,
  };

  it('offers every 15 minutes while the service fits', () => {
    expect(hhmm(availableStarts(base))).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
    ]);
  });

  it('aligns to the grid when hours start off it', () => {
    const starts = availableStarts({
      ...base,
      working: [{ startMinute: 9 * 60 + 10, endMinute: 10 * 60 }],
    });
    expect(hhmm(starts)).toEqual(['09:15', '09:30']);
  });

  it('keeps the buffer clear of the next appointment', () => {
    const starts = availableStarts({
      ...base,
      bufferMinutes: 15,
      busy: [{ start: at('2030-01-07T10:00Z'), end: at('2030-01-07T10:45Z') }],
    });
    // 09:30 would end 10:00 but its buffer runs to 10:15, into the booking.
    expect(hhmm(starts)).toEqual(['09:00', '09:15']);
  });

  it('lets the buffer run past closing time', () => {
    const starts = availableStarts({ ...base, bufferMinutes: 30 });
    expect(hhmm(starts)).toContain('10:30');
  });

  it('skips blocked time and supports split shifts', () => {
    const starts = availableStarts({
      ...base,
      durationMinutes: 60,
      working: [
        { startMinute: 9 * 60, endMinute: 11 * 60 },
        { startMinute: 14 * 60, endMinute: 15 * 60 },
      ],
      busy: [{ start: at('2030-01-07T09:30Z'), end: at('2030-01-07T10:00Z') }],
    });
    expect(hhmm(starts)).toEqual(['10:00', '14:00']);
  });

  it('drops starts in the past', () => {
    const starts = availableStarts({
      ...base,
      notBefore: at('2030-01-07T10:05Z'),
    });
    expect(hhmm(starts)).toEqual(['10:15', '10:30']);
  });

  it('works in local time across a DST change', () => {
    const starts = availableStarts({
      ...base,
      day: '2030-03-31',
      timeZone: 'Europe/Berlin',
      durationMinutes: 60,
      working: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
    });
    // 09:00 Berlin summer time = 07:00 UTC.
    expect(starts.map((d) => d.toISOString())).toEqual([
      '2030-03-31T07:00:00.000Z',
    ]);
  });

  it('returns nothing on a day off', () => {
    expect(availableStarts({ ...base, working: [] })).toEqual([]);
  });
});

describe('workingIntervalsFor', () => {
  const weekly = [{ startMinute: 540, endMinute: 1020 }];

  it('uses the weekly template without an override', () => {
    expect(workingIntervalsFor(weekly, undefined)).toBe(weekly);
  });

  it('uses the override when there is one, including a day off', () => {
    const custom = [{ startMinute: 600, endMinute: 660 }];
    expect(workingIntervalsFor(weekly, custom)).toBe(custom);
    expect(workingIntervalsFor(weekly, [])).toEqual([]);
  });
});

describe('normalizeIntervals', () => {
  it('sorts valid intervals', () => {
    expect(
      normalizeIntervals([
        { startMinute: 840, endMinute: 900 },
        { startMinute: 540, endMinute: 600 },
      ]),
    ).toEqual([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 840, endMinute: 900 },
    ]);
  });

  it('rejects overlapping and inverted intervals', () => {
    expect(() =>
      normalizeIntervals([
        { startMinute: 540, endMinute: 700 },
        { startMinute: 600, endMinute: 800 },
      ]),
    ).toThrow(InvalidIntervalsError);
    expect(() =>
      normalizeIntervals([{ startMinute: 600, endMinute: 540 }]),
    ).toThrow(InvalidIntervalsError);
  });
});
