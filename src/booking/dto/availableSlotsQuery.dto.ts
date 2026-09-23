import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AvailableSlotsQueryDto {
  @ApiPropertyOptional({
    type: Number,
    description: '7-day page starting now; 1 = the next 7 days (max 52)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  readonly page?: number;

  @ApiPropertyOptional({ type: Number, description: 'Only this staff member' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly staffId?: number;
}
