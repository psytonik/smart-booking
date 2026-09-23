import { IsDate, MinDate, Matches } from 'class-validator';
import {
  CLOCK_TIME_MESSAGE,
  CLOCK_TIME_REGEX,
  DURATION_MESSAGE,
  DURATION_REGEX,
} from '../slot-management.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { parseISO } from 'date-fns';

export class DailySlotsDto {
  @ApiProperty({
    type: String,
    description: 'format of opening time must be for example 09:00',
  })
  @Matches(CLOCK_TIME_REGEX, { message: CLOCK_TIME_MESSAGE })
  readonly openingHours: string;

  @ApiProperty({
    type: String,
    description: 'format of closing time must be for example 15:00',
  })
  @Matches(CLOCK_TIME_REGEX, { message: CLOCK_TIME_MESSAGE })
  readonly closingHours: string;

  @ApiProperty({
    type: String,
    description: 'minutes, e.g. "15 min"',
  })
  @Matches(DURATION_REGEX, { message: DURATION_MESSAGE })
  readonly lunchDuration: string;

  @ApiProperty({
    type: String,
    description: 'minutes, e.g. "15 min"',
    required: true,
  })
  @Matches(DURATION_REGEX, { message: DURATION_MESSAGE })
  readonly timePerClient: string;

  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @MinDate(new Date(), { message: 'Start date cannot be in the past.' })
  @Transform(({ value }) => parseISO(value), { toClassOnly: true })
  readonly startDate: Date;
}
