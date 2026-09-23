import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CALENDAR_DAY_MESSAGE, CALENDAR_DAY_REGEX } from '../../common/time.js';

export const MAX_AVAILABILITY_DAYS = 14;

export class AvailabilityQueryDto {
  @ApiProperty()
  @IsUUID()
  readonly serviceId: string;

  @ApiPropertyOptional({ description: 'Only this staff member' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly staffId?: number;

  @ApiPropertyOptional({
    example: '2030-01-07',
    description: 'First day (business timezone); defaults to today',
  })
  @IsOptional()
  @Matches(CALENDAR_DAY_REGEX, { message: CALENDAR_DAY_MESSAGE })
  readonly from?: string;

  @ApiPropertyOptional({ default: 1, maximum: MAX_AVAILABILITY_DAYS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AVAILABILITY_DAYS)
  readonly days: number = 1;
}

export class ReserveDto {
  @ApiProperty()
  @IsUUID()
  readonly serviceId: string;

  @ApiProperty({
    example: '2030-01-07T10:15',
    description:
      'Start time, ISO-8601. Without an offset it is local business time. Must be one of the available starts.',
  })
  @IsISO8601({ strict: true })
  readonly start: string;

  @ApiPropertyOptional({
    description: 'Book with this staff member; omit to take whoever is free',
  })
  @IsOptional()
  @IsInt()
  readonly staffId?: number;
}
