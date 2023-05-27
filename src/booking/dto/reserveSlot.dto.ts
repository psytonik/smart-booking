import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReserveSlotDto {
  @ApiProperty()
  @IsString()
  readonly reserveSlot: Date;
}
