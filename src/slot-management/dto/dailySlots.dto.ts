import { IsInt, IsOptional, Matches } from 'class-validator';
import {
  CALENDAR_DAY_REGEX,
  CLOCK_TIME_MESSAGE,
  CLOCK_TIME_REGEX,
  DURATION_MESSAGE,
  DURATION_REGEX,
} from '../slot-management.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({
    type: String,
    description: 'Calendar day (yyyy-mm-dd) in the business timezone',
  })
  @Matches(CALENDAR_DAY_REGEX, { message: '$property must be yyyy-mm-dd' })
  readonly startDate: string;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Staff member (owner or employee) the slots belong to. Defaults to the caller; only owners may set someone else.',
  })
  @IsOptional()
  @IsInt()
  readonly staffId?: number;
}
