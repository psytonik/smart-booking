import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Business } from './business.entity';

@Entity()
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  lat: number;

  @Column()
  lng: number;

  @OneToOne(() => Business, (business: Business) => business.coords, {
    eager: true,
  })
  businessId: string;
}
