import { ForbiddenException, Injectable } from '@nestjs/common';
import { DailySlotsDto } from './dto/dailySlots.dto';
import { addMinutes, setHours, setMinutes, startOfToday } from 'date-fns';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot } from './entities/slot.entity';
import { SlotStatus } from './enums/slotStatus.enum';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { User } from '../users/entities/user.entity';

export interface Slots {
  startTime: Date;
  endTime: Date;
  status: 'unavailable' | 'available';
}
@Injectable()
export class SlotManagementService {
  constructor(
    @InjectRepository(Slot)
    private readonly slotRepository: Repository<Slot>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  async setDailySlots(
    dailySlotsDto: DailySlotsDto,
    currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    const user: User = await this.userRepository.findOneBy({
      email: currentUser.email,
    });
    if (!user.business) {
      throw new ForbiddenException('you not authorized to open slots');
    }
    const openingHour: number = this.parseTime(dailySlotsDto.openingHours);
    const closingHour: number = this.parseTime(dailySlotsDto.closingHours);
    const lunchDuration: number = this.parseTime(
      dailySlotsDto.lunchDuration,
      'min',
    );
    const timePerClient: number = this.parseTime(
      dailySlotsDto.timePerClient,
      'min',
    );

    let start = startOfToday();
    start = this.setTime(start, openingHour);

    const totalSlots: number =
      (closingHour - openingHour) * (60 / timePerClient);
    const lunchStartSlot: number = Math.floor(totalSlots / 2);
    const lunchEndSlot: number =
      lunchStartSlot + Math.ceil(lunchDuration / timePerClient);

    const timeSlots: Date[] = Array.from({ length: totalSlots }, (_, i) =>
      addMinutes(start, i * timePerClient),
    );

    const slots: Slot[] = timeSlots.map((slotStart, i) => {
      const slotEnd: Date = addMinutes(slotStart, timePerClient);
      const isDuringLunch = i >= lunchStartSlot && i < lunchEndSlot;

      const slotEntity: Slot = new Slot();
      slotEntity.business = user.business;
      slotEntity.endTime = slotEnd;
      slotEntity.startTime = slotStart;
      slotEntity.status = isDuringLunch
        ? SlotStatus.UNAVAILABLE
        : SlotStatus.AVAILABLE;
      return slotEntity;
    });
    return await this.slotRepository.save(slots);
  }

  async findAll(currentUser: ActiveUserData) {
    const user: User = await this.userRepository.findOneBy({
      email: currentUser.email,
    });
    if (user.role == 'admin') {
      return await this.slotRepository.find();
    }
    return await this.slotRepository.findBy({ business: user.business });
  }

  protected parseTime(time: string, suffix = ''): number {
    return parseInt(time.split(suffix || ':')[0]);
  }

  protected setTime(date: Date, hour: number): Date {
    return setMinutes(setHours(date, hour), 0);
  }
}
