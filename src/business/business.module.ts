import { Module } from '@nestjs/common';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { Location } from './entities/location.entity';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { GeocodingService } from './geocoding.service';
import { StaffAccessService } from './staff-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, Location]),
    UsersModule,
    ConfigModule,
  ],
  controllers: [BusinessController],
  providers: [BusinessService, GeocodingService, StaffAccessService],
  exports: [BusinessService, StaffAccessService],
})
export class BusinessModule {}
