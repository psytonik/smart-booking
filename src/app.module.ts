import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlotManagementModule } from './slot-management/slot-management.module';
import { BookingModule } from './booking/booking.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IamModule } from './iam/iam.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          database: configService.get<string>('POSTGRES_DB'),
          host: configService.get<string>('POSTGRES_HOST'),
          port: configService.get<number>('POSTGRES_PORT'),
          type: configService.get<'postgres'>('DB_TYPE'),
          username: configService.get<string>('POSTGRES_USER'),
          password: configService.get<string>('POSTGRES_PASSWORD'),
          entities: [__dirname + '/**/*.entity.js'],
          synchronize: true,
        };
      },
    }),
    SlotManagementModule,
    BookingModule,
    UsersModule,
    NotificationsModule,
    IamModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
