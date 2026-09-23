import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity.js';
import { StaffService } from './staff-service.entity.js';

/** Something a business offers, e.g. "Haircut, 30 min, 80 ILS". */
@Entity()
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, { nullable: false, onDelete: 'CASCADE' })
  business: Relation<Business>;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  duration_minutes: number;

  /** Cleanup/rest time after each appointment before the next can start. */
  @Column({ type: 'int', default: 0 })
  buffer_minutes: number;

  /** In minor units (cents) of the business currency. Shown, never charged. */
  @Column({ type: 'int' })
  price_minor: number;

  /** Inactive services can't be booked but stay for booking history. */
  @Column({ default: true })
  active: boolean;

  @OneToMany(() => StaffService, (offering) => offering.service)
  offerings: Relation<StaffService>[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
