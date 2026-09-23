import {
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from '../../users/entities/user.entity';
import { Business } from '../../business/entities/business.entity';
import { Service } from '../../services/entities/service.entity';
import { BookingStatus } from '../enums/booking-status.enum';

/**
 * A client's appointment for a service with a staff member.
 *
 * Postgres itself rejects two confirmed bookings of one staff member whose
 * [start, blocked_until) ranges overlap, whatever their lengths, so
 * concurrent requests can never double-book.
 */
@Entity()
@Exclusion(
  'booking_no_overlap',
  `USING gist ("staffId" WITH =, tstzrange("start_time", "blocked_until", '[)') WITH &&) WHERE ("status" = 'confirmed')`,
)
@Index(['staff', 'start_time'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (business) => business.bookings, {
    nullable: false,
  })
  business: Business;

  @ManyToOne(() => Users, (users) => users.booking, { nullable: false })
  user: Users;

  @ManyToOne(() => Users, { nullable: false })
  staff: Users;

  @ManyToOne(() => Service, { nullable: false })
  service: Service;

  @Column({ type: 'timestamptz' })
  start_time: Date;

  /** start_time + duration. */
  @Column({ type: 'timestamptz' })
  end_time: Date;

  /** end_time + buffer: when the staff member is free again. */
  @Column({ type: 'timestamptz' })
  blocked_until: Date;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  // Snapshot of what was booked, so later catalog edits don't rewrite
  // history.
  @Column({ type: 'int' })
  duration_minutes: number;

  @Column({ type: 'int' })
  price_minor: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
