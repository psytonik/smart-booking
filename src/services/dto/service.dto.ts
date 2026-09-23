import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 12 * 60;
export const MAX_BUFFER_MINUTES = 240;

export class CreateServiceDto {
  @ApiProperty({ example: 'Haircut' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  readonly name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly description?: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(MIN_DURATION_MINUTES)
  @Max(MAX_DURATION_MINUTES)
  readonly duration_minutes: number;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  readonly buffer_minutes?: number;

  @ApiProperty({
    example: 8000,
    description: 'Price in minor units (e.g. cents) of the business currency',
  })
  @IsInt()
  @Min(0)
  readonly price_minor: number;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class StaffOfferingDto {
  @ApiProperty()
  @IsInt()
  readonly staffId: number;

  @ApiPropertyOptional({ description: "Overrides the service's duration" })
  @IsOptional()
  @IsInt()
  @Min(MIN_DURATION_MINUTES)
  @Max(MAX_DURATION_MINUTES)
  readonly duration_minutes?: number;

  @ApiPropertyOptional({ description: "Overrides the service's buffer" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  readonly buffer_minutes?: number;

  @ApiPropertyOptional({ description: "Overrides the service's price" })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly price_minor?: number;
}

export class SetOfferingsDto {
  @ApiProperty({
    type: StaffOfferingDto,
    isArray: true,
    description: 'Replaces who offers this service',
  })
  @IsArray()
  @ArrayUnique((o: StaffOfferingDto) => o.staffId)
  @ValidateNested({ each: true })
  @Type(() => StaffOfferingDto)
  readonly staff: StaffOfferingDto[];
}
