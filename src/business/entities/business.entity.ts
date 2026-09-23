import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from '../../users/entities/user.entity';
import { Location } from './location.entity';
import { Booking } from '../../scheduling/entities/booking.entity';

@Entity()
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  description: string;

  @Column('text')
  address: string;

  /** IANA timezone (e.g. `Europe/Berlin`); working hours are local to it. */
  @Column({ default: 'UTC' })
  timezone: string;

  /** ISO 4217 code; service prices are in its minor units. */
  @Column({ type: 'char', length: 3, default: 'USD' })
  currency: string;

  @OneToOne(() => Location, (location: Location) => location.business)
  @JoinColumn()
  coords: Location;

  @Column()
  email: string;

  @Column()
  phone_number: string;

  @OneToOne(() => Users, (user: Users) => user.business)
  owner: Users;

  @OneToMany(() => Users, (user: Users) => user.workplace)
  employees: Users[];

  @OneToMany(() => Booking, (booking: Booking) => booking.business)
  bookings: Booking[];

  @Column({ default: false })
  featured: boolean;
}
