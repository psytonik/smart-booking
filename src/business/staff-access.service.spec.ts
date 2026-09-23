import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StaffAccessService, StaffContext } from './staff-access.service';
import { Role } from '../users/enums/role.enum';

describe('StaffAccessService', () => {
  const business = { id: 'biz', timezone: 'UTC' } as any;
  let user: any;
  let owned: any;
  let workplace: any;
  let staffMember: any;
  let service: StaffAccessService;

  beforeEach(() => {
    user = { id: 1, role: Role.Business };
    owned = business;
    workplace = null;
    staffMember = null;
    service = new StaffAccessService(
      {
        findActiveUser: async () => user,
        findStaffMember: async () => staffMember,
      } as any,
      {
        findByOwnerId: async () => owned,
        findByEmployeeId: async () => workplace,
      } as any,
    );
  });

  const caller = { sub: 1 } as any;

  describe('resolve', () => {
    it('resolves an owner to their business', async () => {
      await expect(service.resolve(caller)).resolves.toMatchObject({
        business,
        isOwner: true,
      });
    });

    it('resolves an employee to their workplace', async () => {
      user.role = Role.Employee;
      owned = null;
      workplace = business;
      await expect(service.resolve(caller)).resolves.toMatchObject({
        business,
        isOwner: false,
      });
    });

    it('rejects clients', async () => {
      user.role = Role.Client;
      await expect(service.resolve(caller)).rejects.toThrow(ForbiddenException);
    });

    it('gives admins no implicit access to other businesses', async () => {
      user.role = Role.Admin;
      owned = null;
      await expect(service.resolve(caller)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolveStaff', () => {
    const ownerCtx = (): StaffContext => ({ user, business, isOwner: true });
    const employeeCtx = (): StaffContext => ({
      user,
      business,
      isOwner: false,
    });

    it('defaults to the caller', async () => {
      await expect(service.resolveStaff(ownerCtx())).resolves.toBe(user);
    });

    it('lets an owner target a staff member of their business', async () => {
      staffMember = { id: 2 };
      await expect(service.resolveStaff(ownerCtx(), 2)).resolves.toBe(
        staffMember,
      );
    });

    it('rejects someone outside the business', async () => {
      await expect(service.resolveStaff(ownerCtx(), 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("stops an employee from managing a colleague's schedule", async () => {
      await expect(service.resolveStaff(employeeCtx(), 2)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('limits what an employee can see to their own schedule', () => {
      expect(service.visibleStaffId(employeeCtx(), 2)).toBe(1);
      expect(service.visibleStaffId(ownerCtx(), 2)).toBe(2);
      expect(service.visibleStaffId(ownerCtx())).toBeUndefined();
    });
  });

  it('only lets owners pass requireOwner', () => {
    expect(() =>
      service.requireOwner({ user, business, isOwner: false }),
    ).toThrow(ForbiddenException);
  });

  describe('days', () => {
    it('rejects malformed and impossible dates', () => {
      expect(() => service.dayRange(business, '2030-02-30')).toThrow(
        BadRequestException,
      );
      expect(() => service.dayRange(business, 'tomorrow')).toThrow(
        BadRequestException,
      );
    });

    it('rejects days in the past in the business timezone', () => {
      expect(() => service.assertNotInPast(business, '2000-01-01')).toThrow(
        BadRequestException,
      );
      expect(() =>
        service.assertNotInPast(business, '2999-01-01'),
      ).not.toThrow();
    });
  });
});
