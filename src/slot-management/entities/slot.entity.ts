import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { SlotStatus } from '../enums/slotStatus.enum';
import { Business } from '../../business/entities/business.entity';
import { Booking } from '../../booking/entities/booking.entity';

@Entity()
export class Slot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  start_time: Date;

  @Column({ type: 'timestamp' })
  end_time: Date;

  @Column({ type: 'enum', enum: SlotStatus, default: SlotStatus.AVAILABLE })
  status: SlotStatus;

  @ManyToOne(() => Business, (business) => business.slots)
  business: Business;

  @OneToOne(() => Booking, (booking) => booking.id, { eager: true })
  @JoinColumn()
  booking_by: Booking;
}
