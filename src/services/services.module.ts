import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './entities/service.entity.js';
import { StaffService } from './entities/staff-service.entity.js';
import { ServicesService } from './services.service.js';
import {
  PublicServicesController,
  ServicesController,
} from './services.controller.js';
import { BusinessModule } from '../business/business.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service, StaffService]),
    BusinessModule,
    UsersModule,
  ],
  controllers: [ServicesController, PublicServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
