import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
// Not re-exported from the package root; the interface file is the only
// public path to the type.
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

/**
 * Redis-backed `ThrottlerStorage`. We write our own instead of depending on
 * a third-party package (`@nest-lab/throttler-storage-redis`) because that
 * package's peer range caps out at `@nestjs/common@^11` — it would block a
 * future Nest 12 upgrade for no functional reason, since the interface it
 * implements is three lines wide.
 *
 * The algorithm (fixed window + a separate block key, both driven by one
 * Lua script so the read-modify-write is atomic under concurrent requests)
 * is the same approach @nest-lab and most Redis rate limiters use; credit
 * to https://github.com/wyattjoh/rate-limit-redis for the script shape.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  // KEYS[1] = hit counter, KEYS[2] = block flag.
  // ARGV: ttl (ms), limit, blockDuration (ms). All times in and out are ms;
  // ThrottlerStorageRecord wants seconds, so the caller converts.
  private static readonly SCRIPT = `
    local hitKey = KEYS[1]
    local blockKey = KEYS[2]
    local ttl = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local blockDuration = tonumber(ARGV[3])

    local totalHits = redis.call('INCR', hitKey)
    local timeToExpire = redis.call('PTTL', hitKey)
    if timeToExpire <= 0 then
      redis.call('PEXPIRE', hitKey, ttl)
      timeToExpire = ttl
    end

    local isBlocked = redis.call('EXISTS', blockKey) == 1
    local timeToBlockExpire = 0
    if isBlocked then
      timeToBlockExpire = redis.call('PTTL', blockKey)
    elseif totalHits > limit then
      redis.call('SET', blockKey, 1, 'PX', blockDuration)
      isBlocked = true
      timeToBlockExpire = blockDuration
    end

    return { totalHits, timeToExpire, isBlocked and 1 or 0, timeToBlockExpire }
  `;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // Braces pin both keys to the same Redis Cluster slot, and namespace by
    // throttler name so "default" and "auth" limits don't share counters.
    const hitKey = `throttle:{${key}:${throttlerName}}:hits`;
    const blockKey = `throttle:{${key}:${throttlerName}}:blocked`;

    const result = (await this.redis.eval(
      RedisThrottlerStorage.SCRIPT,
      2,
      hitKey,
      blockKey,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];
    const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = result;

    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpireMs / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
    };
  }
}
