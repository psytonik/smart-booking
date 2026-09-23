import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../redis/redis.constants.js';

export class InvalidatedRefreshTokenError extends Error {}

/**
 * One Redis key per refresh-token session, expiring with the token, so a
 * user can be signed in on several devices and stale sessions clean up
 * after themselves.
 */
@Injectable()
export class RefreshTokenIdsStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async insert(
    userId: number,
    tokenId: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redisClient.set(
      this.getKey(userId, tokenId),
      '1',
      'EX',
      ttlSeconds,
    );
  }

  async validate(userId: number, tokenId: string): Promise<void> {
    if (!(await this.redisClient.exists(this.getKey(userId, tokenId)))) {
      throw new InvalidatedRefreshTokenError('');
    }
  }

  async invalidate(userId: number, tokenId: string): Promise<void> {
    await this.redisClient.del(this.getKey(userId, tokenId));
  }

  private getKey(userId: number, tokenId: string): string {
    return `refresh:${userId}:${tokenId}`;
  }
}
