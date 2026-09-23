import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Unique,
  Index,
} from 'typeorm';
import { SlotStatus } from '../enums/slotStatus.enum';
import { Business } from '../../business/entities/business.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { Users } from '../../users/entities/user.entity';

@Entity()
// A staff member can't have two slots starting at the same instant; two
// staff members of the same business can.
@Unique(['staff', 'start_time'])
@Index(['business', 'start_time'])
export class Slot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamptz' })
  start_time: Date;

  @Column({ type: 'timestamptz' })
  end_time: Date;

  @Column({ type: 'enum', enum: SlotStatus, default: SlotStatus.AVAILABLE })
  status: SlotStatus;

  @ManyToOne(() => Business, (business) => business.slots)
  business: Business;

  /** The person the client is booked with: the owner or an employee. */
  @ManyToOne(() => Users, { nullable: false })
  staff: Users;

  @OneToOne(() => Booking, (booking) => booking.slot)
  @JoinColumn()
  booking_by: Booking | null;
}
