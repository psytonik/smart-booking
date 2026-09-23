import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Users } from '../../users/entities/user.entity.js';

/** Time a staff member takes out of their day: a break, an errand. */
@Entity()
@Index(['staff', 'start_time'])
export class TimeBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Users, { nullable: false, onDelete: 'CASCADE' })
  staff: Relation<Users>;

  @Column({ type: 'timestamptz' })
  start_time: Date;

  @Column({ type: 'timestamptz' })
  end_time: Date;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;
}
