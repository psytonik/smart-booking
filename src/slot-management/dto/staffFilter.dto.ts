import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

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

export class ListSlotsQueryDto extends IntersectionType(
  StaffFilterDto,
  PaginationQueryDto,
) {}
