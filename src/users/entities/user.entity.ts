import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../enums/role.enum';
import { Business } from '../../business/entities/business.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ enum: Role, default: Role.Client })
  role: Role;

  @OneToOne(() => Business, (business) => business.owner, { eager: true })
  @JoinColumn()
  business: Business;

  @ManyToOne(() => Business, (business) => business.employees)
  workplace: Business;
}
