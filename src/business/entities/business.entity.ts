import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Slot } from '../../slot-management/entities/slot.entity';
import { Weekly } from '../../slot-management/entities/weekly.entity';

@Entity()
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column('text')
  address: string;

  @Column()
  email: string;

  @Column()
  phoneNumber: string;

  @OneToOne(() => User, (user) => user.business)
  owner: User;

  @OneToMany(() => User, (user) => user.workplace)
  employees: User[];

  @OneToMany(() => Slot, (dailySlots) => dailySlots.business, { eager: true })
  slots: Slot[];

  @OneToMany(() => Weekly, (workDays) => workDays.business)
  @JoinColumn()
  businessWorkDays: Weekly[];
}
