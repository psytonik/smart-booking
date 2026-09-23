import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkingHours } from './entities/working-hours.entity';
import { ScheduleOverride } from './entities/schedule-override.entity';
import { TimeBlock } from './entities/time-block.entity';
import { Booking } from './entities/booking.entity';
import { ScheduleService } from './schedule.service';
import { AvailabilityService } from './availability.service';
import { BookingService } from './booking.service';
import { ScheduleController } from './schedule.controller';
import { BookingController } from './booking.controller';
import { BusinessModule } from '../business/business.module';
import { UsersModule } from '../users/users.module';
import { ServicesModule } from '../services/services.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Working hours, blocked time, availability and bookings: one bounded
 * context, since each of them depends on the others.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkingHours,
      ScheduleOverride,
      TimeBlock,
      Booking,
    ]),
    BusinessModule,
    UsersModule,
    ServicesModule,
    NotificationsModule,
  ],
  controllers: [ScheduleController, BookingController],
  providers: [ScheduleService, AvailabilityService, BookingService],
})
export class SchedulingModule {}
