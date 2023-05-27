import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateDailySlotsDto {
  @ApiProperty({
    type: String,
    description: 'format of opening time must be for example 09:00',
  })
  @IsString()
  readonly openingHours: string;

  @ApiProperty({
    type: String,
    description: 'format of closing time must be for example 15:00',
  })
  @IsString()
  readonly closingHours: string;

  @ApiProperty({
    type: String,
    description: 'time can be between 1 min to 1440 min',
  })
  @IsString()
  readonly lunchDuration: string;

  @ApiProperty({
    type: String,
    description: 'time can be between 1 min to 1440 min',
  })
  @IsString()
  readonly timePerClient: string;
}
