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
      .get('/booking/slots')
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

  it('reports database and redis health', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.info).toMatchObject({
      database: { status: 'up' },
      redis: { status: 'up' },
    });
  });
});
