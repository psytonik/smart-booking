import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  bearer,
  createOwner,
  createService,
  createTestApp,
  resetDatabase,
  setWorkingHours,
  Tokens,
} from './utils/test-app.js';

describe('Tenant isolation (e2e)', () => {
  type Owner = {
    tokens: Tokens;
    businessId: string;
    slug: string;
    userId: number;
  };
  let app: INestApplication;
  let owner1: Owner;
  let owner2: Owner;
  let service1: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner1 = await createOwner(app, 'owner1@e2e.io', 'Acme');
    owner2 = await createOwner(app, 'owner2@e2e.io', 'Beta');
    await setWorkingHours(app, owner1.tokens);
    service1 = await createService(app, owner1.tokens, [
      { staffId: owner1.userId },
    ]);
  });
  afterAll(() => app.close());

  it("does not let an owner edit another business's service", async () => {
    await request(server())
      .patch(`/services/${service1}`)
      .set('Authorization', bearer(owner2.tokens))
      .send({ price_minor: 1 })
      .expect(403);
  });

  it("only lists the caller's own services", async () => {
    const res = await request(server())
      .get('/services')
      .set('Authorization', bearer(owner2.tokens))
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("does not let an owner manage another business's staff", async () => {
    await request(server())
      .get(`/schedule/working-hours?staffId=${owner1.userId}`)
      .set('Authorization', bearer(owner2.tokens))
      .expect(404);
    await request(server())
      .put(`/services/${service1}/staff`)
      .set('Authorization', bearer(owner1.tokens))
      .send({ staff: [{ staffId: owner2.userId }] })
      .expect(400);
  });

  it("does not let an owner edit another owner's business", async () => {
    await request(server())
      .patch(`/business/${owner1.slug}`)
      .set('Authorization', bearer(owner2.tokens))
      .send({ description: 'hijacked' })
      .expect(403);
  });

  it('replaces the location on an address change without orphaning the old one', async () => {
    const locations = () =>
      app.get(DataSource).query('SELECT count(*)::int AS n FROM location');
    const [before] = await locations();

    await request(server())
      .patch(`/business/${owner1.slug}`)
      .set('Authorization', bearer(owner1.tokens))
      .send({ address: 'New street 5' })
      .expect(200);

    const [after] = await locations();
    expect(after.n).toBe(before.n);
  });

  it('rejects an address that cannot be resolved', async () => {
    await request(server())
      .patch(`/business/${owner1.slug}`)
      .set('Authorization', bearer(owner1.tokens))
      .send({ address: 'nowhere at all' })
      .expect(400);
  });

  it('rejects opening a second business', async () => {
    await request(server())
      .post('/business/open')
      .set('Authorization', bearer(owner1.tokens))
      .send({
        name: 'Acme Two',
        description: 'e2e',
        address: 'x',
        email: 'a@e2e.io',
        phone_number: '0',
        timezone: 'Europe/Berlin',
        currency: 'EUR',
      })
      .expect(409);
  });
});
