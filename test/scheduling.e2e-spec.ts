import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  bearer,
  createOwner,
  createTestApp,
  DAILY_SCHEDULE,
  FUTURE_DAY,
  makeEmployee,
  resetDatabase,
  signUp,
  SlotBody,
  Tokens,
} from './utils/test-app';

describe('Scheduling: timezones and staff (e2e)', () => {
  let app: INestApplication;
  let owner: { tokens: Tokens; businessId: string; userId: number };
  let employee: { tokens: Tokens; userId: number };
  let client: Tokens;

  const server = () => app.getHttpServer();
  const auth = (tokens: Tokens) => ({ Authorization: bearer(tokens) });

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createOwner(
      app,
      'owner@e2e.io',
      'NY Barber',
      'America/New_York',
    );
    employee = await makeEmployee(app, 'anna@e2e.io', owner.businessId);
    client = await signUp(app, 'client@e2e.io');
  });
  afterAll(() => app.close());

  it('stores working hours as UTC instants in the business timezone', async () => {
    const res = await request(server())
      .post('/slots/daily')
      .set(auth(owner.tokens))
      .send(DAILY_SCHEDULE)
      .expect(201);

    // 09:00 in New York in January is 14:00 UTC.
    expect(res.body[0].start_time).toBe(`${FUTURE_DAY}T14:00:00.000Z`);
  });

  it('lets the owner create slots for an employee at the same hours', async () => {
    await request(server())
      .post('/slots/daily')
      .set(auth(owner.tokens))
      .send({ ...DAILY_SCHEDULE, staffId: employee.userId })
      .expect(201);

    const day = await request(server())
      .get(`/slots/${FUTURE_DAY}`)
      .set(auth(owner.tokens))
      .expect(200);
    expect(day.body).toHaveLength(6);
  });

  it('shows an employee only their own slots', async () => {
    const day = await request(server())
      .get(`/slots/${FUTURE_DAY}`)
      .set(auth(employee.tokens))
      .expect(200);

    expect(day.body).toHaveLength(3);
    expect(
      day.body.every((s: SlotBody) => s.staff.id === employee.userId),
    ).toBe(true);
  });

  it("does not let an employee manage the owner's slots", async () => {
    await request(server())
      .delete(`/slots/${FUTURE_DAY}?staffId=${owner.userId}`)
      .set(auth(employee.tokens))
      .expect(403);
  });

  it('books a chosen staff member using local business time', async () => {
    const res = await request(server())
      .post(`/booking/${owner.businessId}`)
      .set(auth(client))
      .send({ reserveSlot: `${FUTURE_DAY}T09:00`, staffId: employee.userId })
      .expect(201);
    expect(res.body.book_slot).toBe(`${FUTURE_DAY}T14:00:00.000Z`);

    const anna = await request(server())
      .get(`/slots/${FUTURE_DAY}?staffId=${employee.userId}`)
      .set(auth(owner.tokens))
      .expect(200);
    expect(
      anna.body.find((s: SlotBody) => s.status === 'booked').start_time,
    ).toBe(`${FUTURE_DAY}T14:00:00.000Z`);
  });

  it('falls back to any free staff member and accepts explicit offsets', async () => {
    // 10:00 New York = 15:00Z; both staff are free, lowest id wins.
    const res = await request(server())
      .post(`/booking/${owner.businessId}`)
      .set(auth(client))
      .send({ reserveSlot: `${FUTURE_DAY}T15:00:00Z` })
      .expect(201);
    expect(res.body.book_slot).toBe(`${FUTURE_DAY}T15:00:00.000Z`);
  });

  it('keeps bookings when the day is rescheduled, and replaces the break', async () => {
    const res = await request(server())
      .patch(`/slots/${FUTURE_DAY}`)
      .set(auth(owner.tokens))
      .send({
        openingHours: '09:00',
        timePerClient: '60 min',
        closingHours: '13:00',
        lunchDuration: '60 min',
        staffId: employee.userId,
      })
      .expect(200);

    const statuses = res.body.map((s: SlotBody) => s.status);
    // 09:00 booked (kept), 10:00 free, 11:00 break, 12:00 free.
    expect(statuses).toEqual(['booked', 'available', 'break', 'available']);
  });

  it('paginates slot lists and caps the page size', async () => {
    const page = await request(server())
      .get('/slots?limit=2&offset=1')
      .set(auth(owner.tokens))
      .expect(200);
    expect(page.body).toHaveLength(2);

    await request(server())
      .get('/slots?limit=500')
      .set(auth(owner.tokens))
      .expect(400);
  });

  it('refuses dates in the past in the business timezone', async () => {
    await request(server())
      .post('/slots/daily')
      .set(auth(owner.tokens))
      .send({ ...DAILY_SCHEDULE, startDate: '2020-01-01' })
      .expect(400);
  });

  it('requires a valid timezone when opening a business', async () => {
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
      })
      .expect(400);
  });
});
