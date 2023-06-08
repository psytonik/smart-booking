import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { ReserveSlotDto } from './dto/reserveSlot.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { Auth } from '../iam/authentication/decorator/auth.decorator';
import { AuthType } from '../iam/authentication/enums/auth-type.enum';
import { Slot } from '../slot-management/entities/slot.entity';

@ApiTags('Booking')
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @ApiBearerAuth()
  @Post(':businessId')
  create(
    @Param('businessId') businessId: string,
    @Body() reserveSlotDto: ReserveSlotDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.bookingService.reserveSlot(reserveSlotDto, businessId, user);
  }

  @Auth(AuthType.None)
  @Get('/business/:businessId')
  async availableSlots(
    @Param('businessId') businessId: string,
    @Query('page') page: number,
  ): Promise<Slot[]> {
    page = page >= 1 ? page : 1;
    return await this.bookingService.availableSlots(businessId, page);
  }

  @ApiBearerAuth()
  @Get('/slot/:id')
  async findReservedSlotById(
    @Param('id') bookedSlotId: string,
    @ActiveUser() currentUser: ActiveUserData,
  ) {
    return await this.bookingService.findReservedSlotById(
      bookedSlotId,
      currentUser,
    );
  }

  @ApiBearerAuth()
  @Delete('/slot/:id')
  async cancelSlotByCustomer(
    @Param('id') id: string,
    @ActiveUser() currentUser: ActiveUserData,
  ) {
    return await this.bookingService.cancelReservation(id, currentUser);
  }

  @ApiBearerAuth()
  @Get('/slots/')
  async findReservedSlotsByCustomer(@ActiveUser() currentUser: ActiveUserData) {
    return await this.bookingService.findReservedSlotsByUser(currentUser);
  }
}
