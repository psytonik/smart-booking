import Redis from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler-storage.service';

/**
 * Runs against a real Redis (the same one docker-compose provides for
 * development/e2e), because the whole point of this class is the Lua
 * script's atomicity — a mock would only test our own plumbing.
 */
describe('RedisThrottlerStorage', () => {
  let redis: Redis;
  let storage: RedisThrottlerStorage;

  beforeAll(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      db: 2, // dedicated DB so this never collides with dev/e2e data
    });
    storage = new RedisThrottlerStorage(redis);
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
  });

  const key = 'client-1';
  const throttler = 'default';

  it('counts hits within the window', async () => {
    const first = await storage.increment(key, 60_000, 5, 60_000, throttler);
    expect(first).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(first.timeToExpire).toBeGreaterThan(0);

    const second = await storage.increment(key, 60_000, 5, 60_000, throttler);
    expect(second.totalHits).toBe(2);
  });

  it('blocks once the limit is exceeded, and keeps blocking within blockDuration', async () => {
    for (let i = 0; i < 3; i++) {
      await storage.increment(key, 60_000, 3, 60_000, throttler);
    }
    // 4th hit exceeds limit=3.
    const blocked = await storage.increment(key, 60_000, 3, 60_000, throttler);
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBeGreaterThan(0);

    // Still blocked on the next call, even with room under the raw counter.
    const stillBlocked = await storage.increment(
      key,
      60_000,
      3,
      60_000,
      throttler,
    );
    expect(stillBlocked.isBlocked).toBe(true);
  });

  it('unblocks once both the window and the block have elapsed', async () => {
    // @nestjs/throttler always resolves blockDuration >= ttl (it defaults
    // blockDuration to ttl itself), so the block never outlives the
    // counting window it was raised in — this is the realistic shape.
    const window = 60;
    for (let i = 0; i < 2; i++) {
      await storage.increment(key, window, 1, window, throttler);
    }
    await new Promise((resolve) => setTimeout(resolve, window + 20));

    const after = await storage.increment(key, window, 1, window, throttler);
    expect(after.isBlocked).toBe(false);
    expect(after.totalHits).toBe(1);
  });

  it('keeps separate counters per key and per throttler name', async () => {
    await storage.increment(key, 60_000, 5, 60_000, 'default');
    await storage.increment(key, 60_000, 5, 60_000, 'default');

    const otherKey = await storage.increment(
      'client-2',
      60_000,
      5,
      60_000,
      'default',
    );
    expect(otherKey.totalHits).toBe(1);

    const otherThrottler = await storage.increment(
      key,
      60_000,
      5,
      60_000,
      'auth',
    );
    expect(otherThrottler.totalHits).toBe(1);
  });
});
