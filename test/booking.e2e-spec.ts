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

describe('Booking (e2e)', () => {
  let app: INestApplication;
  let owner: { tokens: Tokens; businessId: string };
  const slotTime = `${FUTURE_DAY}T09:00`;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createOwner(app, 'owner@e2e.io', 'Acme');
    await request(app.getHttpServer())
      .post('/slots/daily')
      .set('Authorization', bearer(owner.tokens))
      .send(DAILY_SCHEDULE)
      .expect(201);
  });
  afterAll(() => app.close());

  const reserve = (tokens: Tokens, reserveSlot = slotTime) =>
    request(app.getHttpServer())
      .post(`/booking/${owner.businessId}`)
      .set('Authorization', bearer(tokens))
      .send({ reserveSlot });

  it('books a slot exactly once under concurrent requests', async () => {
    const clients = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => signUp(app, `client${i}@e2e.io`)),
    );

    const results = await Promise.all(clients.map((c) => reserve(c)));
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 404, 404, 404, 404]);
  });

  it('frees the slot when the booking is cancelled', async () => {
    const client = await signUp(app, 'cancel@e2e.io');
    const slot = `${FUTURE_DAY}T10:00`;
    const booking = await reserve(client, slot).expect(201);

    await request(app.getHttpServer())
      .delete(`/booking/slot/${booking.body.id}`)
      .set('Authorization', bearer(client))
      .expect(200);

    await reserve(client, slot).expect(201);
  });

  it("does not let an owner book their own business's slots", async () => {
    await reserve(owner.tokens, `${FUTURE_DAY}T11:00`).expect(403);
  });

  it('rejects a malformed reservation time', async () => {
    const client = await signUp(app, 'malformed@e2e.io');
    await reserve(client, 'not-a-date').expect(400);
  });
});
