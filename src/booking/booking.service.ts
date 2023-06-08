import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReserveSlotDto } from './dto/reserveSlot.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Business } from '../business/entities/business.entity';
import { Repository } from 'typeorm';
import { Slot } from '../slot-management/entities/slot.entity';
import { SlotStatus } from '../slot-management/enums/slotStatus.enum';
import { Booking } from './entities/booking.entity';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { User } from '../users/entities/user.entity';
import { plainToClass } from 'class-transformer';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Slot)
    private readonly slotRepository: Repository<Slot>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  async reserveSlot(
    reserveSlotDto: ReserveSlotDto,
    businessId: string,
    user: ActiveUserData,
  ): Promise<Booking> {
    const business: Business = await this.businessRepository.findOneBy({
      id: businessId,
    });
    const client: User = await this.userRepository.findOneBy({
      email: user.email,
    });
    const slots: Slot[] = await this.slotRepository.findBy({
      business: business,
      status: SlotStatus.AVAILABLE,
    });
    const desiredDate = new Date(reserveSlotDto.reserveSlot);
    desiredDate.setSeconds(0, 0);
    if (desiredDate < new Date()) {
      throw new BadRequestException('Cannot book a slot in the past');
    }
    const slotToReserve = slots.filter((slot) => {
      const slotStartTime = new Date(slot.startTime);
      slotStartTime.setSeconds(0, 0);
      return slotStartTime.getTime() === desiredDate.getTime();
    })[0];
    if (!slotToReserve) {
      throw new NotFoundException('No available slot for the desired time');
    }

    const booking = new Booking();
    booking.bookSlot = desiredDate;
    booking.user = client;
    booking.business = business;
    booking.slot = slotToReserve;

    await this.bookingRepository.save(booking);

    slotToReserve.bookingBy = booking;
    slotToReserve.status = SlotStatus.UNAVAILABLE;
    await this.slotRepository.save(slotToReserve);
    return plainToClass(Booking, booking, {
      excludeExtraneousValues: true,
    });
  }

  async availableSlots(businessId: string, page: number): Promise<Slot[]> {
    const start = new Date();
    start.setDate(start.getDate() + (page - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return this.slotRepository
      .createQueryBuilder('slot')
      .where('slot.businessId = :businessId', { businessId })
      .andWhere('slot.startTime >= :start', { start })
      .andWhere('slot.endTime < :end', { end })
      .andWhere('slot.status = :status', { status: SlotStatus.AVAILABLE })
      .getMany();
  }

  async findReservedSlotById(id, currentUser: ActiveUserData) {
    const user: User = await this.userRepository.findOneBy({
      email: currentUser.email,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const reservedSlotByClient: Booking = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.business', 'business')
      .where('booking.id = :bookingId', { bookingId: id })
      .getOne();

    if (!reservedSlotByClient) {
      throw new NotFoundException('Slot not found');
    }

    if (reservedSlotByClient.user.id !== user.id) {
      throw new ForbiddenException(`this is not your reservation`);
    }

    return reservedSlotByClient;
  }

  async cancelReservation(id, currentUser: ActiveUserData) {
    if (!id) {
      throw new NotFoundException('Slot not found');
    }
    const slotToCancel: Booking = await this.findReservedSlotById(
      id,
      currentUser,
    );
    if (!slotToCancel) {
      throw new NotFoundException('Slot not found');
    }
    const slot: Slot = await this.slotRepository.findOneBy({
      bookingBy: slotToCancel,
    });

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }
    slot.status = SlotStatus.AVAILABLE;
    slot.bookingBy = null;
    await this.slotRepository.save(slot);
    await this.bookingRepository.remove(slotToCancel);
    return {
      message: 'Your slot removed successfully',
    };
  }

  async findReservedSlotsByUser(currentUser: ActiveUserData) {
    const user: User = await this.userRepository.findOneBy({
      email: currentUser.email,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.business', 'business')
      .leftJoinAndSelect('booking.slot', 'slot')
      .where('user.id = :userId', { userId: user.id })
      .getMany();
  }
}
