import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlotManagementModule } from './slot-management/slot-management.module';
import { BookingModule } from './booking/booking.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IamModule } from './iam/iam.module';
import { BusinessModule } from './business/business.module';
import { dataSourceOptions } from './config/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    SlotManagementModule,
    BookingModule,
    UsersModule,
    NotificationsModule,
    IamModule,
    BusinessModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
