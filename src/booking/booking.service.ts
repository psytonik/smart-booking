import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ReserveSlotDto } from './dto/reserveSlot.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Slot } from '../slot-management/entities/slot.entity';
import { SlotStatus } from '../slot-management/enums/slotStatus.enum';
import { Booking } from './entities/booking.entity';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { Users } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessService } from '../business/business.service';
import { UsersService } from '../users/users.service';
import { SlotQueryService } from '../slot-management/slot-query.service';
import { SlotCommandService } from '../slot-management/slot-command.service';
import {
  formatInTimeZone,
  parseDateTimeIn,
} from '../slot-management/slot-schedule';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly businessService: BusinessService,
    private readonly usersService: UsersService,
    private readonly slotQueries: SlotQueryService,
    private readonly slotCommands: SlotCommandService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}
  async reserveSlot(
    reserveSlotDto: ReserveSlotDto,
    businessId: string,
    user: ActiveUserData,
  ): Promise<Booking> {
    const business = await this.businessService.findById(businessId);
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    const client: Users = await this.usersService.findActiveUser(user.sub);
    if (await this.usersService.findStaffMember(client.id, business.id)) {
      throw new ForbiddenException(
        'You cannot book a slot in a business you work for',
      );
    }
    // Without an explicit offset the time is local to the business.
    const desiredDate = parseDateTimeIn(
      reserveSlotDto.reserveSlot,
      business.timezone,
    );
    if (!desiredDate) {
      throw new BadRequestException('reserveSlot must be an ISO-8601 time');
    }
    desiredDate.setUTCSeconds(0, 0);
    if (desiredDate < new Date()) {
      throw new BadRequestException('Cannot book a slot in the past');
    }
    const nextMinute = new Date(desiredDate.getTime() + 60_000);

    const booking = await this.dataSource.transaction(async (manager) => {
      // Lock the candidate slot rows for the duration of the transaction so
      // concurrent reservations serialize instead of both passing the
      // availability check. Without a staffId, any free staff member at that
      // time will do (lowest id first).
      const query = manager
        .createQueryBuilder(Slot, 'slot')
        .setLock('pessimistic_write')
        .where('slot.businessId = :businessId', { businessId })
        .andWhere('slot.status = :status', { status: SlotStatus.AVAILABLE })
        .andWhere('slot.start_time >= :desiredDate', { desiredDate })
        .andWhere('slot.start_time < :nextMinute', { nextMinute })
        .orderBy('slot.staffId', 'ASC');
      if (reserveSlotDto.staffId) {
        query.andWhere('slot.staffId = :staffId', {
          staffId: reserveSlotDto.staffId,
        });
      }
      const slotToReserve = await query.getOne();

      if (!slotToReserve) {
        throw new NotFoundException('No available slot for the desired time');
      }

      const newBooking = new Booking();
      newBooking.book_slot = slotToReserve.start_time;
      newBooking.user = client;
      newBooking.business = business;
      newBooking.slot = slotToReserve;
      await manager.save(newBooking);

      slotToReserve.booking_by = newBooking;
      slotToReserve.status = SlotStatus.BOOKED;
      await manager.save(slotToReserve);

      return newBooking;
    });

    // The reservation is committed; queueing the emails can only fail if
    // Redis is down, and that must not turn a booking into a 500.
    const when = formatInTimeZone(booking.slot.start_time, business.timezone);
    await Promise.all([
      this.notificationsService.send(
        booking.user.email,
        `Service reserved for ${when} at ${business.address}`,
        `Reservation service from ${business.name}`,
      ),
      this.notificationsService.send(
        business.email,
        `${client.email} reserved slot at ${when}`,
        `New Reservation ${when}`,
      ),
    ]).catch((err) =>
      this.logger.error(
        `Failed to queue booking notifications for booking ${booking.id}`,
        err,
      ),
    );
    return booking;
  }

  /** Free slots in 7-day pages starting now; page 1 is the next 7 days. */
  async availableSlots(
    businessId: string,
    page: number,
    staffId?: number,
  ): Promise<Slot[]> {
    const week = 7 * 24 * 60 * 60 * 1000;
    const start = new Date(Date.now() + (page - 1) * week);
    const end = new Date(start.getTime() + week);
    return this.slotQueries.findAvailableSlots(businessId, start, end, staffId);
  }

  async findReservedSlotById(id: string, currentUser: ActiveUserData) {
    const user: Users = await this.usersService.findActiveUser(currentUser.sub);
    const reservedSlotByClient = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.business', 'business')
      .leftJoinAndSelect('booking.slot', 'slot')
      .leftJoin('slot.staff', 'staff')
      .addSelect('staff.id')
      .where('booking.id = :bookingId', { bookingId: id })
      .getOne();

    if (!reservedSlotByClient) {
      throw new NotFoundException('Slot not found');
    }

    if (reservedSlotByClient.user.id !== user.id) {
      throw new ForbiddenException('This is not your reservation');
    }

    return reservedSlotByClient;
  }

  async cancelReservation(id: string, currentUser: ActiveUserData) {
    if (!id) {
      throw new NotFoundException('Slot not found');
    }
    const slotToCancel: Booking = await this.findReservedSlotById(
      id,
      currentUser,
    );
    const slot = await this.slotQueries.findSlotByBooking(slotToCancel);

    if (!slot) {
      throw new NotFoundException('Slot not found');
    }
    await this.dataSource.transaction(async (manager) => {
      await this.slotCommands.releaseSlot(slot, manager);
      await manager.remove(slotToCancel);
    });
    return {
      message: 'Your slot removed successfully',
    };
  }

  async findReservedSlotsByUser(
    currentUser: ActiveUserData,
    page: { limit: number; offset: number },
  ) {
    const user: Users = await this.usersService.findActiveUser(currentUser.sub);
    return await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.business', 'business')
      .leftJoinAndSelect('booking.slot', 'slot')
      .leftJoin('slot.staff', 'staff')
      .addSelect('staff.id')
      .where('user.id = :userId', { userId: user.id })
      .orderBy('booking.book_slot', 'ASC')
      .take(page.limit)
      .skip(page.offset)
      .getMany();
  }
}
