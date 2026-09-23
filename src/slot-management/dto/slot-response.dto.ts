import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { SlotStatus } from '../enums/slotStatus.enum';

export class PersonRefDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiPropertyOptional()
  @Expose()
  email?: string;
}

export class SlotBookingDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty({ type: PersonRefDto })
  @Expose({ name: 'user' })
  @Type(() => PersonRefDto)
  client: PersonRefDto;
}

/** A slot as its business's staff see it, including who booked it. */
export class SlotResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  start_time: Date;

  @ApiProperty()
  @Expose()
  end_time: Date;

  @ApiProperty({ enum: SlotStatus })
  @Expose()
  status: SlotStatus;

  @ApiProperty({ type: PersonRefDto })
  @Expose()
  @Type(() => PersonRefDto)
  staff: PersonRefDto;

  @ApiPropertyOptional({ type: SlotBookingDto })
  @Expose({ name: 'booking_by' })
  @Type(() => SlotBookingDto)
  booking?: SlotBookingDto;
}

/** A slot without staff-only details: public availability, or the slot of a booking. */
export class SlotSummaryDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  start_time: Date;

  @ApiProperty()
  @Expose()
  end_time: Date;

  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj.staff?.id)
  staffId: number;
}

export class SlotReportDto {
  @ApiProperty()
  @Expose()
  totalSlots: number;

  @ApiProperty({ type: SlotResponseDto, isArray: true })
  @Expose()
  @Type(() => SlotResponseDto)
  slots: SlotResponseDto[];
}
