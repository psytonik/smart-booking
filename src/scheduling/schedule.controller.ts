import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  IntersectionType,
} from '@nestjs/swagger';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { ActiveUser } from '../iam/decorators/active-user.decorator';
import { ActiveUserData } from '../iam/interface/active-user-data.interface';
import { Serialize } from '../common/serialization/serialize.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { StaffAccessService } from '../business/staff-access.service';
import { dayRange, formatClock } from '../common/time';
import { ScheduleService, daysBetween } from './schedule.service';
import { BookingService } from './booking.service';
import {
  CreateBlockDto,
  DateRangeQueryDto,
  SetOverrideDto,
  SetWorkingHoursDto,
  StaffTargetDto,
} from './dto/schedule.dto';
import {
  AgendaResponseDto,
  BlockResponseDto,
  OverrideResponseDto,
  WorkingHoursResponseDto,
} from './dto/responses.dto';
import { TimeBlock } from './entities/time-block.entity';

class AgendaQueryDto extends IntersectionType(
  DateRangeQueryDto,
  PaginationQueryDto,
) {}

/**
 * A staff member's schedule, managed from the business web app. Owners act
 * for any staff member via `staffId`; employees only for themselves.
 */
@ApiTags('Schedule')
@ApiBearerAuth()
@Roles(Role.Business, Role.Employee, Role.Admin)
@Controller('schedule')
export class ScheduleController {
  constructor(
    private readonly staffAccess: StaffAccessService,
    private readonly schedule: ScheduleService,
    private readonly bookings: BookingService,
  ) {}

  @ApiOperation({ summary: 'Weekly working hours' })
  @Serialize(WorkingHoursResponseDto)
  @Get('working-hours')
  async getWorkingHours(
    @Query() query: StaffTargetDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    const ctx = await this.staffAccess.resolve(user);
    const staff = await this.staffAccess.resolveStaff(ctx, query.staffId);
    return {
      staffId: staff.id,
      days: await this.schedule.getWorkingHours(staff),
    };
  }

  @ApiOperation({ summary: 'Replace the weekly working hours' })
  @Serialize(WorkingHoursResponseDto)
  @Put('working-hours')
  async setWorkingHours(
    @Body() dto: SetWorkingHoursDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    const ctx = await this.staffAccess.resolve(user);
    const staff = await this.staffAccess.resolveStaff(ctx, dto.staffId);
    return {
      staffId: staff.id,
      days: await this.schedule.setWorkingHours(staff, dto.days),
    };
  }

  @ApiOperation({ summary: 'Dates with custom hours or days off' })
  @Serialize(OverrideResponseDto, { isArray: true })
  @Get('overrides')
  async getOverrides(
    @Query() query: DateRangeQueryDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    const ctx = await this.staffAccess.resolve(user);
    const staff = await this.staffAccess.resolveStaff(ctx, query.staffId);
    daysBetween(query.from, query.to);
    const overrides = await this.schedule.getOverrides(
      staff,
      query.from,
      query.to,
    );
    return [...overrides.entries()].map(([date, intervals]) => ({
      date,
      staffId: staff.id,
      intervals: intervals.map((i) => ({
        start: formatClock(i.startMinute),
        end: formatClock(i.endMinute),
      })),
    }));
  }

  @ApiOperation({
    summary: 'Custom hours for one date; an empty list is a day off',
  })
  @Serialize(OverrideResponseDto)
  @Put('overrides/:date')
  async setOverride(
    @Param('date') date: string,
    @Body() dto: SetOverrideDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    const ctx = await this.staffAccess.resolve(user);
    const staff = await this.staffAccess.resolveStaff(ctx, dto.staffId);
    this.staffAccess.dayRange(ctx.business, date);
    this.staffAccess.assertNotInPast(ctx.business, date);
    const intervals = await this.schedule.setOverride(
      staff,
      date,
      dto.intervals,
    );
    return {
      date,
      staffId: staff.id,
      intervals: intervals.map((i) => ({
        start: formatClock(i.startMinute),
        end: formatClock(i.endMinute),
      })),
    };
  }

  @ApiOperation({ summary: 'Back to the weekly hours on this date' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('overrides/:date')
  async deleteOverride(
    @Param('date') date: string,
    @Query() query: StaffTargetDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<void> {
    const ctx = await this.staffAccess.resolve(user);
    const staff = await this.staffAccess.resolveStaff(ctx, query.staffId);
    this.staffAccess.dayRange(ctx.business, date);
    await this.schedule.deleteOverride(staff, date);
  }

  @ApiOperation({ summary: 'Blocked time (breaks, errands) in a date range' })
  @Serialize(BlockResponseDto, { isArray: true })
  @Get('blocks')
  async listBlocks(
    @Query() query: DateRangeQueryDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<TimeBlock[]> {
    const ctx = await this.staffAccess.resolve(user);
    const staff = await this.staffAccess.resolveStaff(ctx, query.staffId);
    const days = daysBetween(query.from, query.to);
    return this.schedule.listBlocks([staff.id], {
      start: dayRange(days[0], ctx.business.timezone).start,
      end: dayRange(days[days.length - 1], ctx.business.timezone).end,
    });
  }

  @ApiOperation({
    summary: 'Block time, e.g. a break. Refused if it overlaps a booking.',
  })
  @Serialize(BlockResponseDto)
  @Post('blocks')
  async createBlock(
    @Body() dto: CreateBlockDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<TimeBlock> {
    const ctx = await this.staffAccess.resolve(user);
    const staff = await this.staffAccess.resolveStaff(ctx, dto.staffId);
    const block = await this.schedule.createBlock(
      ctx.business,
      staff,
      dto.start,
      dto.end,
      dto.reason,
    );
    block.staff = staff;
    return block;
  }

  @ApiOperation({ summary: 'Remove a block' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('blocks/:id')
  async deleteBlock(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: StaffTargetDto,
    @ActiveUser() user: ActiveUserData,
  ): Promise<void> {
    const ctx = await this.staffAccess.resolve(user);
    const staff = await this.staffAccess.resolveStaff(ctx, query.staffId);
    await this.schedule.deleteBlock([staff.id], id);
  }

  @ApiOperation({ summary: 'Bookings in a date range (the agenda)' })
  @Serialize(AgendaResponseDto)
  @Get('bookings')
  async agenda(
    @Query() query: AgendaQueryDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    const ctx = await this.staffAccess.resolve(user);
    if (query.staffId) {
      await this.staffAccess.resolveStaff(ctx, query.staffId);
    }
    return this.bookings.agenda(
      ctx,
      query.from,
      query.to,
      this.staffAccess.visibleStaffId(ctx, query.staffId),
      query,
    );
  }
}
