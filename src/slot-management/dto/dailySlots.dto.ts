import { IsDate, IsString, MinDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class DailySlotsDto {
  @ApiProperty()
  @IsString()
  openingHours: string;

  @ApiProperty()
  @IsString()
  closingHours: string;

  @ApiProperty()
  @IsString()
  lunchDuration: string;

  @ApiProperty()
  @IsString()
  timePerClient: string;

  @ApiProperty({ type: String, description: 'Date in ISO format (yyyy-mm-dd)' })
  @IsDate()
  @MinDate(new Date(), { message: 'Start date cannot be in the past.' })
  @Transform(({ value }) => new Date(value), { toClassOnly: true })
  startDate: Date;
}
