import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { SlotManagementModule } from '../slot-management/slot-management.module';
import { BusinessModule } from '../business/business.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    SlotManagementModule,
    BusinessModule,
    UsersModule,
    TypeOrmModule.forFeature([Booking]),
    NotificationsModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
