import { Module } from '@nestjs/common';
import { BusinessService } from './business.service.js';
import { BusinessController } from './business.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from './entities/business.entity.js';
import { Location } from './entities/location.entity.js';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module.js';
import { GeocodingService } from './geocoding.service.js';
import { StaffAccessService } from './staff-access.service.js';

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
