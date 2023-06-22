import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Business } from './business.entity';

@Entity()
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('double precision')
  lat: number;

  @Column('double precision')
  lng: number;

  @OneToOne(() => Business, (business: Business) => business.coords, {
    eager: true,
  })
  businessId: string;
}
