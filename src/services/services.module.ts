import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './entities/service.entity';
import { StaffService } from './entities/staff-service.entity';
import { ServicesService } from './services.service';
import {
  PublicServicesController,
  ServicesController,
} from './services.controller';
import { BusinessModule } from '../business/business.module';
import { UsersModule } from '../users/users.module';

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
