import { IsArray, IsDate, IsNumber, IsString, MinDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { parseISO } from 'date-fns';

export class WeeklySlotsDto {
  @ApiProperty({
    type: Array,
    description:
      'must be array of strings "Sunday", "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday" ',
  })
  @IsArray()
  setWorkDays: string[];

  @ApiProperty({
    type: Array,
    description:
      'must be array of strings "Sunday", "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday" ',
  })
  @IsArray()
  setHolidays: string[];

  @ApiProperty({
    type: Number,
    description: 'must be number of weeks',
  })
  @IsNumber()
  weeksAhead: number;

  @ApiProperty({
    type: String,
    description: 'format of opening time must be for example 09:00',
  })
  @IsString()
  openingHours: string;

  @ApiProperty({
    type: String,
    description: 'format of closing hour must be for example 22:00',
  })
  @IsString()
  closingHours: string;

  @ApiProperty({
    type: String,
    description: '10 min or 15 min or 60 min or 75 min etc',
  })
  @IsString()
  lunchDuration: string;

  @ApiProperty({
    type: String,
    description: '10 min or 15 min or 60 min or 75 min etc',
  })
  @IsString()
  timePerClient: string;

  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @MinDate(new Date(), { message: 'Start date cannot be in the past.' })
  @Transform(({ value }) => parseISO(value), { toClassOnly: true })
  startDate: Date;
}
