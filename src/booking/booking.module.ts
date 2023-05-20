import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Slot } from '../slot-management/entities/slot.entity';
import { SlotManagementModule } from '../slot-management/slot-management.module';
import { BusinessModule } from '../business/business.module';
import { Business } from '../business/entities/business.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    SlotManagementModule,
    BusinessModule,
    TypeOrmModule.forFeature([Booking, Slot, Business, User]),
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
