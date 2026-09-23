import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Role } from '../enums/role.enum.js';
import { Business } from '../../business/entities/business.entity.js';
import { Booking } from '../../scheduling/entities/booking.entity.js';

@Entity()
export class Users {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.Client })
  role: Role;

  @OneToOne(() => Business, (business) => business.owner)
  @JoinColumn()
  business: Relation<Business>;

  @ManyToOne(() => Business, (business) => business.employees)
  workplace: Relation<Business>;

  @OneToMany(() => Booking, (bookings) => bookings.user)
  booking: Relation<Booking>[];

  @Column({ nullable: true })
  information: string;
}
