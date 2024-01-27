import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { Slot } from '../slot-management/entities/slot.entity';
import { SlotManagementModule } from '../slot-management/slot-management.module';
import { BusinessModule } from '../business/business.module';
import { Business } from '../business/entities/business.entity';
import { Users } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    SlotManagementModule,
    BusinessModule,
    TypeOrmModule.forFeature([Booking, Slot, Business, Users]),
    NotificationsModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
