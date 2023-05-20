import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { SlotStatus } from '../enums/slotStatus.enum';
import { Business } from '../../business/entities/business.entity';

@Entity()
export class Slot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({ type: 'enum', enum: SlotStatus, default: SlotStatus.AVAILABLE })
  status: SlotStatus;

  @ManyToOne(() => Business, (business) => business.slots)
  business: Business;
}
