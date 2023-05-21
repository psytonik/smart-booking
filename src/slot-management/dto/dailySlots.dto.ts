import { IsDate, IsString, MinDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { parseISO } from 'date-fns';

export class DailySlotsDto {
  @ApiProperty({
    type: String,
    description: 'format of opening time must be for example 09:00',
  })
  @IsString()
  openingHours: string;

  @ApiProperty({
    type: String,
    description: 'format of closing time must be for example 15:00',
  })
  @IsString()
  closingHours: string;

  @ApiProperty({
    type: String,
    description: 'time can be between 1 min to 1440 min',
  })
  @IsString()
  lunchDuration: string;

  @ApiProperty({
    type: String,
    description: 'time can be between 1 min to 1440 min',
  })
  @IsString()
  timePerClient: string;

  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @MinDate(new Date(), { message: 'Start date cannot be in the past.' })
  @Transform(({ value }) => parseISO(value), { toClassOnly: true })
  startDate: Date;
}
