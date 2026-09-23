import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
} from './utils/test-app.js';

describe('Response shapes (e2e)', () => {
  let app: INestApplication;
  let owner: {
    tokens: Tokens;
    businessId: string;
    slug: string;
    userId: number;
  };
  let client: Tokens;
  let serviceId: string;
  let bookingId: string;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createOwner(app, 'owner@e2e.io', 'Acme', 'UTC', 'ILS');
    client = await signUp(app, 'client@e2e.io');
    await setWorkingHours(app, owner.tokens);
    serviceId = await createService(app, owner.tokens, [
      { staffId: owner.userId },
    ]);
    const booking = await request(app.getHttpServer())
      .post(`/booking/${owner.businessId}`)
      .set('Authorization', bearer(client))
      .send({ serviceId, start: `${FUTURE_DAY}T09:00` })
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
        'currency',
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

  it('lists public services with price and who offers them', async () => {
    const res = await request(app.getHttpServer())
      .get(`/business/${owner.slug}/services`)
      .expect(200);
    expect(res.body).toEqual([
      {
        id: serviceId,
        name: 'Haircut',
        description: null,
        duration_minutes: 30,
        buffer_minutes: 0,
        price_minor: 8000,
        active: true,
        staff: [
          {
            staffId: owner.userId,
            duration_minutes: null,
            buffer_minutes: null,
            price_minor: null,
          },
        ],
      },
    ]);
  });

  it('returns a booking with its service, staff, price and business', async () => {
    const res = await request(app.getHttpServer())
      .get('/booking/mine')
      .set('Authorization', bearer(client))
      .expect(200);
    expect(res.body[0]).toEqual({
      id: bookingId,
      start_time: `${FUTURE_DAY}T09:00:00.000Z`,
      end_time: `${FUTURE_DAY}T09:30:00.000Z`,
      status: 'confirmed',
      price_minor: 8000,
      currency: 'ILS',
      service: { id: serviceId, name: 'Haircut' },
      staffId: owner.userId,
      business: expect.objectContaining({ id: owner.businessId }),
    });
    expect(res.body[0].business).not.toHaveProperty('featured');
  });

  it('exposes only start, end, staff and price in availability', async () => {
    const slots = await availability(app, owner.businessId, {
      serviceId,
      from: FUTURE_DAY,
    });
    expect(Object.keys(slots[0]).sort()).toEqual(
      ['end', 'price_minor', 'staffId', 'start'].sort(),
    );
  });

  it("never leaks a client's password or notes in the agenda", async () => {
    const res = await request(app.getHttpServer())
      .get(`/schedule/bookings?from=${FUTURE_DAY}&to=${FUTURE_DAY}`)
      .set('Authorization', bearer(owner.tokens))
      .expect(200);
    expect(res.body.bookings[0].client).toEqual({
      id: expect.any(Number),
      email: 'client@e2e.io',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|information/);
  });
});
