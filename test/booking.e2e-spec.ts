import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  availability,
  bearer,
  createOwner,
  createService,
  createTestApp,
  FUTURE_DAY,
  resetDatabase,
  setWorkingHours,
  signUp,
  Tokens,
  utcTimes,
} from './utils/test-app.js';

describe('Booking (e2e)', () => {
  let app: INestApplication;
  let owner: { tokens: Tokens; businessId: string; userId: number };
  let serviceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createOwner(app, 'owner@e2e.io', 'Acme', 'UTC');
    await setWorkingHours(app, owner.tokens);
    // 30 min + 15 min buffer.
    serviceId = await createService(
      app,
      owner.tokens,
      [{ staffId: owner.userId }],
      { duration_minutes: 30, buffer_minutes: 15 },
    );
  });
  afterAll(() => app.close());

  const reserve = (tokens: Tokens, start: string) =>
    request(app.getHttpServer())
      .post(`/booking/${owner.businessId}`)
      .set('Authorization', bearer(tokens))
      .send({ serviceId, start });

  const freeTimes = async () =>
    utcTimes(
      await availability(app, owner.businessId, {
        serviceId,
        from: FUTURE_DAY,
      }),
    );

  it('books a time exactly once under concurrent requests', async () => {
    const clients = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => signUp(app, `client${i}@e2e.io`)),
    );

    const results = await Promise.all(
      clients.map((c) => reserve(c, `${FUTURE_DAY}T09:00`)),
    );
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409, 409, 409, 409]);
  });

  it('is protected by the database itself, not only by the app', async () => {
    const db = app.get(DataSource);
    const [existing] = await db.query(
      `SELECT "businessId", "userId", "staffId", "serviceId" FROM booking WHERE status = 'confirmed' LIMIT 1`,
    );
    // Overlaps the 09:00–09:45 booking (incl. buffer) made above.
    await expect(
      db.query(
        `INSERT INTO booking ("businessId", "userId", "staffId", "serviceId", start_time, end_time, blocked_until, duration_minutes, price_minor, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $6, 30, 0, 'EUR')`,
        [
          existing.businessId,
          existing.userId,
          existing.staffId,
          existing.serviceId,
          `${FUTURE_DAY}T09:15:00Z`,
          `${FUTURE_DAY}T09:45:00Z`,
        ],
      ),
    ).rejects.toMatchObject({ driverError: { code: '23P01' } });
  });

  it('keeps the buffer after a booking free', async () => {
    // 09:00–09:30 booked, buffer to 09:45: 09:15 and 09:30 would overlap.
    const times = await freeTimes();
    expect(times.slice(0, 2)).toEqual(['09:45', '10:00']);
  });

  it('refuses a start time that is not offered', async () => {
    const client = await signUp(app, 'offgrid@e2e.io');
    await reserve(client, `${FUTURE_DAY}T10:05`).expect(409); // off the grid
    await reserve(client, `${FUTURE_DAY}T18:00`).expect(409); // after hours
  });

  it('frees the time when the client cancels, keeping the record', async () => {
    const client = await signUp(app, 'cancel@e2e.io');
    const booking = await reserve(client, `${FUTURE_DAY}T11:00`).expect(201);

    const cancelled = await request(app.getHttpServer())
      .delete(`/booking/${booking.body.id}`)
      .set('Authorization', bearer(client))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled_by_client');

    expect(await freeTimes()).toContain('11:00');
    const mine = await request(app.getHttpServer())
      .get('/booking/mine')
      .set('Authorization', bearer(client))
      .expect(200);
    expect(mine.body).toHaveLength(1);
  });

  it('does not let staff book their own business', async () => {
    await reserve(owner.tokens, `${FUTURE_DAY}T12:00`).expect(403);
  });

  it('rejects a malformed start time', async () => {
    const client = await signUp(app, 'malformed@e2e.io');
    await reserve(client, 'not-a-date').expect(400);
  });
});
