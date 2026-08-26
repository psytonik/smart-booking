import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReserveSlotDto } from './dto/reserveSlot.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Business } from '../business/entities/business.entity';
import { DataSource, Repository } from 'typeorm';
import { Slot } from '../slot-management/entities/slot.entity';
import { SlotStatus } from '../slot-management/enums/slotStatus.enum';
import { Booking } from './entities/booking.entity';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { Users } from '../users/entities/user.entity';
import { plainToClass } from 'class-transformer';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessService } from '../business/business.service';
import { UsersService } from '../users/users.service';
import { SlotManagementService } from '../slot-management/slot-management.service';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly businessService: BusinessService,
    private readonly usersService: UsersService,
    private readonly slotManagementService: SlotManagementService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}
  async reserveSlot(
    reserveSlotDto: ReserveSlotDto,
    businessId: string,
    user: ActiveUserData,
  ): Promise<Booking> {
    const business: Business = await this.businessService.findById(businessId);
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    const client: Users = await this.usersService.findByEmail(user.email);
    const desiredDate = new Date(reserveSlotDto.reserveSlot);
    desiredDate.setSeconds(0, 0);
    if (desiredDate < new Date()) {
      throw new BadRequestException('Cannot book a slot in the past');
    }

    // start_time may carry non-zero seconds depending on how the slot was
    // created; match at minute granularity like the original comparison did.
    const nextMinute = new Date(desiredDate.getTime() + 60_000);

    const booking = await this.dataSource.transaction(async (manager) => {
      // Lock the target slot row for the duration of the transaction so
      // concurrent reservation attempts for the same slot serialize instead
      // of both passing the availability check.
      const slotToReserve = await manager
        .createQueryBuilder(Slot, 'slot')
        .setLock('pessimistic_write')
        .where('slot.businessId = :businessId', { businessId })
        .andWhere('slot.status = :status', { status: SlotStatus.AVAILABLE })
        .andWhere('slot.start_time >= :desiredDate', { desiredDate })
        .andWhere('slot.start_time < :nextMinute', { nextMinute })
        .getOne();

      if (!slotToReserve) {
        throw new NotFoundException('No available slot for the desired time');
      }

      const newBooking = new Booking();
      newBooking.book_slot = desiredDate;
      newBooking.user = client;
      newBooking.business = business;
      newBooking.slot = slotToReserve;
      await manager.save(newBooking);

      slotToReserve.booking_by = newBooking;
      slotToReserve.status = SlotStatus.UNAVAILABLE;
      await manager.save(slotToReserve);

      return newBooking;
    });

    await this.notificationsService.send(
      booking.user.email,
      `Service reserved in ${booking.slot.start_time} at ${business.address}`,
      `Reservation service from ${business.name}`,
    );
    await this.notificationsService.send(
      business.email,
      `${client.email} reserved slot at ${booking.slot.start_time}`,
      `New Reservation ${booking.slot.start_time}`,
    );
    return plainToClass(Booking, booking, {
      excludeExtraneousValues: true,
    });
  }

  async availableSlots(businessId: string, page: number): Promise<Slot[]> {
    const start = new Date();
    start.setDate(start.getDate() + (page - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return this.slotManagementService.findAvailableSlots(
      businessId,
      start,
      end,
    );
  }

  async findReservedSlotById(id, currentUser: ActiveUserData) {
    const user: Users = await this.usersService.findByEmail(currentUser.email);

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
    const slot: Slot =
      await this.slotManagementService.findSlotByBooking(slotToCancel);

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }
    await this.slotManagementService.releaseSlot(slot);
    await this.bookingRepository.remove(slotToCancel);
    return {
      message: 'Your slot removed successfully',
    };
  }

  async findReservedSlotsByUser(currentUser: ActiveUserData) {
    const user: Users = await this.usersService.findByEmail(currentUser.email);
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
