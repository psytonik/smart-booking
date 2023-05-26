import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { SlotManagementService } from './slot-management.service';
import { DailySlotsDto } from './dto/dailySlots.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { Slot } from './entities/slot.entity';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { WeeklySlotsDto } from './dto/weeklySlots.dto';
import { UpdateDailySlotsDto } from './dto/updateDailySlots.dto';

@ApiBearerAuth()
@Roles(Role.Business, Role.Employee, Role.Admin)
@ApiTags('Slots Management')
@Controller('slots')
export class SlotManagementController {
  constructor(private readonly slotManagementService: SlotManagementService) {}

  @ApiBody({ type: DailySlotsDto })
  @Post('daily')
  setDailySlots(
    @Body() dailySlotsDto: DailySlotsDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Slot[]> {
    return this.slotManagementService.setDailySlots(dailySlotsDto, user);
  }

  @ApiBody({ type: WeeklySlotsDto })
  @Post('weekly')
  async setWeeklySlots(
    @Body() weeklySlotsDto: WeeklySlotsDto,
    @ActiveUser() currentUser: ActiveUserData,
  ): Promise<Slot[]> {
    return await this.slotManagementService.setWeeklySlots(
      weeklySlotsDto,
      currentUser,
    );
  }

  @Get()
  findAll(@ActiveUser() user: ActiveUserData): Promise<Slot[]> {
    return this.slotManagementService.findAllSlots(user);
  }

  @ApiOperation({ summary: 'Date must be formatted by YYYY-MM-DD' })
  @Get(':date')
  async GetOpenedSlotByDay(
    @Param('date') date: string,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Slot[]> {
    return this.slotManagementService.getOpenedSlotByDay(date, user);
  }

  @ApiOperation({ summary: 'Date must be formatted by YYYY-MM-DD' })
  @ApiResponse({ status: 204, description: 'The date successfully closed' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':date')
  async getAndDeleteOpenedSlotsByDate(
    @Param('date') date: string,
    @ActiveUser() user: ActiveUserData,
  ): Promise<void> {
    return await this.slotManagementService.closeOpenedSlotsByDate(date, user);
  }

  @ApiOperation({ summary: 'Date must be formatted by YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'The date successfully updated' })
  @HttpCode(HttpStatus.OK)
  @Patch(':date')
  async updateDailySlots(
    @Param('date') date: string,
    @Body() updateSlot: UpdateDailySlotsDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.slotManagementService.updateDailySlots(updateSlot, user, date);
  }
}
