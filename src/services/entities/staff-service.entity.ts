import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Users } from '../../users/entities/user.entity.js';
import { Service } from './service.entity.js';

/**
 * A staff member offering a service, optionally with their own duration,
 * buffer or price (null = the service's value).
 */
@Entity()
@Unique(['staff', 'service'])
export class StaffService {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, { nullable: false, onDelete: 'CASCADE' })
  staff: Relation<Users>;

  @ManyToOne(() => Service, (service) => service.offerings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  service: Relation<Service>;

  @Column({ type: 'int', nullable: true })
  duration_minutes: number | null;

  @Column({ type: 'int', nullable: true })
  buffer_minutes: number | null;

  @Column({ type: 'int', nullable: true })
  price_minor: number | null;
}
