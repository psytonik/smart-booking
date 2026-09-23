import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class StaffFilterDto {
  @ApiPropertyOptional({
    type: Number,
    description:
      'Limit to one staff member. Owners may pass anyone in their business; employees always see only their own slots.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly staffId?: number;
}
