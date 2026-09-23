import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from '../iam/decorators/active-user.decorator.js';
import type { ActiveUserData } from '../iam/interface/active-user-data.interface.js';
import { Auth } from '../iam/authentication/decorator/auth.decorator.js';
import { AuthType } from '../iam/authentication/enums/auth-type.enum.js';
import { Serialize } from '../common/serialization/serialize.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { BookingService } from './booking.service.js';
import { AvailabilityQueryDto, ReserveDto } from './dto/booking.dto.js';
import { AvailableStartDto, BookingDetailsDto } from './dto/responses.dto.js';

/** The client side: finding a time and booking it. */
@ApiTags('Booking')
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @ApiOperation({
    summary:
      'Free start times for a service, every 15 minutes, per staff member',
  })
  @Auth(AuthType.None)
  @Serialize(AvailableStartDto, { isArray: true })
  @Get('business/:businessId/availability')
  async availability(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.bookingService.availableStarts(
      businessId,
      query.serviceId,
      query.staffId,
      query.from,
      query.days,
    );
  }

  @ApiOperation({ summary: 'My bookings, newest first' })
  @ApiBearerAuth()
  @Serialize(BookingDetailsDto, { isArray: true })
  @Get('mine')
  async mine(
    @ActiveUser() user: ActiveUserData,
    @Query() page: PaginationQueryDto,
  ) {
    return this.bookingService.findReservationsByUser(user, page);
  }

  @ApiOperation({ summary: 'Book a service at an available start time' })
  @ApiBearerAuth()
  @Serialize(BookingDetailsDto)
  @Post(':businessId')
  async reserve(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ReserveDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.bookingService.reserve(dto, businessId, user);
  }

  @ApiBearerAuth()
  @Serialize(BookingDetailsDto)
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.bookingService.findReservation(id, user);
  }

  @ApiOperation({ summary: 'Cancel my upcoming booking (kept as history)' })
  @ApiBearerAuth()
  @Serialize(BookingDetailsDto)
  @Delete(':id')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.bookingService.cancelReservation(id, user);
  }
}
