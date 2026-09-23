import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Slot } from './entities/slot.entity';
import { SlotStatus } from './enums/slotStatus.enum';
import { Booking } from '../booking/entities/booking.entity';
import { SlotContext } from './slot-access.service';

/** Read side of slot management. */
@Injectable()
export class SlotQueryService {
  constructor(
    @InjectRepository(Slot)
    private readonly slotRepository: Repository<Slot>,
  ) {}

  /** Public availability: free slots of a business in `[start, end)`. */
  async findAvailableSlots(
    businessId: string,
    start: Date,
    end: Date,
    staffId?: number,
  ): Promise<Slot[]> {
    const query = this.slotRepository
      .createQueryBuilder('slot')
      .leftJoin('slot.staff', 'staff')
      .addSelect('staff.id')
      .where('slot.businessId = :businessId', { businessId })
      .andWhere('slot.start_time >= :start', { start })
      .andWhere('slot.start_time < :end', { end })
      .andWhere('slot.status = :status', { status: SlotStatus.AVAILABLE })
      .orderBy('slot.start_time', 'ASC')
      .addOrderBy('staff.id', 'ASC');
    if (staffId) {
      query.andWhere('staff.id = :staffId', { staffId });
    }
    return query.getMany();
  }

  async findSlotByBooking(booking: Booking): Promise<Slot | null> {
    return this.slotRepository.findOneBy({ booking_by: { id: booking.id } });
  }

  /** Every slot the caller may see, with who booked it. */
  async listSlots(ctx: SlotContext, staffId?: number): Promise<Slot[]> {
    return this.managedSlots(ctx, staffId).getMany();
  }

  async listSlotsInRange(
    ctx: SlotContext,
    range: { start: Date; end: Date },
    staffId?: number,
  ): Promise<Slot[]> {
    return this.managedSlots(ctx, staffId)
      .andWhere('slot.start_time >= :start', { start: range.start })
      .andWhere('slot.start_time < :end', { end: range.end })
      .getMany();
  }

  async bookedSlotsInRange(
    ctx: SlotContext,
    range: { start: Date; end: Date },
    staffId?: number,
  ): Promise<Slot[]> {
    return this.managedSlots(ctx, staffId)
      .andWhere('slot.status = :status', { status: SlotStatus.BOOKED })
      .andWhere('slot.start_time >= :start', { start: range.start })
      .andWhere('slot.start_time < :end', { end: range.end })
      .getMany();
  }

  private managedSlots(
    ctx: SlotContext,
    staffId?: number,
  ): SelectQueryBuilder<Slot> {
    const query = this.slotRepository
      .createQueryBuilder('slot')
      .leftJoin('slot.staff', 'staff')
      .addSelect(['staff.id', 'staff.email'])
      .leftJoinAndSelect('slot.booking_by', 'booking')
      .leftJoin('booking.user', 'client')
      .addSelect(['client.id', 'client.email'])
      .where('slot.businessId = :businessId', { businessId: ctx.business.id })
      .orderBy('slot.start_time', 'ASC')
      .addOrderBy('staff.id', 'ASC');
    if (staffId) {
      query.andWhere('staff.id = :staffId', { staffId });
    }
    return query;
  }
}
