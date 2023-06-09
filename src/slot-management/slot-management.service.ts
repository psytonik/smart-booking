import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  addDays,
  addMinutes,
  endOfDay,
  setHours,
  setMinutes,
  startOfDay,
  startOfToday,
} from 'date-fns';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Slot } from './entities/slot.entity';
import { Business } from '../business/entities/business.entity';
import { User } from '../users/entities/user.entity';
import { SlotStatus } from './enums/slotStatus.enum';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { WeeklySlotsDto } from './dto/weeklySlots.dto';
import { DailySlotsDto } from './dto/dailySlots.dto';
import { UpdateDailySlotsDto } from './dto/updateDailySlots.dto';
import { Role } from '../users/enums/role.enum';

@Injectable()
export class SlotManagementService {
  constructor(
    @InjectRepository(Slot)
    private readonly slotRepository: Repository<Slot>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async setDailySlots(
    dailySlotsDto: DailySlotsDto,
    currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    const user: User = await this.findUser(currentUser);
    const business = await this.getBusinessByOwner(user);

    let start: Date = new Date(dailySlotsDto.startDate) || startOfToday();
    await this.checkSlotsExistenceByDate(start, business);
    start = this.setTime(start, this.parseTime(dailySlotsDto.openingHours));
    const { totalSlots, lunchStartSlot, lunchEndSlot } =
      this.calculateSlots(dailySlotsDto);

    let dailySlots = this.createSlots(
      totalSlots,
      start,
      this.parseTime(dailySlotsDto.timePerClient, 'min'),
      lunchStartSlot,
      lunchEndSlot,
      business,
    );
    dailySlots = await this.checkExistingSlotsForDay(dailySlots);

    return await this.slotRepository.save(dailySlots);
  }

  async setWeeklySlots(
    weeklySlotsDto: WeeklySlotsDto,
    currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    const user = await this.findUser(currentUser);
    const business = await this.getBusinessByOwner(user);
    const { totalSlots, lunchStartSlot, lunchEndSlot } =
      this.calculateSlots(weeklySlotsDto);

    const slots = [];
    for (let i = 0; i < weeklySlotsDto.weeksAhead; i++) {
      for (let j = 0; j < weeklySlotsDto.setWorkDays.length; j++) {
        const workDay = weeklySlotsDto.setWorkDays[j];
        const startDate = weeklySlotsDto.startDate
          ? new Date(weeklySlotsDto.startDate)
          : new Date();
        const startDateDay = startDate.getDay();
        const dayIndex = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ].indexOf(workDay);
        let date;
        if (startDateDay <= dayIndex) {
          // The workday is in this week
          date = addDays(startDate, dayIndex - startDateDay);
        } else {
          // The workday is in next week
          date = addDays(startDate, 7 - startDateDay + dayIndex);
        }

        await this.checkSlotsExistenceByDate(date, business);

        const start = this.setTime(
          date,
          this.parseTime(weeklySlotsDto.openingHours),
        );
        const dailySlots: Slot[] = this.createSlots(
          totalSlots,
          start,
          this.parseTime(weeklySlotsDto.timePerClient, 'min'),
          lunchStartSlot,
          lunchEndSlot,
          business,
        );
        slots.push(...dailySlots);
      }
    }

    return this.slotRepository.save(slots);
  }

  async findAllSlots(currentUser: ActiveUserData): Promise<Slot[]> {
    const user = await this.findUser(currentUser);
    const business = await this.getBusinessByOwner(user);
    if (user.role == 'admin') {
      return await this.slotRepository
        .createQueryBuilder('slot')
        .leftJoinAndSelect('slot.bookingBy', 'booking')
        .leftJoinAndSelect('booking.user', 'user')
        .orderBy('slot.startTime', 'ASC')
        .getMany();
    }
    return await this.slotRepository
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.bookingBy', 'booking')
      .leftJoinAndSelect('booking.user', 'user')
      .where('slot.business = :business', { business: business.id })
      .orderBy('slot.startTime', 'ASC')
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
    return await this.slotRepository.findBy({
      business: user.business,
      startTime: Between(startOfDay(targetDate), endOfDay(targetDate)),
    });
  }

  async closeOpenedSlotsByDate(
    date: string,
    user: ActiveUserData,
  ): Promise<void> {
    await this.findUser(user);
    const datesToDelete: Slot[] = await this.getOpenedSlotByDay(date, user);
    datesToDelete.filter(async (date: Slot): Promise<Slot> => {
      if (date.status == SlotStatus.AVAILABLE) {
        return await this.slotRepository.remove(date);
      }
    });
  }

  private async findUser(currentUser: ActiveUserData): Promise<User> {
    const user = await this.userRepository.findOneBy({
      email: currentUser.email,
    });
    if (user.role == Role.Client)
      throw new ForbiddenException('you not authorized as business owner');
    return user;
  }

  private async getBusinessByOwner(user): Promise<Business> {
    const business: Business = await this.businessRepository.findOneBy({
      owner: user,
    });
    if (business.owner.id !== user.id) {
      throw new BadRequestException('It is not your business dude');
    }
    return business;
  }

  private parseTime(time: string, suffix = ''): number {
    return parseInt(time.split(suffix || ':')[0]);
  }

  private setTime(date: Date, hour: number): Date {
    return setMinutes(setHours(date, hour), 0);
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
          (slot.startTime.getTime() < slotEndTime.getTime() &&
            slotEndTime.getTime() <= slot.endTime.getTime()) ||
          (slotStartTime.getTime() >= slot.startTime.getTime() &&
            slotStartTime.getTime() < slot.endTime.getTime()),
      );

      if (isReserved) {
        continue;
      }

      const slot = new Slot();
      slot.startTime = slotStartTime;
      slot.endTime = slotEndTime;
      slot.business = business;
      slot.status = SlotStatus.AVAILABLE;
      if (i >= lunchStartSlot && i < lunchEndSlot) {
        slot.status = SlotStatus.UNAVAILABLE;
      }
      slots.push(slot);
    }
    return slots;
  }

  private async checkSlotsExistenceByDate(
    date: Date,
    business: Business,
  ): Promise<void> {
    const existingSlots = await this.slotRepository.find({
      where: {
        business,
        startTime: Between(startOfDay(date), endOfDay(date)),
      },
    });

    const unavailableSlotsExist = existingSlots.some(
      (slot): boolean => slot.status == SlotStatus.UNAVAILABLE,
    );
    if (unavailableSlotsExist) {
      throw new ConflictException(
        'Unavailable slots for this day already exist',
      );
    }
  }

  private async checkExistingSlotsForDay(slots: Slot[]): Promise<Slot[]> {
    const nonExistingSlots: Slot[] = [];

    for (const slot of slots) {
      const existingSlot = await this.slotRepository.findOne({
        where: { startTime: slot.startTime, endTime: slot.endTime },
      });
      if (existingSlot) {
        throw new ConflictException('Slot with this time already exists');
      }
      if (!existingSlot) {
        nonExistingSlots.push(slot);
      }
    }

    return nonExistingSlots;
  }

  private calculateSlots(dailySlotsDto: DailySlotsDto | WeeklySlotsDto): {
    totalSlots: number;
    lunchStartSlot: number;
    lunchEndSlot: number;
  } {
    const openingHour = this.parseTime(dailySlotsDto.openingHours);
    const closingHour = this.parseTime(dailySlotsDto.closingHours);
    const lunchDuration = this.parseTime(dailySlotsDto.lunchDuration, 'min');
    const timePerClient = this.parseTime(dailySlotsDto.timePerClient, 'min');

    const totalSlots = (closingHour - openingHour) * (60 / timePerClient);
    const lunchStartSlot = Math.floor(totalSlots / 2);
    const lunchEndSlot =
      lunchStartSlot + Math.ceil(lunchDuration / timePerClient);

    return { totalSlots, lunchStartSlot, lunchEndSlot };
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
        business: user.business,
        startTime: Between(startOfDay(date), endOfDay(date)),
      },
    });
    const unavailableSlots = existingSlots.filter(
      (slot) => slot.status === SlotStatus.UNAVAILABLE,
    );
    const availableSlots = existingSlots.filter(
      (slot) => slot.status !== SlotStatus.UNAVAILABLE,
    );
    await this.slotRepository.remove(availableSlots);
    const start: Date = this.setTime(
      date,
      this.parseTime(updateDailySlots.openingHours),
    );
    const { totalSlots, lunchStartSlot, lunchEndSlot } = this.calculateSlots(
      updateDailySlots as DailySlotsDto,
    );
    const updatedSlots: Slot[] = this.createSlots(
      totalSlots,
      start,
      this.parseTime(updateDailySlots.timePerClient, 'min'),
      lunchStartSlot,
      lunchEndSlot,
      business,
      unavailableSlots,
    );
    updatedSlots.forEach((slot, i) => {
      const existingSlot = unavailableSlots.find(
        (s) =>
          s.startTime.getTime() === slot.startTime.getTime() &&
          s.endTime.getTime() === slot.endTime.getTime(),
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
      .andWhere('slot.bookingBy IS NOT NULL')
      .andWhere('slot.startTime BETWEEN :startDate AND :endDate', {
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
