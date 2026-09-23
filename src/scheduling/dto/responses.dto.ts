import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { BookingStatus } from '../enums/booking-status.enum.js';
import { BusinessSummaryDto } from '../../business/dto/business-response.dto.js';

export class IntervalResponseDto {
  @ApiProperty({ example: '09:00' })
  @Expose()
  start: string;

  @ApiProperty({ example: '13:00' })
  @Expose()
  end: string;
}

export class WorkingDayResponseDto {
  @ApiProperty({ example: 'Monday' })
  @Expose()
  weekday: string;

  @ApiProperty({ type: IntervalResponseDto, isArray: true })
  @Expose()
  @Type(() => IntervalResponseDto)
  intervals: IntervalResponseDto[];
}

export class WorkingHoursResponseDto {
  @ApiProperty()
  @Expose()
  staffId: number;

  @ApiProperty({ type: WorkingDayResponseDto, isArray: true })
  @Expose()
  @Type(() => WorkingDayResponseDto)
  days: WorkingDayResponseDto[];
}

export class OverrideResponseDto {
  @ApiProperty({ example: '2030-01-07' })
  @Expose()
  date: string;

  @ApiProperty()
  @Expose()
  staffId: number;

  @ApiProperty({ description: 'Empty = day off' })
  @Expose()
  @Type(() => IntervalResponseDto)
  intervals: IntervalResponseDto[];
}

export class BlockResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj.staff?.id)
  staffId: number;

  @ApiProperty()
  @Expose()
  start_time: Date;

  @ApiProperty()
  @Expose()
  end_time: Date;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  reason: string | null;
}

export class AvailableStartDto {
  @ApiProperty()
  @Expose()
  start: Date;

  @ApiProperty()
  @Expose()
  end: Date;

  @ApiProperty()
  @Expose()
  staffId: number;

  @ApiProperty({ description: 'Minor units of the business currency' })
  @Expose()
  price_minor: number;
}

export class ServiceRefDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;
}

export class PersonRefDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiPropertyOptional()
  @Expose()
  email?: string;
}

/** A booking as the client sees it. */
export class BookingResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  start_time: Date;

  @ApiProperty()
  @Expose()
  end_time: Date;

  @ApiProperty({ enum: BookingStatus })
  @Expose()
  status: BookingStatus;

  @ApiProperty()
  @Expose()
  price_minor: number;

  @ApiProperty({ example: 'ILS' })
  @Expose()
  currency: string;

  @ApiProperty({ type: ServiceRefDto })
  @Expose()
  @Type(() => ServiceRefDto)
  service: ServiceRefDto;

  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj.staff?.id)
  staffId: number;
}

export class BookingDetailsDto extends BookingResponseDto {
  @ApiProperty({ type: BusinessSummaryDto })
  @Expose()
  @Type(() => BusinessSummaryDto)
  business: BusinessSummaryDto;
}

/** A booking in the staff agenda, with the client. */
export class AgendaBookingDto extends BookingResponseDto {
  @ApiProperty({ type: PersonRefDto })
  @Expose({ name: 'user' })
  @Type(() => PersonRefDto)
  client: PersonRefDto;
}

export class AgendaResponseDto {
  @ApiProperty()
  @Expose()
  total: number;

  @ApiProperty({ type: AgendaBookingDto, isArray: true })
  @Expose()
  @Type(() => AgendaBookingDto)
  bookings: AgendaBookingDto[];
}
