import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../business/entities/business.entity';
import { Slot } from '../../slot-management/entities/slot.entity';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column()
  bookSlot: Date;

  @ManyToOne(() => Business, (business) => business.id)
  @JoinColumn()
  business: Business;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn()
  user: User;

  @OneToOne(() => Slot, (slot) => slot.id)
  @JoinColumn()
  slot: Slot;
}
