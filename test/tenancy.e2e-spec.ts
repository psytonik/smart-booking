import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  bearer,
  createOwner,
  createTestApp,
  DAILY_SCHEDULE,
  FUTURE_DAY,
  resetDatabase,
  Tokens,
} from './utils/test-app';

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let owner1: { tokens: Tokens; businessId: string; slug: string };
  let owner2: { tokens: Tokens; businessId: string; slug: string };

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner1 = await createOwner(app, 'owner1@e2e.io', 'Acme');
    owner2 = await createOwner(app, 'owner2@e2e.io', 'Beta');
    for (const owner of [owner1, owner2]) {
      await request(app.getHttpServer())
        .post('/slots/daily')
        .set('Authorization', bearer(owner.tokens))
        .send(DAILY_SCHEDULE)
        .expect(201);
    }
  });
  afterAll(() => app.close());

  const slotsOf = async (owner: { tokens: Tokens }) =>
    (
      await request(app.getHttpServer())
        .get(`/slots/${FUTURE_DAY}`)
        .set('Authorization', bearer(owner.tokens))
        .expect(200)
    ).body;

  it('lets two businesses use the same hours', async () => {
    expect(await slotsOf(owner1)).toHaveLength(3);
    expect(await slotsOf(owner2)).toHaveLength(3);
  });

  it("does not let an owner delete another business's slots", async () => {
    await request(app.getHttpServer())
      .delete(`/slots/${FUTURE_DAY}`)
      .set('Authorization', bearer(owner2.tokens))
      .expect(204);

    expect(await slotsOf(owner2)).toHaveLength(0);
    expect(await slotsOf(owner1)).toHaveLength(3);
  });

  it("does not let an owner edit another owner's business", async () => {
    await request(app.getHttpServer())
      .patch(`/business/${owner1.slug}`)
      .set('Authorization', bearer(owner2.tokens))
      .send({ description: 'hijacked' })
      .expect(403);
  });

  it('rejects opening a second business', async () => {
    await request(app.getHttpServer())
      .post('/business/open')
      .set('Authorization', bearer(owner1.tokens))
      .send({
        name: 'Acme Two',
        description: 'e2e',
        address: 'x',
        email: 'a@e2e.io',
        phone_number: '0',
        timezone: 'Europe/Berlin',
      })
      .expect(409);
  });
});
