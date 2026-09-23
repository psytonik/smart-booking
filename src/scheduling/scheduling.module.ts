import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkingHours } from './entities/working-hours.entity.js';
import { ScheduleOverride } from './entities/schedule-override.entity.js';
import { TimeBlock } from './entities/time-block.entity.js';
import { Booking } from './entities/booking.entity.js';
import { ScheduleService } from './schedule.service.js';
import { AvailabilityService } from './availability.service.js';
import { BookingService } from './booking.service.js';
import { ScheduleController } from './schedule.controller.js';
import { BookingController } from './booking.controller.js';
import { BusinessModule } from '../business/business.module.js';
import { UsersModule } from '../users/users.module.js';
import { ServicesModule } from '../services/services.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

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
