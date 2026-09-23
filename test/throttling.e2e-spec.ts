import './utils/low-auth-limit';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });
  afterAll(() => app.close());

  it('throttles repeated sign-in attempts', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/authentication/sign-in')
        .send({ email: 'victim@e2e.io', password: 'guess-guess' });

    for (let i = 0; i < 3; i++) {
      await attempt().expect(401);
    }
    await attempt().expect(429);
  });

  it('does not apply the auth limit to other routes', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
