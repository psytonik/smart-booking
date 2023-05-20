import { Body, Controller, Get, Post } from '@nestjs/common';
import { SlotManagementService } from './slot-management.service';
import { DailySlotsDto } from './dto/dailySlots.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { Slot } from './entities/slot.entity';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';

@ApiBearerAuth()
@Roles(Role.Business, Role.Employee, Role.Admin)
@ApiTags('Slots Management')
@Controller('slots')
export class SlotManagementController {
  constructor(private readonly slotManagementService: SlotManagementService) {}

  @Post('daily')
  setDailySlots(
    @Body() dailySlotsDto: DailySlotsDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Slot[]> {
    return this.slotManagementService.setDailySlots(dailySlotsDto, user);
  }

  @Get()
  findAll(@ActiveUser() user: ActiveUserData): Promise<Slot[]> {
    return this.slotManagementService.findAll(user);
  }
}
