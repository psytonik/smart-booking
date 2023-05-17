import { Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class SlotManagement {
  @PrimaryGeneratedColumn()
  id: number;
}
