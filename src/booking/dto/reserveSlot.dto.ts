import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional } from 'class-validator';

export class ReserveSlotDto {
  @ApiProperty({
    type: String,
    description:
      'Slot start time in ISO-8601. Without an offset (2026-10-01T10:00) it is local time in the business timezone; with one (…Z, …+02:00) it is absolute.',
  })
  @IsISO8601({ strict: true })
  readonly reserveSlot: string;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Book with this staff member. Omit to take any staff member free at that time.',
  })
  @IsOptional()
  @IsInt()
  readonly staffId?: number;
}
