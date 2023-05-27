import { ApiProperty } from '@nestjs/swagger';
import { IsDate } from 'class-validator';
import { Transform } from 'class-transformer';
import { parseISO } from 'date-fns';

export class ReportDatesDto {
  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @Transform(({ value }) => parseISO(value), { toClassOnly: true })
  readonly startDate: Date;

  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @Transform(({ value }) => parseISO(value), { toClassOnly: true })
  readonly endDate: Date;
}
