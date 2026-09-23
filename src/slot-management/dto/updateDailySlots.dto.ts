import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import {
  CLOCK_TIME_MESSAGE,
  CLOCK_TIME_REGEX,
  DURATION_MESSAGE,
  DURATION_REGEX,
} from '../slot-management.constants';

export class UpdateDailySlotsDto {
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
  })
  @Matches(DURATION_REGEX, { message: DURATION_MESSAGE })
  readonly timePerClient: string;
}
