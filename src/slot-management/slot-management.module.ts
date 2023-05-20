import { Module } from '@nestjs/common';
import { SlotManagementService } from './slot-management.service';
import { SlotManagementController } from './slot-management.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from './entities/slot.entity';
import { User } from '../users/entities/user.entity';
import { Weekly } from './entities/weekly.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Slot, User, Weekly])],
  controllers: [SlotManagementController],
  providers: [SlotManagementService],
  exports: [SlotManagementService],
})
export class SlotManagementModule {}
