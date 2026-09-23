import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class StaffOfferingResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj.staff?.id)
  staffId: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  duration_minutes: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  buffer_minutes: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  price_minor: number | null;
}

export class ServiceResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  description: string | null;

  @ApiProperty()
  @Expose()
  duration_minutes: number;

  @ApiProperty()
  @Expose()
  buffer_minutes: number;

  @ApiProperty({ description: 'Minor units of the business currency' })
  @Expose()
  price_minor: number;

  @ApiProperty()
  @Expose()
  active: boolean;

  @ApiProperty({
    type: StaffOfferingResponseDto,
    isArray: true,
    description:
      'Staff offering the service; null fields mean the service default',
  })
  @Expose({ name: 'offerings' })
  @Type(() => StaffOfferingResponseDto)
  staff: StaffOfferingResponseDto[];
}
