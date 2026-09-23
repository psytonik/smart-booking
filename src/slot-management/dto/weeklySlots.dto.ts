import {
  IsArray,
  IsInt,
  IsIn,
  ArrayNotEmpty,
  Max,
  Min,
  IsOptional,
  Matches,
} from 'class-validator';
import {
  CALENDAR_DAY_REGEX,
  CLOCK_TIME_MESSAGE,
  CLOCK_TIME_REGEX,
  DURATION_MESSAGE,
  DURATION_REGEX,
  MAX_WEEKS_AHEAD,
  WEEK_DAYS,
} from '../slot-management.constants';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class WeeklySlotsDto {
  @ApiProperty({
    type: Array,
    description:
      'must be array of strings "Sunday", "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday" ',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEEK_DAYS, { each: true })
  readonly setWorkDays: string[];

  @ApiPropertyOptional({
    type: Array,
    description:
      'dates to skip, in ISO format (yyyy-mm-dd), e.g. public holidays inside the generated range',
  })
  @IsOptional()
  @IsArray()
  @Matches(CALENDAR_DAY_REGEX, { each: true })
  readonly setHolidays?: string[];

  @ApiProperty({
    type: Number,
    description: `number of weeks to generate, 1 to ${MAX_WEEKS_AHEAD}`,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_WEEKS_AHEAD)
  readonly weeksAhead: number;

  @ApiProperty({
    type: String,
    description: 'format of opening time must be for example 09:00',
  })
  @Matches(CLOCK_TIME_REGEX, { message: CLOCK_TIME_MESSAGE })
  readonly openingHours: string;

  @ApiProperty({
    type: String,
    description: 'format of closing hour must be for example 22:00',
  })
  @Matches(CLOCK_TIME_REGEX, { message: CLOCK_TIME_MESSAGE })
  readonly closingHours: string;

  @ApiProperty({
    type: String,
    description: '10 min or 15 min or 60 min or 75 min etc',
  })
  @Matches(DURATION_REGEX, { message: DURATION_MESSAGE })
  readonly lunchDuration: string;

  @ApiProperty({
    type: String,
    description: '10 min or 15 min or 60 min or 75 min etc',
  })
  @Matches(DURATION_REGEX, { message: DURATION_MESSAGE })
  readonly timePerClient: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Calendar day (yyyy-mm-dd) in the business timezone; defaults to today',
  })
  @IsOptional()
  @Matches(CALENDAR_DAY_REGEX, { message: '$property must be yyyy-mm-dd' })
  readonly startDate?: string;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Staff member (owner or employee) the slots belong to. Defaults to the caller; only owners may set someone else.',
  })
  @IsOptional()
  @IsInt()
  readonly staffId?: number;
}
