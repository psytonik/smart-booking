import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
