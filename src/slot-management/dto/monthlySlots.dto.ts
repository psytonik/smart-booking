import { IsArray } from 'class-validator';

export class MonthlySlotsDto {
  @IsArray()
  setWeeksPerMonth: [];
}
