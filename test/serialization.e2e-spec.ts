import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  bearer,
  createOwner,
  createTestApp,
  DAILY_SCHEDULE,
  FUTURE_DAY,
  resetDatabase,
  signUp,
  Tokens,
} from './utils/test-app';

describe('Response shapes (e2e)', () => {
  let app: INestApplication;
  let owner: { tokens: Tokens; businessId: string; slug: string };
  let client: Tokens;
  let bookingId: string;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createOwner(app, 'owner@e2e.io', 'Acme', 'UTC');
    client = await signUp(app, 'client@e2e.io');
    await request(app.getHttpServer())
      .post('/slots/daily')
      .set('Authorization', bearer(owner.tokens))
      .send(DAILY_SCHEDULE)
      .expect(201);
    const booking = await request(app.getHttpServer())
      .post(`/booking/${owner.businessId}`)
      .set('Authorization', bearer(client))
      .send({ reserveSlot: `${FUTURE_DAY}T09:00` })
      .expect(201);
    bookingId = booking.body.id;
  });
  afterAll(() => app.close());

  it('returns only public business fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/business/${owner.slug}`)
      .expect(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'address',
        'description',
        'email',
        'id',
        'name',
        'phone_number',
        'slug',
        'timezone',
      ].sort(),
    );
  });

  it('returns a new booking as id + time only', async () => {
    const res = await request(app.getHttpServer())
      .get('/booking/slots')
      .set('Authorization', bearer(client))
      .expect(200);
    expect(res.body[0]).toEqual({
      id: bookingId,
      book_slot: `${FUTURE_DAY}T09:00:00.000Z`,
      business: expect.objectContaining({ id: owner.businessId }),
      slot: expect.objectContaining({ staffId: expect.any(Number) }),
    });
    expect(res.body[0].business).not.toHaveProperty('featured');
  });

  it("shows staff who booked a slot, but never the client's password or notes", async () => {
    const res = await request(app.getHttpServer())
      .get(`/slots/${FUTURE_DAY}`)
      .set('Authorization', bearer(owner.tokens))
      .expect(200);
    const booked = res.body.find((s) => s.status === 'booked');
    expect(booked.booking).toEqual({
      id: bookingId,
      client: { id: expect.any(Number), email: 'client@e2e.io' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|information/);
  });

  it('exposes only id, times and staff in public availability', async () => {
    const res = await request(app.getHttpServer())
      .get(`/booking/business/${owner.businessId}`)
      .expect(200);
    for (const slot of res.body) {
      expect(Object.keys(slot).sort()).toEqual(
        ['end_time', 'id', 'staffId', 'start_time'].sort(),
      );
    }
  });
});
