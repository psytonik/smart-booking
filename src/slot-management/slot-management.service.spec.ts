import { BadRequestException, ConflictException } from '@nestjs/common';
import { format } from 'date-fns';
import { SlotManagementService } from './slot-management.service';
import { SlotStatus } from './enums/slotStatus.enum';
import { Role } from '../users/enums/role.enum';

describe('SlotManagementService', () => {
  const owner = { id: 1, role: Role.Business };
  const business = { id: 'biz-1', owner };
  const caller = { sub: 1, email: 'o@test.io', role: Role.Business } as any;

  let slotRepository: {
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let service: SlotManagementService;

  beforeEach(() => {
    slotRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (slots) => slots),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    service = new SlotManagementService(
      slotRepository as any,
      { findActiveUser: jest.fn().mockResolvedValue(owner) } as any,
      { findByOwnerId: jest.fn().mockResolvedValue(business) } as any,
    );
  });

  const daily = (overrides = {}) =>
    ({
      openingHours: '09:00',
      closingHours: '17:00',
      lunchDuration: '30 min',
      timePerClient: '30 min',
      startDate: new Date(2030, 0, 7),
      ...overrides,
    }) as any;

  const weekly = (overrides = {}) =>
    ({
      setWorkDays: ['Monday', 'Wednesday'],
      weeksAhead: 3,
      openingHours: '09:00',
      closingHours: '11:00',
      lunchDuration: '0 min',
      timePerClient: '60 min',
      startDate: new Date(2030, 0, 7), // a Monday
      ...overrides,
    }) as any;

  const days = (slots: any[]) => [
    ...new Set(slots.map((s) => format(s.start_time, 'yyyy-MM-dd'))),
  ];

  describe('setWeeklySlots', () => {
    it('generates each requested week instead of repeating the first one', async () => {
      const slots = await service.setWeeklySlots(weekly(), caller);

      expect(days(slots)).toEqual([
        '2030-01-07',
        '2030-01-09',
        '2030-01-14',
        '2030-01-16',
        '2030-01-21',
        '2030-01-23',
      ]);
      expect(slots).toHaveLength(12);
    });

    it('skips holidays', async () => {
      const slots = await service.setWeeklySlots(
        weekly({ setHolidays: ['2030-01-09'] }),
        caller,
      );
      expect(days(slots)).not.toContain('2030-01-09');
    });

    it('refuses days that already have slots', async () => {
      slotRepository.find.mockResolvedValue([
        { id: 1, start_time: new Date(2030, 0, 14, 9) },
      ]);
      await expect(service.setWeeklySlots(weekly(), caller)).rejects.toThrow(
        ConflictException,
      );
      expect(slotRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('schedule validation', () => {
    it.each([
      [
        '0 min per client (infinite loop before the fix)',
        { timePerClient: '0 min' },
      ],
      [
        'closing before opening',
        { openingHours: '17:00', closingHours: '09:00' },
      ],
      ['lunch longer than the day', { lunchDuration: '600 min' }],
      [
        'slot longer than the day',
        { closingHours: '09:30', timePerClient: '60 min' },
      ],
    ])('rejects %s', async (_, overrides) => {
      await expect(
        service.setDailySlots(daily(overrides), caller),
      ).rejects.toThrow(BadRequestException);
    });

    it('honours half-hour opening times and never runs past closing', async () => {
      const slots = await service.setDailySlots(
        daily({ openingHours: '09:30', timePerClient: '45 min' }),
        caller,
      );
      const first = slots[0];
      const last = slots[slots.length - 1];

      expect(format(first.start_time, 'HH:mm')).toBe('09:30');
      expect(format(last.end_time, 'HH:mm') <= '17:00').toBe(true);
      expect(slots).toHaveLength(10);
      expect(slots.some((s) => s.status === SlotStatus.UNAVAILABLE)).toBe(true);
    });
  });

  describe('closeOpenedSlotsByDate', () => {
    it("deletes only the caller's available slots, and awaits it", async () => {
      await service.closeOpenedSlotsByDate('2030-01-07', caller);

      expect(slotRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          business: { id: 'biz-1' },
          status: SlotStatus.AVAILABLE,
        }),
      );
    });

    it('rejects an invalid date', async () => {
      await expect(
        service.closeOpenedSlotsByDate('not-a-date', caller),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
