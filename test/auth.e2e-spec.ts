import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDatabase, signIn, signUp } from './utils/test-app';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });
  afterAll(() => app.close());

  it('rejects a refresh token used as a bearer token', async () => {
    const { refreshToken } = await signUp(app, 'client@e2e.io');

    await request(app.getHttpServer())
      .get('/booking/mine')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(401);
  });

  it('rejects an access token on the refresh endpoint', async () => {
    const { accessToken } = await signIn(app, 'client@e2e.io');

    await request(app.getHttpServer())
      .post('/authentication/refresh-tokens')
      .send({ refreshToken: accessToken })
      .expect(401);
  });

  it('rotates refresh tokens and rejects reuse of the old one', async () => {
    const { refreshToken } = await signIn(app, 'client@e2e.io');
    const server = app.getHttpServer();

    await request(server)
      .post('/authentication/refresh-tokens')
      .send({ refreshToken })
      .expect(200);
    await request(server)
      .post('/authentication/refresh-tokens')
      .send({ refreshToken })
      .expect(401);
  });

  it('uses one message for an unknown email and a wrong password', async () => {
    const server = app.getHttpServer();
    const unknown = await request(server)
      .post('/authentication/sign-in')
      .send({ email: 'nobody@e2e.io', password: 'password123' })
      .expect(401);
    const wrong = await request(server)
      .post('/authentication/sign-in')
      .send({ email: 'client@e2e.io', password: 'wrong-password' })
      .expect(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('keeps sessions on different devices independent, and logs one out', async () => {
    const server = app.getHttpServer();
    const laptop = await signIn(app, 'client@e2e.io');
    const phone = await signIn(app, 'client@e2e.io');

    await request(server)
      .post('/authentication/logout')
      .send({ refreshToken: laptop.refreshToken })
      .expect(204);

    await request(server)
      .post('/authentication/refresh-tokens')
      .send({ refreshToken: laptop.refreshToken })
      .expect(401);
    await request(server)
      .post('/authentication/refresh-tokens')
      .send({ refreshToken: phone.refreshToken })
      .expect(200);
  });

  it('applies a role change without signing in again', async () => {
    const server = app.getHttpServer();
    const { accessToken } = await signUp(app, 'newowner@e2e.io');
    await request(server)
      .post('/business/open')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Fresh',
        description: 'e2e',
        address: 'x',
        email: 'newowner@e2e.io',
        phone_number: '0',
        timezone: 'UTC',
        currency: 'EUR',
      })
      .expect(201);

    // Same token, still carrying role "client".
    await request(server)
      .get('/schedule/working-hours')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('reports database and redis health', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.info).toMatchObject({
      database: { status: 'up' },
      redis: { status: 'up' },
    });
  });
});
