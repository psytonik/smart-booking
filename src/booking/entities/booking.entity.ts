import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../business/entities/business.entity';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column()
  bookSlot: Date;

  @ManyToOne(() => Business, (business) => business.id)
  @JoinColumn()
  business: Business;

  @ManyToOne(() => User, (user) => user.id, { eager: true })
  @JoinColumn()
  user: User;
}
