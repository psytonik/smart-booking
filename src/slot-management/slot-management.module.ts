import { Module } from '@nestjs/common';
import { SlotManagementService } from './slot-management.service';
import { SlotManagementController } from './slot-management.controller';

@Module({
  controllers: [SlotManagementController],
  providers: [SlotManagementService],
})
export class SlotManagementModule {}
