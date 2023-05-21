import { IsArray, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WeeklySlotsDto {
  @ApiProperty()
  @IsArray()
  setWorkDays: string[];

  @ApiProperty()
  @IsArray()
  setHolidays: string[];

  @ApiProperty()
  @IsNumber()
  weeksAhead: number;

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
}
