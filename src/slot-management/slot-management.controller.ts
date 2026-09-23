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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { Slot } from './entities/slot.entity';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { DailySlotsDto } from './dto/dailySlots.dto';
import { WeeklySlotsDto } from './dto/weeklySlots.dto';
import { UpdateDailySlotsDto } from './dto/updateDailySlots.dto';
import { ReportDatesDto } from './dto/reportDates.dto';
import { StaffFilterDto } from './dto/staffFilter.dto';
import { SlotAccessService } from './slot-access.service';
import { SlotCommandService } from './slot-command.service';
import { SlotQueryService } from './slot-query.service';
import { todayIn } from './slot-schedule';

@ApiBearerAuth()
@Roles(Role.Business, Role.Employee, Role.Admin)
@ApiTags('Slots Management')
@Controller('slots')
export class SlotManagementController {
  constructor(
    private readonly slotAccess: SlotAccessService,
    private readonly slotCommands: SlotCommandService,
    private readonly slotQueries: SlotQueryService,
  ) {}

  @ApiOperation({ summary: 'Create one day of slots' })
  @Post('daily')
  async setDailySlots(
    @Body() dto: DailySlotsDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Slot[]> {
    const ctx = await this.slotAccess.resolve(user);
    const staff = await this.slotAccess.resolveStaff(ctx, dto.staffId);
    this.slotAccess.dayRange(ctx.business, dto.startDate);
    return this.slotCommands.createDay(ctx, staff, dto.startDate, dto);
  }

  @ApiOperation({ summary: 'Create slots for work days over several weeks' })
  @Post('weekly')
  async setWeeklySlots(
    @Body() dto: WeeklySlotsDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Slot[]> {
    const ctx = await this.slotAccess.resolve(user);
    const staff = await this.slotAccess.resolveStaff(ctx, dto.staffId);
    const firstDay = dto.startDate ?? todayIn(ctx.business.timezone);
    this.slotAccess.dayRange(ctx.business, firstDay);
    return this.slotCommands.createWeeks(
      ctx,
      staff,
      firstDay,
      dto.weeksAhead,
      dto.setWorkDays,
      dto.setHolidays,
      dto,
    );
  }

  @Get()
  async findAll(
    @Query() filter: StaffFilterDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Slot[]> {
    const ctx = await this.slotAccess.resolve(user);
    return this.slotQueries.listSlots(
      ctx,
      this.slotAccess.visibleStaffId(ctx, filter.staffId),
    );
  }

  @ApiOperation({ summary: 'Slots of one day (YYYY-MM-DD, business timezone)' })
  @Get(':date')
  async getSlotsByDay(
    @Param('date') date: string,
    @Query() filter: StaffFilterDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Slot[]> {
    const ctx = await this.slotAccess.resolve(user);
    return this.slotQueries.listSlotsInRange(
      ctx,
      this.slotAccess.dayRange(ctx.business, date),
      this.slotAccess.visibleStaffId(ctx, filter.staffId),
    );
  }

  @ApiOperation({
    summary:
      "Close a day: remove a staff member's free slots and breaks (bookings stay)",
  })
  @ApiResponse({ status: 204, description: 'The date successfully closed' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':date')
  async closeDay(
    @Param('date') date: string,
    @Query() filter: StaffFilterDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<void> {
    const ctx = await this.slotAccess.resolve(user);
    const staff = await this.slotAccess.resolveStaff(ctx, filter.staffId);
    await this.slotCommands.closeDay(ctx, staff, date);
  }

  @ApiOperation({
    summary: "Replace a staff member's schedule for a day (bookings stay)",
  })
  @HttpCode(HttpStatus.OK)
  @Patch(':date')
  async updateDailySlots(
    @Param('date') date: string,
    @Body() dto: UpdateDailySlotsDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<Slot[]> {
    const ctx = await this.slotAccess.resolve(user);
    const staff = await this.slotAccess.resolveStaff(ctx, dto.staffId);
    return this.slotCommands.updateDay(ctx, staff, date, dto);
  }

  @ApiOperation({
    summary: 'Booked slots between two days (inclusive, business timezone)',
  })
  @HttpCode(HttpStatus.OK)
  @Post('report')
  async getReportByDate(
    @Body() dates: ReportDatesDto,
    @Query() filter: StaffFilterDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<{ slots: Slot[]; totalSlots: number }> {
    const ctx = await this.slotAccess.resolve(user);
    const slots = await this.slotQueries.bookedSlotsInRange(
      ctx,
      {
        start: this.slotAccess.dayRange(ctx.business, dates.startDate).start,
        end: this.slotAccess.dayRange(ctx.business, dates.endDate).end,
      },
      this.slotAccess.visibleStaffId(ctx, filter.staffId),
    );
    return { totalSlots: slots.length, slots };
  }
}
