import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, Repository } from 'typeorm';
import { WorkingHours } from './entities/working-hours.entity';
import { ScheduleOverride } from './entities/schedule-override.entity';
import { TimeBlock } from './entities/time-block.entity';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { Users } from '../users/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import {
  BusyInterval,
  InvalidIntervalsError,
  normalizeIntervals,
  WorkingInterval,
  workingIntervalsFor,
} from './availability';
import {
  addCalendarDays,
  formatClock,
  parseClock,
  parseDateTimeIn,
  WEEK_DAYS,
  weekdayOf,
} from '../common/time';
import { IntervalDto, WorkingDayDto } from './dto/schedule.dto';

export const MAX_RANGE_DAYS = 62;
const MAX_BLOCK_DAYS = 31;

export interface WorkingDayView {
  weekday: string;
  intervals: { start: string; end: string }[];
}

/**
 * A staff member's working time: the weekly template, per-date overrides,
 * and blocked time. Times of day are local to the business.
 */
@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(WorkingHours)
    private readonly workingHoursRepository: Repository<WorkingHours>,
    @InjectRepository(ScheduleOverride)
    private readonly overrideRepository: Repository<ScheduleOverride>,
    @InjectRepository(TimeBlock)
    private readonly blockRepository: Repository<TimeBlock>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly dataSource: DataSource,
  ) {}

  async getWorkingHours(staff: Users): Promise<WorkingDayView[]> {
    const rows = await this.workingHoursRepository.find({
      where: { staff: { id: staff.id } },
      order: { weekday: 'ASC', start_minute: 'ASC' },
    });
    return WEEK_DAYS.map((weekday, index) => ({
      weekday,
      intervals: rows
        .filter((r) => r.weekday === index)
        .map((r) => toClockInterval(r.start_minute, r.end_minute)),
    })).filter((day) => day.intervals.length > 0);
  }

  /** Replaces the weekly template. */
  async setWorkingHours(
    staff: Users,
    days: WorkingDayDto[],
  ): Promise<WorkingDayView[]> {
    const rows = days.flatMap((day) =>
      toMinuteIntervals(day.intervals).map((interval) =>
        this.workingHoursRepository.create({
          staff: { id: staff.id } as Users,
          weekday: WEEK_DAYS.indexOf(day.weekday),
          start_minute: interval.startMinute,
          end_minute: interval.endMinute,
        }),
      ),
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(WorkingHours, { staff: { id: staff.id } });
      await manager.save(rows);
    });
    return this.getWorkingHours(staff);
  }

  /** Dates in the range that have overrides, with their intervals. */
  async getOverrides(
    staff: Users,
    from: string,
    to: string,
  ): Promise<Map<string, WorkingInterval[]>> {
    const rows = await this.overrideRepository.find({
      where: { staff: { id: staff.id }, date: Between(from, to) },
      order: { date: 'ASC', start_minute: 'ASC' },
    });
    return groupOverrides(rows);
  }

  /** Sets one date's hours; an empty list makes it a day off. */
  async setOverride(
    staff: Users,
    date: string,
    intervals: IntervalDto[],
  ): Promise<WorkingInterval[]> {
    const normalized = toMinuteIntervals(intervals);
    const rows = (
      normalized.length > 0
        ? normalized
        : [{ startMinute: null, endMinute: null }]
    ).map((interval) =>
      this.overrideRepository.create({
        staff: { id: staff.id } as Users,
        date,
        start_minute: interval.startMinute,
        end_minute: interval.endMinute,
      }),
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ScheduleOverride, {
        staff: { id: staff.id },
        date,
      });
      await manager.save(rows);
    });
    return normalized;
  }

  /** Back to the weekly template on that date. */
  async deleteOverride(staff: Users, date: string): Promise<void> {
    await this.overrideRepository.delete({ staff: { id: staff.id }, date });
  }

  async listBlocks(
    staffIds: number[],
    range: { start: Date; end: Date },
  ): Promise<TimeBlock[]> {
    return this.blockRepository
      .createQueryBuilder('block')
      .leftJoin('block.staff', 'staff')
      .addSelect('staff.id')
      .where('staff.id IN (:...staffIds)', { staffIds })
      .andWhere('block.start_time < :end', { end: range.end })
      .andWhere('block.end_time > :start', { start: range.start })
      .orderBy('block.start_time', 'ASC')
      .getMany();
  }

  /**
   * Takes time out of a staff member's day. Refused if it would overlap a
   * confirmed booking: cancel or move the booking first.
   */
  async createBlock(
    business: Business,
    staff: Users,
    startValue: string,
    endValue: string,
    reason?: string,
  ): Promise<TimeBlock> {
    const start = parseDateTimeIn(startValue, business.timezone);
    const end = parseDateTimeIn(endValue, business.timezone);
    if (!start || !end || end <= start) {
      throw new BadRequestException('end must be after start');
    }
    if (end.getTime() - start.getTime() > MAX_BLOCK_DAYS * 86_400_000) {
      throw new BadRequestException(
        `A block can't be longer than ${MAX_BLOCK_DAYS} days`,
      );
    }
    const clashes = await this.confirmedBookings([staff.id], { start, end });
    if (clashes.length > 0) {
      throw new ConflictException(
        `This time overlaps ${clashes.length} booking(s); cancel them first`,
      );
    }
    const block = await this.blockRepository.save(
      this.blockRepository.create({
        staff: { id: staff.id } as Users,
        start_time: start,
        end_time: end,
        reason: reason ?? null,
      }),
    );
    return block;
  }

  async deleteBlock(allowedStaffIds: number[], id: number): Promise<void> {
    const block = await this.blockRepository.findOne({
      where: { id, staff: { id: In(allowedStaffIds) } },
    });
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    await this.blockRepository.remove(block);
  }

  /**
   * Everything availability needs for some staff over some days: the
   * working intervals per staff per day, and their busy time.
   */
  async loadCalendar(
    staffIds: number[],
    days: string[],
    range: { start: Date; end: Date },
  ): Promise<{
    workingFor: (staffId: number, day: string) => WorkingInterval[];
    busyFor: (staffId: number) => BusyInterval[];
  }> {
    const [weekly, overrides, blocks, bookings] = await Promise.all([
      this.workingHoursRepository.find({
        where: { staff: { id: In(staffIds) } },
        relations: { staff: true },
      }),
      this.overrideRepository.find({
        where: {
          staff: { id: In(staffIds) },
          date: Between(days[0], days[days.length - 1]),
        },
        relations: { staff: true },
      }),
      this.listBlocks(staffIds, range),
      this.confirmedBookings(staffIds, range),
    ]);

    return {
      workingFor: (staffId, day) =>
        workingIntervalsFor(
          weekly
            .filter(
              (w) => w.staff.id === staffId && w.weekday === weekdayOf(day),
            )
            .map((w) => ({
              startMinute: w.start_minute,
              endMinute: w.end_minute,
            })),
          groupOverrides(overrides.filter((o) => o.staff.id === staffId)).get(
            day,
          ),
        ),
      busyFor: (staffId) => [
        ...blocks
          .filter((b) => b.staff.id === staffId)
          .map((b) => ({ start: b.start_time, end: b.end_time })),
        ...bookings
          .filter((b) => b.staff.id === staffId)
          .map((b) => ({ start: b.start_time, end: b.blocked_until })),
      ],
    };
  }

  private confirmedBookings(
    staffIds: number[],
    range: { start: Date; end: Date },
  ): Promise<Booking[]> {
    return this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.staff', 'staff')
      .addSelect('staff.id')
      .where('staff.id IN (:...staffIds)', { staffIds })
      .andWhere('booking.status = :status', {
        status: BookingStatus.CONFIRMED,
      })
      .andWhere('booking.start_time < :end', { end: range.end })
      .andWhere('booking.blocked_until > :start', { start: range.start })
      .getMany();
  }
}

/** Calendar days `from`..`to` inclusive, validated and bounded. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addCalendarDays(day, 1)) {
    days.push(day);
    if (days.length > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `A range can span at most ${MAX_RANGE_DAYS} days`,
      );
    }
  }
  if (days.length === 0) {
    throw new BadRequestException('to must not be before from');
  }
  return days;
}

function toMinuteIntervals(intervals: IntervalDto[]): WorkingInterval[] {
  try {
    return normalizeIntervals(
      intervals.map((i) => ({
        startMinute: parseClock(i.start),
        endMinute: parseClock(i.end),
      })),
    );
  } catch (e) {
    if (e instanceof InvalidIntervalsError) {
      throw new BadRequestException(e.message);
    }
    throw e;
  }
}

export function toClockInterval(startMinute: number, endMinute: number) {
  return { start: formatClock(startMinute), end: formatClock(endMinute) };
}

/** Override rows grouped by date; a day-off row yields an empty list. */
function groupOverrides(
  rows: ScheduleOverride[],
): Map<string, WorkingInterval[]> {
  const byDate = new Map<string, WorkingInterval[]>();
  for (const row of rows) {
    const intervals = byDate.get(row.date) ?? [];
    if (row.start_minute !== null && row.end_minute !== null) {
      intervals.push({
        startMinute: row.start_minute,
        endMinute: row.end_minute,
      });
    }
    byDate.set(row.date, intervals);
  }
  return byDate;
}
