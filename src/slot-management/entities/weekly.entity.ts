import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Business } from '../../business/entities/business.entity';

@Entity()
export class Weekly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ],
  })
  dayOfWeek: string;

  @Column({ type: 'enum', enum: ['Work', 'Holiday'], default: 'Work' })
  status: string;

  @ManyToOne(() => Business, (business) => business.businessWorkDays)
  business: Business;
}
