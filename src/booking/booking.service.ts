import { Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Injectable()
export class BookingService {
  create(createBookingManagementDto: CreateBookingDto) {
    return 'This action adds a new bookingManagement';
  }

  findAll() {
    return `This action returns all bookingManagement`;
  }

  findOne(id: number) {
    return `This action returns a #${id} bookingManagement`;
  }

  update(id: number, updateBookingManagementDto: UpdateBookingDto) {
    return `This action updates a #${id} bookingManagement`;
  }

  remove(id: number) {
    return `This action removes a #${id} bookingManagement`;
  }
}
