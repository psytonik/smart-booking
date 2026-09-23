import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { BusinessSummaryDto } from '../../business/dto/business-response.dto';
import { SlotSummaryDto } from '../../slot-management/dto/slot-response.dto';

export class BookingResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty({ description: 'Start of the booked slot (UTC)' })
  @Expose()
  book_slot: Date;
}

export class BookingDetailsDto extends BookingResponseDto {
  @ApiProperty({ type: BusinessSummaryDto })
  @Expose()
  @Type(() => BusinessSummaryDto)
  business: BusinessSummaryDto;

  @ApiPropertyOptional({ type: SlotSummaryDto })
  @Expose()
  @Type(() => SlotSummaryDto)
  slot?: SlotSummaryDto;
}
