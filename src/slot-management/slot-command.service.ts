import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Slot } from './entities/slot.entity';
import { SlotStatus } from './enums/slotStatus.enum';
import { Users } from '../users/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import { SlotAccessService, SlotContext } from './slot-access.service';
import {
  buildSchedule,
  calendarDayOf,
  generateDaySlots,
  InvalidScheduleError,
  Schedule,
  ScheduleInput,
  SlotInterval,
  weeklyDays,
} from './slot-schedule';

/** Write side of slot management. */
@Injectable()
export class SlotCommandService {
  constructor(
    @InjectRepository(Slot)
    private readonly slotRepository: Repository<Slot>,
    private readonly slotAccess: SlotAccessService,
    private readonly dataSource: DataSource,
  ) {}

  async createDay(
    ctx: SlotContext,
    staff: Users,
    day: string,
    input: ScheduleInput,
  ): Promise<Slot[]> {
    return this.createDays(ctx, staff, [day], input);
  }

  async createWeeks(
    ctx: SlotContext,
    staff: Users,
    firstDay: string,
    weeks: number,
    workDays: string[],
    holidays: string[] | undefined,
    input: ScheduleInput,
  ): Promise<Slot[]> {
    const days = weeklyDays(firstDay, weeks, workDays, holidays);
    if (days.length === 0) {
      throw new BadRequestException('No work days in the requested range');
    }
    return this.createDays(ctx, staff, days, input);
  }

  /**
   * Replaces a day's schedule for one staff member. Booked slots are kept
   * as they are; free slots and breaks are regenerated around them.
   */
  async updateDay(
    ctx: SlotContext,
    staff: Users,
    day: string,
    input: ScheduleInput,
  ): Promise<Slot[]> {
    const schedule = this.schedule(input);
    const range = this.slotAccess.dayRange(ctx.business, day);
    this.slotAccess.assertNotInPast(ctx.business, day);

    return this.dataSource.transaction(async (manager) => {
      const existing = await this.staffSlotsInRange(manager, staff, range);
      const booked = existing.filter((s) => s.status === SlotStatus.BOOKED);
      await manager.remove(
        existing.filter((s) => s.status !== SlotStatus.BOOKED),
      );

      const fresh = generateDaySlots(day, schedule, ctx.business.timezone)
        .filter((interval) => !booked.some((b) => overlaps(b, interval)))
        .map((interval) => this.toSlot(interval, ctx, staff));
      await manager.save(fresh);
      return [...fresh, ...booked].sort(
        (a, b) => a.start_time.getTime() - b.start_time.getTime(),
      );
    });
  }

  /** Removes a day's free slots and breaks for one staff member. */
  async closeDay(ctx: SlotContext, staff: Users, day: string): Promise<void> {
    const range = this.slotAccess.dayRange(ctx.business, day);
    await this.slotRepository
      .createQueryBuilder()
      .delete()
      .where('"staffId" = :staffId', { staffId: staff.id })
      .andWhere('status IN (:...statuses)', {
        statuses: [SlotStatus.AVAILABLE, SlotStatus.BREAK],
      })
      .andWhere('start_time >= :start AND start_time < :end', range)
      .execute();
  }

  async releaseSlot(slot: Slot, manager?: EntityManager): Promise<Slot> {
    slot.status = SlotStatus.AVAILABLE;
    slot.booking_by = null;
    return (manager ?? this.slotRepository.manager).save(slot);
  }

  private async createDays(
    ctx: SlotContext,
    staff: Users,
    days: string[],
    input: ScheduleInput,
  ): Promise<Slot[]> {
    const schedule = this.schedule(input);
    const timeZone = ctx.business.timezone;
    days.forEach((day) => this.slotAccess.assertNotInPast(ctx.business, day));

    return this.dataSource.transaction(async (manager) => {
      await this.assertDaysAreFree(manager, ctx, staff, days);
      const slots = days.flatMap((day) =>
        generateDaySlots(day, schedule, timeZone).map((interval) =>
          this.toSlot(interval, ctx, staff),
        ),
      );
      return manager.save(slots);
    });
  }

  /**
   * A staff member's day is scheduled as a whole: creating slots for a day
   * that already has any is a conflict (use PATCH /slots/:date to change it).
   */
  private async assertDaysAreFree(
    manager: EntityManager,
    ctx: SlotContext,
    staff: Users,
    days: string[],
  ): Promise<void> {
    const first = this.slotAccess.dayRange(ctx.business, days[0]);
    const last = this.slotAccess.dayRange(ctx.business, days[days.length - 1]);
    const existing = await this.staffSlotsInRange(manager, staff, {
      start: first.start,
      end: last.end,
    });
    const taken = new Set(
      existing.map((s) => calendarDayOf(s.start_time, ctx.business.timezone)),
    );
    const conflicts = days.filter((day) => taken.has(day));
    if (conflicts.length > 0) {
      throw new ConflictException(
        `Slots already exist for: ${conflicts.join(', ')}`,
      );
    }
  }

  private staffSlotsInRange(
    manager: EntityManager,
    staff: Users,
    range: { start: Date; end: Date },
  ): Promise<Slot[]> {
    return manager
      .createQueryBuilder(Slot, 'slot')
      .where('slot.staffId = :staffId', { staffId: staff.id })
      .andWhere('slot.start_time >= :start', { start: range.start })
      .andWhere('slot.start_time < :end', { end: range.end })
      .getMany();
  }

  private schedule(input: ScheduleInput): Schedule {
    try {
      return buildSchedule(input);
    } catch (e) {
      if (e instanceof InvalidScheduleError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }

  private toSlot(interval: SlotInterval, ctx: SlotContext, staff: Users): Slot {
    const slot = new Slot();
    slot.start_time = interval.start;
    slot.end_time = interval.end;
    slot.status = interval.isBreak ? SlotStatus.BREAK : SlotStatus.AVAILABLE;
    slot.business = { id: ctx.business.id } as Business;
    slot.staff = { id: staff.id } as Users;
    return slot;
  }
}

function overlaps(slot: Slot, interval: SlotInterval): boolean {
  return slot.start_time < interval.end && interval.start < slot.end_time;
}
