import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { addDays, addMinutes, endOfDay, format, startOfDay } from 'date-fns';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Slot } from './entities/slot.entity';
import { Business } from '../business/entities/business.entity';
import { Users } from '../users/entities/user.entity';
import { Booking } from '../booking/entities/booking.entity';
import { SlotStatus } from './enums/slotStatus.enum';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { WeeklySlotsDto } from './dto/weeklySlots.dto';
import { DailySlotsDto } from './dto/dailySlots.dto';
import { UpdateDailySlotsDto } from './dto/updateDailySlots.dto';
import { Role } from '../users/enums/role.enum';
import { UsersService } from '../users/users.service';
import { BusinessService } from '../business/business.service';
import {
  MAX_TIME_PER_CLIENT,
  MIN_TIME_PER_CLIENT,
  WEEK_DAYS,
} from './slot-management.constants';

@Injectable()
export class SlotManagementService {
  constructor(
    @InjectRepository(Slot)
    private readonly slotRepository: Repository<Slot>,
    private readonly usersService: UsersService,
    private readonly businessService: BusinessService,
  ) {}

  async findAvailableSlots(
    businessId: string,
    start: Date,
    end: Date,
  ): Promise<Slot[]> {
    return this.slotRepository
      .createQueryBuilder('slot')
      .where('slot.businessId = :businessId', { businessId })
      .andWhere('slot.start_time >= :start', { start })
      .andWhere('slot.end_time < :end', { end })
      .andWhere('slot.status = :status', { status: SlotStatus.AVAILABLE })
      .getMany();
  }

  async findSlotByBooking(booking: Booking): Promise<Slot | null> {
    return this.slotRepository.findOneBy({ booking_by: booking });
  }

  async releaseSlot(slot: Slot): Promise<Slot> {
    slot.status = SlotStatus.AVAILABLE;
    slot.booking_by = null;
    return this.slotRepository.save(slot);
  }

  async setDailySlots(
    dailySlotsDto: DailySlotsDto,
    currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    const user: Users = await this.findUser(currentUser);
    const business = await this.getBusinessByOwner(user);
    const schedule = this.buildSchedule(dailySlotsDto);

    const day = startOfDay(new Date(dailySlotsDto.startDate));
    await this.assertDaysAreFree([day], business);

    const dailySlots = this.createSlots(
      schedule.totalSlots,
      addMinutes(day, schedule.openingMinutes),
      schedule.timePerClient,
      schedule.lunchStartSlot,
      schedule.lunchEndSlot,
      business,
    );
    return await this.slotRepository.save(dailySlots);
  }

  async setWeeklySlots(
    weeklySlotsDto: WeeklySlotsDto,
    currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    const user = await this.findUser(currentUser);
    const business = await this.getBusinessByOwner(user);
    const schedule = this.buildSchedule(weeklySlotsDto);

    const firstDay = startOfDay(
      weeklySlotsDto.startDate
        ? new Date(weeklySlotsDto.startDate)
        : new Date(),
    );
    const workDayIndexes = new Set(
      weeklySlotsDto.setWorkDays.map((d) =>
        WEEK_DAYS.indexOf(d as (typeof WEEK_DAYS)[number]),
      ),
    );
    const holidays = new Set(weeklySlotsDto.setHolidays ?? []);

    const days: Date[] = [];
    for (let offset = 0; offset < weeklySlotsDto.weeksAhead * 7; offset++) {
      const day = addDays(firstDay, offset);
      if (
        workDayIndexes.has(day.getDay()) &&
        !holidays.has(format(day, 'yyyy-MM-dd'))
      ) {
        days.push(day);
      }
    }
    if (days.length === 0) {
      throw new BadRequestException('No work days in the requested range');
    }
    await this.assertDaysAreFree(days, business);

    const slots: Slot[] = days.flatMap((day) =>
      this.createSlots(
        schedule.totalSlots,
        addMinutes(day, schedule.openingMinutes),
        schedule.timePerClient,
        schedule.lunchStartSlot,
        schedule.lunchEndSlot,
        business,
      ),
    );
    // save() with an array runs in a single transaction.
    return this.slotRepository.save(slots);
  }

  async findAllSlots(currentUser: ActiveUserData): Promise<Slot[]> {
    const user = await this.findUser(currentUser);
    const business = await this.getBusinessByOwner(user);
    if (user.role == 'admin') {
      return await this.slotRepository
        .createQueryBuilder('slot')
        .leftJoinAndSelect('slot.booking_by', 'booking')
        .leftJoinAndSelect('booking.user', 'user')
        .orderBy('slot.start_time', 'ASC')
        .getMany();
    }
    return await this.slotRepository
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.booking_by', 'booking')
      .leftJoinAndSelect('booking.user', 'user')
      .where('slot.business = :business', { business: business.id })
      .orderBy('slot.start_time', 'ASC')
      .getMany();
  }

  async getOpenedSlotByDay(
    date: string,
    currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    const user = await this.findUser(currentUser);
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (user.role === Role.Admin) {
      return await this.slotRepository.findBy({
        start_time: Between(startOfDay(targetDate), endOfDay(targetDate)),
      });
    }
    const business = await this.getBusinessByOwner(user);
    return await this.slotRepository.findBy({
      business: { id: business.id },
      start_time: Between(startOfDay(targetDate), endOfDay(targetDate)),
    });
  }

  async closeOpenedSlotsByDate(
    date: string,
    user: ActiveUserData,
  ): Promise<void> {
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    // Always scoped to the caller's own business, admins included: an
    // unscoped delete would wipe every business's free slots for the day.
    const business = await this.getBusinessByOwner(await this.findUser(user));
    await this.slotRepository.delete({
      business: { id: business.id },
      status: SlotStatus.AVAILABLE,
      start_time: Between(startOfDay(targetDate), endOfDay(targetDate)),
    });
  }

  private async findUser(currentUser: ActiveUserData): Promise<Users> {
    const user = await this.usersService.findActiveUser(currentUser.sub);
    if (user.role == Role.Client)
      throw new ForbiddenException('you not authorized as business owner');
    return user;
  }

  private async getBusinessByOwner(user): Promise<Business> {
    const business: Business = await this.businessService.findByOwnerId(
      user.id,
    );
    if (!business || business.owner.id !== user.id) {
      throw new BadRequestException('It is not your business dude');
    }
    return business;
  }

  /**
   * Validates the working-hours input and turns it into a slot grid. Rejects
   * input that would produce no slots, fractional slots past closing time, or
   * an unbounded loop (e.g. `timePerClient: "0 min"`).
   */
  private buildSchedule(dto: {
    openingHours: string;
    closingHours: string;
    lunchDuration: string;
    timePerClient: string;
  }): {
    openingMinutes: number;
    timePerClient: number;
    totalSlots: number;
    lunchStartSlot: number;
    lunchEndSlot: number;
  } {
    const openingMinutes = this.parseClock(dto.openingHours);
    const closingMinutes = this.parseClock(dto.closingHours);
    const lunchDuration = parseInt(dto.lunchDuration, 10);
    const timePerClient = parseInt(dto.timePerClient, 10);

    if (
      timePerClient < MIN_TIME_PER_CLIENT ||
      timePerClient > MAX_TIME_PER_CLIENT
    ) {
      throw new BadRequestException(
        `timePerClient must be between ${MIN_TIME_PER_CLIENT} and ${MAX_TIME_PER_CLIENT} minutes`,
      );
    }
    const workMinutes = closingMinutes - openingMinutes;
    if (workMinutes <= 0) {
      throw new BadRequestException('closingHours must be after openingHours');
    }
    if (lunchDuration >= workMinutes) {
      throw new BadRequestException(
        'lunchDuration must be shorter than the working day',
      );
    }
    const totalSlots = Math.floor(workMinutes / timePerClient);
    if (totalSlots === 0) {
      throw new BadRequestException(
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

  private parseClock(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private createSlots(
    totalSlots: number,
    start: Date,
    timePerClient: number,
    lunchStartSlot: number,
    lunchEndSlot: number,
    business: Business,
    unavailableSlots: Slot[] = [],
  ): Slot[] {
    const slots: Slot[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const slotStartTime = addMinutes(new Date(start), i * timePerClient);
      const slotEndTime = addMinutes(slotStartTime, timePerClient);

      const isReserved = unavailableSlots.some(
        (slot) =>
          (slot.start_time.getTime() < slotEndTime.getTime() &&
            slotEndTime.getTime() <= slot.end_time.getTime()) ||
          (slotStartTime.getTime() >= slot.start_time.getTime() &&
            slotStartTime.getTime() < slot.end_time.getTime()),
      );

      if (isReserved) {
        continue;
      }

      const slot = new Slot();
      slot.start_time = slotStartTime;
      slot.end_time = slotEndTime;
      slot.business = business;
      slot.status = SlotStatus.AVAILABLE;
      if (i >= lunchStartSlot && i < lunchEndSlot) {
        slot.status = SlotStatus.UNAVAILABLE;
      }
      slots.push(slot);
    }
    return slots;
  }

  /**
   * A day is scheduled as a whole: creating slots for a day that already has
   * any is a conflict (use PATCH /slots/:date to change it).
   */
  private async assertDaysAreFree(
    days: Date[],
    business: Business,
  ): Promise<void> {
    const existing = await this.slotRepository.find({
      select: { id: true, start_time: true },
      where: {
        business: { id: business.id },
        start_time: Between(
          startOfDay(days[0]),
          endOfDay(days[days.length - 1]),
        ),
      },
    });
    const takenDays = new Set(
      existing.map((slot) => format(slot.start_time, 'yyyy-MM-dd')),
    );
    const conflicts = days
      .map((day) => format(day, 'yyyy-MM-dd'))
      .filter((day) => takenDays.has(day));
    if (conflicts.length > 0) {
      throw new ConflictException(
        `Slots already exist for: ${conflicts.join(', ')}`,
      );
    }
  }

  async updateDailySlots(
    updateDailySlots: UpdateDailySlotsDto,
    currentUser: ActiveUserData,
    day,
  ) {
    const user = await this.findUser(currentUser);
    const business = await this.getBusinessByOwner(user);
    const date = new Date(day);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (date < new Date()) {
      throw new ConflictException('Dude you can update past dates !');
    }
    const existingSlots: Slot[] = await this.slotRepository.find({
      where: {
        business: { id: business.id },
        start_time: Between(startOfDay(date), endOfDay(date)),
      },
    });
    const unavailableSlots = existingSlots.filter(
      (slot) => slot.status === SlotStatus.UNAVAILABLE,
    );
    const availableSlots = existingSlots.filter(
      (slot) => slot.status !== SlotStatus.UNAVAILABLE,
    );
    const schedule = this.buildSchedule(updateDailySlots);
    await this.slotRepository.remove(availableSlots);
    const updatedSlots: Slot[] = this.createSlots(
      schedule.totalSlots,
      addMinutes(startOfDay(date), schedule.openingMinutes),
      schedule.timePerClient,
      schedule.lunchStartSlot,
      schedule.lunchEndSlot,
      business,
      unavailableSlots,
    );
    updatedSlots.forEach((slot, i) => {
      const existingSlot = unavailableSlots.find(
        (s) =>
          s.start_time.getTime() === slot.start_time.getTime() &&
          s.end_time.getTime() === slot.end_time.getTime(),
      );
      if (existingSlot) {
        updatedSlots[i] = existingSlot;
      }
    });
    return await this.slotRepository.save([
      ...updatedSlots,
      ...unavailableSlots,
    ]);
  }

  async getReportByDate(
    reportDate,
    currentUser,
  ): Promise<{ slots: Slot[]; totalSlots: number }> {
    const user = await this.findUser(currentUser);
    const business = await this.getBusinessByOwner(user);

    const { startDate, endDate } = reportDate;

    const slots = await this.slotRepository
      .createQueryBuilder('slot')
      .where('slot.business = :business', { business: business.id })
      .andWhere('slot.booking_by IS NOT NULL')
      .andWhere('slot.start_time BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      .getMany();
    return {
      totalSlots: slots.length,
      slots,
    };
  }
}
