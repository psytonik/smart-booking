import {
  IsArray,
  IsDate,
  IsInt,
  IsIn,
  ArrayNotEmpty,
  Max,
  Min,
  IsOptional,
  Matches,
} from 'class-validator';
import {
  CLOCK_TIME_MESSAGE,
  CLOCK_TIME_REGEX,
  DURATION_MESSAGE,
  DURATION_REGEX,
  MAX_WEEKS_AHEAD,
  WEEK_DAYS,
} from '../slot-management.constants';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotInPast } from '../../common/validators/is-not-in-past.validator';
import { parseISO } from 'date-fns';

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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
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

  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @IsNotInPast()
  @Transform(({ value }) => parseISO(value), { toClassOnly: true })
  readonly startDate: Date;
}
