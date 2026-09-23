import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  availability,
  bearer,
  createOwner,
  createService,
  createTestApp,
  FUTURE_DAY,
  makeEmployee,
  resetDatabase,
  setWorkingHours,
  signUp,
  Tokens,
  utcTimes,
} from './utils/test-app.js';

describe('Scheduling: hours, overrides, blocks, staff (e2e)', () => {
  let app: INestApplication;
  let owner: { tokens: Tokens; businessId: string; userId: number };
  let anna: { tokens: Tokens; userId: number };
  let serviceId: string;

  const server = () => app.getHttpServer();
  const auth = (tokens: Tokens) => ({ Authorization: bearer(tokens) });
  const times = async (query: Record<string, string | number> = {}) =>
    utcTimes(
      await availability(app, owner.businessId, {
        serviceId,
        from: FUTURE_DAY,
        ...query,
      }),
    );

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createOwner(
      app,
      'owner@e2e.io',
      'NY Barber',
      'America/New_York',
    );
    anna = await makeEmployee(app, 'anna@e2e.io', owner.businessId);
    // Owner works 09:00–11:00 on Mondays; Anna 09:00–10:00.
    await setWorkingHours(app, owner.tokens, [
      { weekday: 'Monday', intervals: [{ start: '09:00', end: '11:00' }] },
    ]);
    await setWorkingHours(
      app,
      owner.tokens,
      [{ weekday: 'Monday', intervals: [{ start: '09:00', end: '10:00' }] }],
      anna.userId,
    );
    // 60 min; Anna does it in 45 min for a different price.
    serviceId = await createService(
      app,
      owner.tokens,
      [
        { staffId: owner.userId },
        { staffId: anna.userId, duration_minutes: 45, price_minor: 6000 },
      ],
      { duration_minutes: 60, price_minor: 9000 },
    );
  });
  afterAll(() => app.close());

  it('offers 15-minute starts in the business timezone, per staff member', async () => {
    const slots = await availability(app, owner.businessId, {
      serviceId,
      from: FUTURE_DAY,
    });
    // 09:00 New York in January = 14:00 UTC.
    const ownerTimes = utcTimes(
      slots.filter((s) => s.staffId === owner.userId),
    );
    const annaSlots = slots.filter((s) => s.staffId === anna.userId);
    expect(ownerTimes).toEqual(['14:00', '14:15', '14:30', '14:45', '15:00']);
    expect(utcTimes(annaSlots)).toEqual(['14:00', '14:15']);
    expect(annaSlots[0].price_minor).toBe(6000);
  });

  it('filters by staff member', async () => {
    expect(await times({ staffId: anna.userId })).toEqual(['14:00', '14:15']);
  });

  it('removes blocked time from availability', async () => {
    const block = await request(server())
      .post('/schedule/blocks')
      .set(auth(owner.tokens))
      .send({ start: `${FUTURE_DAY}T10:00`, end: `${FUTURE_DAY}T10:30` })
      .expect(201);

    expect(await times({ staffId: owner.userId })).toEqual(['14:00']);

    await request(server())
      .delete(`/schedule/blocks/${block.body.id}`)
      .set(auth(owner.tokens))
      .expect(204);
    expect(await times({ staffId: owner.userId })).toHaveLength(5);
  });

  it('turns a date into a day off, then back', async () => {
    await request(server())
      .put(`/schedule/overrides/${FUTURE_DAY}`)
      .set(auth(owner.tokens))
      .send({ intervals: [] })
      .expect(200);
    expect(await times({ staffId: owner.userId })).toEqual([]);

    await request(server())
      .delete(`/schedule/overrides/${FUTURE_DAY}`)
      .set(auth(owner.tokens))
      .expect(204);
    expect(await times({ staffId: owner.userId })).toHaveLength(5);
  });

  it('lets an employee set their own hours, but not the owner’s', async () => {
    await request(server())
      .put('/schedule/working-hours')
      .set(auth(anna.tokens))
      .send({
        days: [
          { weekday: 'Monday', intervals: [{ start: '09:00', end: '10:30' }] },
        ],
      })
      .expect(200);
    expect(await times({ staffId: anna.userId })).toHaveLength(4);

    await request(server())
      .put('/schedule/working-hours')
      .set(auth(anna.tokens))
      .send({ staffId: owner.userId, days: [] })
      .expect(403);
  });

  it('refuses overlapping working intervals', async () => {
    await request(server())
      .put('/schedule/working-hours')
      .set(auth(owner.tokens))
      .send({
        days: [
          {
            weekday: 'Tuesday',
            intervals: [
              { start: '09:00', end: '12:00' },
              { start: '11:00', end: '13:00' },
            ],
          },
        ],
      })
      .expect(400);
  });

  it('refuses to block time that is already booked, and shows the booking in the agenda', async () => {
    const client = await signUp(app, 'client@e2e.io');
    await request(server())
      .post(`/booking/${owner.businessId}`)
      .set(auth(client))
      .send({ serviceId, start: `${FUTURE_DAY}T09:00`, staffId: anna.userId })
      .expect(201);

    await request(server())
      .post('/schedule/blocks')
      .set(auth(anna.tokens))
      .send({ start: `${FUTURE_DAY}T09:30`, end: `${FUTURE_DAY}T10:00` })
      .expect(409);

    const agenda = await request(server())
      .get(`/schedule/bookings?from=${FUTURE_DAY}&to=${FUTURE_DAY}`)
      .set(auth(anna.tokens))
      .expect(200);
    expect(agenda.body.total).toBe(1);
    expect(agenda.body.bookings[0]).toMatchObject({
      start_time: `${FUTURE_DAY}T14:00:00.000Z`,
      end_time: `${FUTURE_DAY}T14:45:00.000Z`,
      price_minor: 6000,
      client: { email: 'client@e2e.io' },
    });
  });

  it('refuses overrides in the past', async () => {
    await request(server())
      .put('/schedule/overrides/2020-01-01')
      .set(auth(owner.tokens))
      .send({ intervals: [] })
      .expect(400);
  });

  it('requires a valid timezone and currency when opening a business', async () => {
    const { accessToken } = await signUp(app, 'tz@e2e.io');
    await request(server())
      .post('/business/open')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Nowhere',
        description: 'e2e',
        address: 'x',
        email: 'tz@e2e.io',
        phone_number: '0',
        timezone: 'Mars/Olympus',
        currency: 'XXXX',
      })
      .expect(400);
  });
});
