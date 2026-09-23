import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActiveUserData } from '../iam/interface/active-user-data.interface.js';
import { UsersService } from '../users/users.service.js';
import { BusinessService } from './business.service.js';
import { Users } from '../users/entities/user.entity.js';
import { Business } from './entities/business.entity.js';
import { Role } from '../users/enums/role.enum.js';
import { dayRange, isCalendarDay, todayIn } from '../common/time.js';

/** Who is acting on a business's staff data, and for which business. */
export interface StaffContext {
  user: Users;
  business: Business;
  /** Owners manage every staff member; employees only themselves. */
  isOwner: boolean;
}

@Injectable()
export class StaffAccessService {
  constructor(
    private readonly usersService: UsersService,
    private readonly businessService: BusinessService,
  ) {}

  /**
   * Resolves the business the caller manages: the one they own, or, for an
   * employee, their workplace. Admins get no special access here; like
   * anyone else they manage only a business they own.
   */
  async resolve(currentUser: ActiveUserData): Promise<StaffContext> {
    const user = await this.usersService.findActiveUser(currentUser.sub);
    if (user.role === Role.Client) {
      throw new ForbiddenException('Only business staff can do this');
    }
    const owned = await this.businessService.findByOwnerId(user.id);
    if (owned) {
      return { user, business: owned, isOwner: true };
    }
    const workplace =
      user.role === Role.Employee
        ? await this.businessService.findByEmployeeId(user.id)
        : null;
    if (!workplace) {
      throw new ForbiddenException('You do not manage a business');
    }
    return { user, business: workplace, isOwner: false };
  }

  /**
   * The staff member an operation targets: the caller by default. Only
   * owners may target someone else, and only staff of their own business.
   */
  async resolveStaff(ctx: StaffContext, staffId?: number): Promise<Users> {
    if (!staffId || staffId === ctx.user.id) {
      return ctx.user;
    }
    if (!ctx.isOwner) {
      throw new ForbiddenException(
        'Employees can only manage their own schedule',
      );
    }
    const staff = await this.usersService.findStaffMember(
      staffId,
      ctx.business.id,
    );
    if (!staff) {
      throw new NotFoundException('Staff member not found in this business');
    }
    return staff;
  }

  /**
   * Employees only ever see their own schedule; owners see everyone's unless
   * they filter by `staffId`.
   */
  visibleStaffId(ctx: StaffContext, staffId?: number): number | undefined {
    return ctx.isOwner ? staffId : ctx.user.id;
  }

  requireOwner(ctx: StaffContext): void {
    if (!ctx.isOwner) {
      throw new ForbiddenException('Only the business owner can do this');
    }
  }

  /** Validates a `yyyy-MM-dd` day and returns its range in business time. */
  dayRange(business: Business, day: string): { start: Date; end: Date } {
    if (!isCalendarDay(day)) {
      throw new BadRequestException('Date must be formatted as YYYY-MM-DD');
    }
    return dayRange(day, business.timezone);
  }

  assertNotInPast(business: Business, day: string): void {
    if (day < todayIn(business.timezone)) {
      throw new BadRequestException(
        `${day} is in the past in ${business.timezone}`,
      );
    }
  }
}
