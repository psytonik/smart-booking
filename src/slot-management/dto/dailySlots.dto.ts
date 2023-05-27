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
  readonly openingHours: string;

  @ApiProperty({
    type: String,
    description: 'format of closing time must be for example 15:00',
  })
  @IsString()
  readonly closingHours: string;

  @ApiProperty({
    type: String,
    description: 'time can be between 1 min to 1440 min',
  })
  @IsString()
  readonly lunchDuration: string;

  @ApiProperty({
    type: String,
    description: 'time can be between 1 min to 1440 min',
    required: true,
  })
  @IsString()
  readonly timePerClient: string;

  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @MinDate(new Date(), { message: 'Start date cannot be in the past.' })
  @Transform(({ value }) => parseISO(value), { toClassOnly: true })
  readonly startDate: Date;
}
