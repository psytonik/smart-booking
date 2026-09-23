import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { CALENDAR_DAY_REGEX } from '../slot-management.constants';

export class ReportDatesDto {
  @ApiProperty({
    type: String,
    description:
      'First calendar day (yyyy-mm-dd, business timezone), inclusive',
  })
  @Matches(CALENDAR_DAY_REGEX, { message: '$property must be yyyy-mm-dd' })
  readonly startDate: string;

  @ApiProperty({
    type: String,
    description: 'Last calendar day (yyyy-mm-dd, business timezone), inclusive',
  })
  @Matches(CALENDAR_DAY_REGEX, { message: '$property must be yyyy-mm-dd' })
  readonly endDate: string;
}
