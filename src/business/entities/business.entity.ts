import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Slot } from '../../slot-management/entities/slot.entity';

@Entity()
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  slug: string;

  @Column()
  description: string;

  @Column('text')
  address: string;

  @Column()
  email: string;

  @Column()
  phoneNumber: string;

  @OneToOne(() => User, (user) => user.business, { eager: true })
  owner: User;

  @OneToMany(() => User, (user) => user.workplace, { eager: true })
  employees: User[];

  @OneToMany(() => Slot, (dailySlots) => dailySlots.business, { eager: true })
  slots: Slot[];
}
