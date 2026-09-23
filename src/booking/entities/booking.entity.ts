import {
  Column,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from '../../users/entities/user.entity';
import { Business } from '../../business/entities/business.entity';
import { Slot } from '../../slot-management/entities/slot.entity';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // book_slot and business duplicate the slot's start_time and business on
  // purpose: they keep a booking meaningful if its slot is later changed or
  // removed (booking history, roadmap F2).
  @Column({ type: 'timestamptz' })
  book_slot: Date;

  @ManyToOne(() => Business, (business) => business.bookings)
  business: Business;

  @ManyToOne(() => Users, (users) => users.booking)
  user: Users;

  @OneToOne(() => Slot, (slot) => slot.booking_by)
  slot: Slot;
}
