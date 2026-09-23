import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service.js';

describe('UsersService.findActiveUser', () => {
  const repo = { findOneBy: jest.fn<() => Promise<any>>() };
  const service = new UsersService(repo as any);

  beforeEach(() => repo.findOneBy.mockReset());

  it('never queries with a missing id', async () => {
    // findOneBy({ id: undefined }) drops the condition in TypeORM 0.3 and
    // returns the first row, which is how a token without `sub` could
    // resolve to an arbitrary user.
    await expect(service.findActiveUser(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(repo.findOneBy).not.toHaveBeenCalled();
  });

  it('rejects a deleted user', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.findActiveUser(1)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('returns the user for a valid id', async () => {
    repo.findOneBy.mockResolvedValue({ id: 1 });
    await expect(service.findActiveUser(1)).resolves.toEqual({ id: 1 });
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: 1 });
  });
});
