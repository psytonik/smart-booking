import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CALENDAR_DAY_MESSAGE,
  CALENDAR_DAY_REGEX,
  CLOCK_TIME_MESSAGE,
  CLOCK_TIME_REGEX,
  WEEK_DAYS,
} from '../../common/time.js';

export class IntervalDto {
  @ApiProperty({ example: '09:00' })
  @Matches(CLOCK_TIME_REGEX, { message: CLOCK_TIME_MESSAGE })
  readonly start: string;

  @ApiProperty({ example: '13:00' })
  @Matches(CLOCK_TIME_REGEX, { message: CLOCK_TIME_MESSAGE })
  readonly end: string;
}

export class WorkingDayDto {
  @ApiProperty({ enum: WEEK_DAYS, example: 'Monday' })
  @IsIn(WEEK_DAYS)
  readonly weekday: (typeof WEEK_DAYS)[number];

  @ApiProperty({
    type: IntervalDto,
    isArray: true,
    description: 'Several intervals = split shift',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntervalDto)
  readonly intervals: IntervalDto[];
}

/** Optional `staffId`: owners may act for any staff member, default self. */
export class StaffTargetDto {
  @ApiPropertyOptional({
    type: Number,
    description:
      'Staff member to act for. Defaults to the caller; only owners may set someone else.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly staffId?: number;
}

export class SetWorkingHoursDto extends StaffTargetDto {
  @ApiProperty({
    type: WorkingDayDto,
    isArray: true,
    description: 'Replaces the weekly template; days left out are days off',
  })
  @IsArray()
  @ArrayUnique((d: WorkingDayDto) => d.weekday)
  @ValidateNested({ each: true })
  @Type(() => WorkingDayDto)
  readonly days: WorkingDayDto[];
}

export class SetOverrideDto extends StaffTargetDto {
  @ApiProperty({
    type: IntervalDto,
    isArray: true,
    description: 'Hours for this date only; an empty list makes it a day off',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntervalDto)
  readonly intervals: IntervalDto[];
}

export class CreateBlockDto extends StaffTargetDto {
  @ApiProperty({
    example: '2030-01-07T13:00',
    description: 'ISO-8601; without an offset it is business-local time',
  })
  @IsISO8601({ strict: true })
  readonly start: string;

  @ApiProperty({ example: '2030-01-07T14:00' })
  @IsISO8601({ strict: true })
  readonly end: string;

  @ApiPropertyOptional({ example: 'Lunch' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly reason?: string;
}

export class DateRangeQueryDto extends StaffTargetDto {
  @ApiProperty({ example: '2030-01-07', description: 'First day, inclusive' })
  @Matches(CALENDAR_DAY_REGEX, { message: CALENDAR_DAY_MESSAGE })
  readonly from: string;

  @ApiProperty({ example: '2030-01-13', description: 'Last day, inclusive' })
  @Matches(CALENDAR_DAY_REGEX, { message: CALENDAR_DAY_MESSAGE })
  readonly to: string;
}
