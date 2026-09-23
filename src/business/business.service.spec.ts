import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Role } from '../users/enums/role.enum';

describe('BusinessService.openBusiness', () => {
  const dto = {
    name: 'Acme Barber',
    description: 'd',
    address: 'somewhere',
    email: 'acme@test.io',
    phone_number: '1',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
  };
  const caller = { sub: 1 } as any;

  let user: any;
  let existingSlugs: { id: string; slug: string }[];
  let ownedBusiness: any;
  let saved: any[];
  let service: BusinessService;

  beforeEach(() => {
    user = { id: 1, role: Role.Client };
    existingSlugs = [];
    ownedBusiness = null;
    saved = [];

    const queryBuilder = {
      select: () => queryBuilder,
      where: () => queryBuilder,
      getMany: async () => existingSlugs,
    };
    const businessRepo = {
      findOne: jest.fn(async () => ownedBusiness),
      create: jest.fn((data) => ({ ...data })),
      createQueryBuilder: () => queryBuilder,
    };
    const dataSource = {
      transaction: jest.fn(async (work) =>
        work({ save: jest.fn(async (entity) => saved.push(entity)) }),
      ),
    };

    service = new BusinessService(
      businessRepo as any,
      { findActiveUser: jest.fn(async () => user) } as any,
      {
        geocode: async () => ({
          lat: 1,
          lng: 2,
          formattedAddress: 'Resolved address',
        }),
      } as any,
      {} as any,
      dataSource as any,
    );
  });

  it('promotes a client and saves location, business and user together', async () => {
    const business = await service.openBusiness(dto, caller);

    expect(business.slug).toBe('acme-barber');
    expect(user.role).toBe(Role.Business);
    expect(saved).toHaveLength(3);
    expect(user.business).toBe(business);
    // create() deep-copies nested entities; the business must reference the
    // saved Location, not a copy without an id.
    expect(business.coords).toBe(saved[0]);
    expect(business.owner).toMatchObject({ id: 1, role: Role.Business });
    expect(business.owner).not.toHaveProperty('business');
  });

  it('rejects a user who already owns a business', async () => {
    ownedBusiness = { id: 'old' };
    await expect(service.openBusiness(dto, caller)).rejects.toThrow(
      ConflictException,
    );
    expect(saved).toHaveLength(0);
  });

  it('rejects employees', async () => {
    user.role = Role.Employee;
    await expect(service.openBusiness(dto, caller)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('does not demote an admin', async () => {
    user.role = Role.Admin;
    await service.openBusiness(dto, caller);
    expect(user.role).toBe(Role.Admin);
  });

  it('suffixes the slug on collision', async () => {
    existingSlugs = [
      { id: 'a', slug: 'acme-barber' },
      { id: 'b', slug: 'acme-barber-2' },
    ];
    const business = await service.openBusiness(dto, caller);
    expect(business.slug).toBe('acme-barber-3');
  });
});
