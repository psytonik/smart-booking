import {
  Column,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../business/entities/business.entity';
import { Slot } from '../../slot-management/entities/slot.entity';
import { Expose } from 'class-transformer';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Expose()
  @Column()
  bookSlot: Date;

  @ManyToOne(() => Business, (business) => business.slots)
  business: Business;

  @ManyToOne(() => User, (user) => user.booking)
  user: User;

  @OneToOne(() => Slot, (slot) => slot.bookingBy)
  slot: Slot;
}
