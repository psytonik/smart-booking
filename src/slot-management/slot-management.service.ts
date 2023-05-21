import { ForbiddenException, Injectable } from '@nestjs/common';
import { DailySlotsDto } from './dto/dailySlots.dto';
import {
  addMinutes,
  addWeeks,
  endOfDay,
  setDay,
  setHours,
  setMinutes,
  startOfDay,
  startOfToday,
  startOfWeek,
} from 'date-fns';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Slot } from './entities/slot.entity';
import { SlotStatus } from './enums/slotStatus.enum';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { User } from '../users/entities/user.entity';
import { WeeklySlotsDto } from './dto/weeklySlots.dto';
import { Business } from '../business/entities/business.entity';

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

  private async findUser(currentUser: ActiveUserData) {
    const user = await this.userRepository.findOneBy({
      email: currentUser.email,
    });
    if (!user.business)
      throw new ForbiddenException('you not authorized to open slots');
    return user;
  }

  private parseTime(time: string, suffix = ''): number {
    return parseInt(time.split(suffix || ':')[0]);
  }

  private setTime(date: Date, hour: number): Date {
    return setMinutes(setHours(date, hour), 0);
  }

  private createSlots(
    totalSlots,
    start,
    timePerClient,
    lunchStartSlot,
    lunchEndSlot,
    user,
  ) {
    return Array.from({ length: totalSlots }).map((_, i) => {
      const slotStart = addMinutes(start, i * timePerClient);
      const slotEnd = addMinutes(slotStart, timePerClient);
      const isDuringLunch = i >= lunchStartSlot && i < lunchEndSlot;

      const slot = new Slot();
      slot.business = user.business;
      slot.endTime = slotEnd;
      slot.startTime = slotStart;
      slot.status = isDuringLunch
        ? SlotStatus.UNAVAILABLE
        : SlotStatus.AVAILABLE;

      return slot;
    });
  }

  async setDailySlots(
    dailySlotsDto: DailySlotsDto,
    currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    const user = await this.findUser(currentUser);

    const date = startOfToday();
    await this.checkSlotsExistence(date, user);

    const openingHour = this.parseTime(dailySlotsDto.openingHours);
    const closingHour = this.parseTime(dailySlotsDto.closingHours);
    const lunchDuration = this.parseTime(dailySlotsDto.lunchDuration, 'min');
    const timePerClient = this.parseTime(dailySlotsDto.timePerClient, 'min');

    const start = this.setTime(startOfToday(), openingHour);
    const totalSlots = (closingHour - openingHour) * (60 / timePerClient);
    const lunchStartSlot = Math.floor(totalSlots / 2);
    const lunchEndSlot =
      lunchStartSlot + Math.ceil(lunchDuration / timePerClient);

    const dailySlots = this.createSlots(
      totalSlots,
      start,
      timePerClient,
      lunchStartSlot,
      lunchEndSlot,
      user,
    );

    return await this.slotRepository.save(dailySlots);
  }

  async findAll(currentUser: ActiveUserData) {
    const user = await this.findUser(currentUser);

    if (user.role == 'admin') return this.slotRepository.find();

    return this.slotRepository.findBy({ business: user.business });
  }

  async setWeeklySlots(
    weeklySlotsDto: WeeklySlotsDto,
    currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    const user = await this.findUser(currentUser);

    const openingHour = this.parseTime(weeklySlotsDto.openingHours);
    const closingHour = this.parseTime(weeklySlotsDto.closingHours);
    const lunchDuration = this.parseTime(weeklySlotsDto.lunchDuration, 'min');
    const timePerClient = this.parseTime(weeklySlotsDto.timePerClient, 'min');

    const totalSlots = (closingHour - openingHour) * (60 / timePerClient);
    const lunchStartSlot = Math.floor(totalSlots / 2);
    const lunchEndSlot =
      lunchStartSlot + Math.ceil(lunchDuration / timePerClient);

    const slots = [];
    for (let i = 0; i < weeklySlotsDto.weeksAhead; i++) {
      for (let j = 0; j < weeklySlotsDto.setWorkDays.length; j++) {
        const workDay = weeklySlotsDto.setWorkDays[j];
        const date = setDay(
          startOfWeek(addWeeks(new Date(), i)),
          [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ].indexOf(workDay),
        );

        // Perform the check before slot creation
        await this.checkSlotsExistence(date, user);

        const start = this.setTime(date, openingHour);
        const dailySlots = this.createSlots(
          totalSlots,
          start,
          timePerClient,
          lunchStartSlot,
          lunchEndSlot,
          user,
        );
        slots.push(...dailySlots);
      }
    }

    return this.slotRepository.save(slots);
  }

  private async checkSlotsExistence(date: Date, user: User) {
    const existingSlots = await this.slotRepository.find({
      where: {
        business: user.business,
        startTime: Between(startOfDay(date), endOfDay(date)),
      },
    });

    if (existingSlots.length > 0) {
      throw new ForbiddenException('Slots for this day already exist');
    }
  }
}
