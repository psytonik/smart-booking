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
  readonly setWorkDays: string[];

  @ApiProperty({
    type: Array,
    description:
      'must be array of strings "Sunday", "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday" ',
  })
  @IsArray()
  readonly setHolidays: string[];

  @ApiProperty({
    type: Number,
    description: 'must be number of weeks',
  })
  @IsNumber()
  readonly weeksAhead: number;

  @ApiProperty({
    type: String,
    description: 'format of opening time must be for example 09:00',
  })
  @IsString()
  readonly openingHours: string;

  @ApiProperty({
    type: String,
    description: 'format of closing hour must be for example 22:00',
  })
  @IsString()
  readonly closingHours: string;

  @ApiProperty({
    type: String,
    description: '10 min or 15 min or 60 min or 75 min etc',
  })
  @IsString()
  readonly lunchDuration: string;

  @ApiProperty({
    type: String,
    description: '10 min or 15 min or 60 min or 75 min etc',
  })
  @IsString()
  readonly timePerClient: string;

  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @MinDate(new Date(), { message: 'Start date cannot be in the past.' })
  @Transform(({ value }) => parseISO(value), { toClassOnly: true })
  readonly startDate: Date;
}
