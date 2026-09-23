import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../redis/redis.constants';

export class InvalidatedRefreshTokenError extends Error {}

@Injectable()
export class RefreshTokenIdsStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async insert(userId: number, tokenId: string): Promise<void> {
    await this.redisClient.set(this.getKey(userId), tokenId);
  }
  async validate(userId: number, tokenId: string): Promise<void> {
    const storeId = await this.redisClient.get(this.getKey(userId));
    if (storeId !== tokenId) {
      throw new InvalidatedRefreshTokenError('');
    }
  }
  async invalidate(userId: number): Promise<void> {
    await this.redisClient.del(this.getKey(userId));
  }
  private getKey(userId: number): string {
    return `user-${userId}`;
  }
}
