import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlotManagementController } from './slot-management.controller';
import { Slot } from './entities/slot.entity';
import { UsersModule } from '../users/users.module';
import { BusinessModule } from '../business/business.module';
import { SlotAccessService } from './slot-access.service';
import { SlotCommandService } from './slot-command.service';
import { SlotQueryService } from './slot-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([Slot]), UsersModule, BusinessModule],
  controllers: [SlotManagementController],
  providers: [SlotAccessService, SlotCommandService, SlotQueryService],
  exports: [SlotCommandService, SlotQueryService],
})
export class SlotManagementModule {}
