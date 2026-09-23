import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class ReserveSlotDto {
  @ApiProperty({
    type: String,
    description: 'Slot start time in ISO-8601, e.g. 2026-10-01T10:00',
  })
  @IsISO8601({ strict: true })
  readonly reserveSlot: string;
}
