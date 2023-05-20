import { IsArray } from 'class-validator';

export class WeeklySlotsDto {
  @IsArray()
  setWorkDays: string[];

  @IsArray()
  setHolidays: string[];
}
