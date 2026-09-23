import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from '../../users/entities/user.entity';

/**
 * Replaces the weekly template on one date. A row with null minutes marks
 * the date as a day off; otherwise each row is one working interval.
 */
@Entity()
@Index(['staff', 'date'])
export class ScheduleOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, { nullable: false, onDelete: 'CASCADE' })
  staff: Users;

  /** Calendar day in the business timezone. */
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'smallint', nullable: true })
  start_minute: number | null;

  @Column({ type: 'smallint', nullable: true })
  end_minute: number | null;
}
