import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Booking } from './entities/booking.entity.js';
import { BookingStatus } from './enums/booking-status.enum.js';
import { ActiveUserData } from '../iam/interface/active-user-data.interface.js';
import { Users } from '../users/entities/user.entity.js';
import { Business } from '../business/entities/business.entity.js';
import { Service } from '../services/entities/service.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BusinessService } from '../business/business.service.js';
import { UsersService } from '../users/users.service.js';
import { ServicesService } from '../services/services.service.js';
import { StaffContext } from '../business/staff-access.service.js';
import { AvailabilityService, AvailableStart } from './availability.service.js';
import { ReserveDto } from './dto/booking.dto.js';
import {
  addCalendarDays,
  addMinutesTo,
  calendarDayOf,
  dayRange,
  formatInTimeZone,
  parseDateTimeIn,
  todayIn,
} from '../common/time.js';
import { daysBetween } from './schedule.service.js';

/** Postgres error for a violated exclusion constraint. */
const EXCLUSION_VIOLATION = '23P01';
/** First key of the per-staff advisory lock taken while booking. */
const BOOKING_LOCK_NAMESPACE = 7201;

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly businessService: BusinessService,
    private readonly usersService: UsersService,
    private readonly services: ServicesService,
    private readonly availability: AvailabilityService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async availableStarts(
    businessId: string,
    serviceId: string,
    staffId: number | undefined,
    from: string | undefined,
    days: number,
  ): Promise<AvailableStart[]> {
    const business = await this.getBusiness(businessId);
    const { offerings } = await this.services.bookableOfferings(
      businessId,
      serviceId,
      staffId,
    );
    const first = from ?? todayIn(business.timezone);
    return this.availability.compute(
      business,
      offerings,
      daysBetween(first, addCalendarDays(first, days - 1)),
    );
  }

  /**
   * Books a service at an offered start time. The start is re-checked
   * against current availability, and the exclusion constraint on the table
   * settles races between concurrent requests: exactly one wins.
   */
  async reserve(
    dto: ReserveDto,
    businessId: string,
    user: ActiveUserData,
  ): Promise<Booking> {
    const business = await this.getBusiness(businessId);
    const client = await this.usersService.findActiveUser(user.sub);
    if (await this.usersService.findStaffMember(client.id, business.id)) {
      throw new ForbiddenException(
        'You cannot book an appointment in a business you work for',
      );
    }
    const start = parseDateTimeIn(dto.start, business.timezone);
    if (!start) {
      throw new BadRequestException('start must be an ISO-8601 time');
    }
    const { service, offerings } = await this.services.bookableOfferings(
      businessId,
      dto.serviceId,
      dto.staffId,
    );
    const day = calendarDayOf(start, business.timezone);
    const freeStaff = new Set(
      (await this.availability.compute(business, offerings, [day]))
        .filter((slot) => slot.start.getTime() === start.getTime())
        .map((slot) => slot.staffId),
    );
    const candidates = offerings.filter((o) => freeStaff.has(o.staffId));
    if (candidates.length === 0) {
      throw new ConflictException('This time is not available');
    }

    for (const offering of candidates) {
      try {
        const booking = await this.dataSource.transaction(async (manager) => {
          // Serialize bookings per staff member. The exclusion constraint
          // alone is correct, but concurrent overlapping inserts can
          // deadlock each other while it's being checked.
          await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
            BOOKING_LOCK_NAMESPACE,
            offering.staffId,
          ]);
          return manager.save(
            manager.create(Booking, {
              business: { id: business.id } as Business,
              user: { id: client.id } as Users,
              staff: { id: offering.staffId } as Users,
              service: { id: service.id } as Service,
              start_time: start,
              end_time: addMinutesTo(start, offering.durationMinutes),
              blocked_until: addMinutesTo(
                start,
                offering.durationMinutes + offering.bufferMinutes,
              ),
              duration_minutes: offering.durationMinutes,
              price_minor: offering.priceMinor,
              currency: business.currency,
            }),
          );
        });
        await this.notifyBooked(booking, business, service, client);
        return this.findForClient(booking.id, client.id);
      } catch (e) {
        if (
          e instanceof QueryFailedError &&
          (e.driverError as { code?: string })?.code === EXCLUSION_VIOLATION
        ) {
          continue; // taken a moment ago; try the next free staff member
        }
        throw e;
      }
    }
    throw new ConflictException('This time was just taken');
  }

  async findReservation(id: string, currentUser: ActiveUserData) {
    const user = await this.usersService.findActiveUser(currentUser.sub);
    return this.findForClient(id, user.id);
  }

  /** Cancels a client's upcoming booking; the record stays as history. */
  async cancelReservation(
    id: string,
    currentUser: ActiveUserData,
  ): Promise<Booking> {
    const user = await this.usersService.findActiveUser(currentUser.sub);
    const booking = await this.findForClient(id, user.id);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('This booking is already cancelled');
    }
    if (booking.start_time <= new Date()) {
      throw new ConflictException('A past booking cannot be cancelled');
    }
    booking.status = BookingStatus.CANCELLED_BY_CLIENT;
    await this.bookingRepository.update(booking.id, {
      status: BookingStatus.CANCELLED_BY_CLIENT,
    });
    return booking;
  }

  async findReservationsByUser(
    currentUser: ActiveUserData,
    page: { limit: number; offset: number },
  ): Promise<Booking[]> {
    const user = await this.usersService.findActiveUser(currentUser.sub);
    return this.withDetails()
      .where('client.id = :userId', { userId: user.id })
      .orderBy('booking.start_time', 'DESC')
      .take(page.limit)
      .skip(page.offset)
      .getMany();
  }

  /** A business's bookings over a date range, for its staff. */
  async agenda(
    ctx: StaffContext,
    from: string,
    to: string,
    staffId: number | undefined,
    page: { limit: number; offset: number },
  ): Promise<{ total: number; bookings: Booking[] }> {
    const days = daysBetween(from, to);
    const query = this.withDetails()
      .addSelect('client.email')
      .where('business.id = :businessId', { businessId: ctx.business.id })
      .andWhere('booking.start_time >= :start', {
        start: dayRange(days[0], ctx.business.timezone).start,
      })
      .andWhere('booking.start_time < :end', {
        end: dayRange(days[days.length - 1], ctx.business.timezone).end,
      })
      .orderBy('booking.start_time', 'ASC')
      .take(page.limit)
      .skip(page.offset);
    if (staffId) {
      query.andWhere('staff.id = :staffId', { staffId });
    }
    const [bookings, total] = await query.getManyAndCount();
    return { total, bookings };
  }

  private async findForClient(id: string, userId: number): Promise<Booking> {
    const booking = await this.withDetails()
      .where('booking.id = :id', { id })
      .getOne();
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.user.id !== userId) {
      throw new ForbiddenException('This is not your booking');
    }
    return booking;
  }

  private withDetails() {
    return this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.business', 'business')
      .leftJoinAndSelect('booking.service', 'service')
      .leftJoin('booking.staff', 'staff')
      .addSelect('staff.id')
      .leftJoin('booking.user', 'client')
      .addSelect('client.id');
  }

  private async getBusiness(businessId: string): Promise<Business> {
    const business = await this.businessService.findById(businessId);
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  // The booking is committed; queueing emails can only fail if Redis is
  // down, and that must not turn a booking into an error.
  private async notifyBooked(
    booking: Booking,
    business: Business,
    service: Service,
    client: Users,
  ): Promise<void> {
    const when = formatInTimeZone(booking.start_time, business.timezone);
    await Promise.all([
      this.notificationsService.send(
        client.email,
        `${service.name} booked for ${when} at ${business.name}, ${business.address}`,
        `Booking confirmed: ${business.name}`,
      ),
      this.notificationsService.send(
        business.email,
        `${client.email} booked ${service.name} for ${when}`,
        `New booking ${when}`,
      ),
    ]).catch((err) =>
      this.logger.error(
        `Failed to queue booking notifications for booking ${booking.id}`,
        err,
      ),
    );
  }
}
