import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from '../../users/entities/user.entity';
import { Slot } from '../../slot-management/entities/slot.entity';
import { Location } from './location.entity';

@Entity()
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column()
  description: string;

  @Column('text')
  address: string;

  @OneToOne(() => Location, (location: Location) => location.business_id)
  @JoinColumn()
  coords: Location;

  @Column()
  email: string;

  @Column()
  phone_number: string;

  @OneToOne(() => Users, (user: Users) => user.business, { eager: true })
  owner: Users;

  @OneToMany(() => Users, (user: Users) => user.workplace, { eager: true })
  employees: Users[];

  @OneToMany(() => Slot, (dailySlots: Slot) => dailySlots.business, {
    eager: true,
  })
  slots: Slot[];

  @Column({ default: false })
  featured: boolean;
}
