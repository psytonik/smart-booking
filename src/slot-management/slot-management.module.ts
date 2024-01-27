import { Module } from '@nestjs/common';
import { SlotManagementService } from './slot-management.service';
import { SlotManagementController } from './slot-management.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from './entities/slot.entity';
import { Users } from '../users/entities/user.entity';
import { Business } from '../business/entities/business.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Slot, Users, Business])],
  controllers: [SlotManagementController],
  providers: [SlotManagementService],
  exports: [SlotManagementService],
})
export class SlotManagementModule {}
