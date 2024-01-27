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
import { Expose } from 'class-transformer';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Expose()
  @Column()
  book_slot: Date;

  @ManyToOne(() => Business, (business) => business.slots)
  business: Business;

  @ManyToOne(() => Users, (users) => users.booking)
  user: Users;

  @OneToOne(() => Slot, (slot) => slot.booking_by)
  slot: Slot;
}
