import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../enums/role.enum';
import { Business } from '../../business/entities/business.entity';
import { Booking } from '../../booking/entities/booking.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ enum: Role, default: Role.Client })
  role: Role;

  @OneToOne(() => Business, (business) => business.owner)
  @JoinColumn()
  business: Business;

  @ManyToOne(() => Business, (business) => business.employees)
  workplace: Business;

  @OneToMany(() => Booking, (bookings) => bookings.id)
  booking: Booking[];
}
