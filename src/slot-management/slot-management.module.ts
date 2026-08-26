import { Module } from '@nestjs/common';
import { SlotManagementService } from './slot-management.service';
import { SlotManagementController } from './slot-management.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from './entities/slot.entity';
import { UsersModule } from '../users/users.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [TypeOrmModule.forFeature([Slot]), UsersModule, BusinessModule],
  controllers: [SlotManagementController],
  providers: [SlotManagementService],
  exports: [SlotManagementService],
})
export class SlotManagementModule {}
