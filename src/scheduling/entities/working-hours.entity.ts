import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Users } from '../../users/entities/user.entity.js';

/**
 * One interval of a staff member's weekly template, in local time of the
 * business. Several rows per weekday allow split shifts.
 */
@Entity()
@Index(['staff', 'weekday'])
export class WorkingHours {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, { nullable: false, onDelete: 'CASCADE' })
  staff: Relation<Users>;

  /** 0 = Sunday … 6 = Saturday. */
  @Column({ type: 'smallint' })
  weekday: number;

  @Column({ type: 'smallint' })
  start_minute: number;

  @Column({ type: 'smallint' })
  end_minute: number;
}
