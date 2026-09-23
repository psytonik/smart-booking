import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { GeocodingService } from '../../src/business/geocoding.service';
import { NotificationsService } from '../../src/notifications/notifications.service';

export const PASSWORD = 'password123';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Boots the real AppModule with external services (Google, SMTP) stubbed. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GeocodingService)
    .useValue({
      geocode: async (address: string) => ({
        lat: 32.08,
        lng: 34.78,
        formattedAddress: address,
      }),
    })
    .overrideProvider(NotificationsService)
    .useValue({ send: jest.fn() })
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export async function resetDatabase(app: INestApplication): Promise<void> {
  await app
    .get(DataSource)
    .query(
      'TRUNCATE users, business, location, slot, booking RESTART IDENTITY CASCADE',
    );
}

export async function signUp(
  app: INestApplication,
  email: string,
): Promise<Tokens> {
  await request(app.getHttpServer())
    .post('/authentication/sign-up')
    .send({ email, password: PASSWORD })
    .expect(201);
  return signIn(app, email);
}

export async function signIn(
  app: INestApplication,
  email: string,
): Promise<Tokens> {
  const res = await request(app.getHttpServer())
    .post('/authentication/sign-in')
    .send({ email, password: PASSWORD })
    .expect(200);
  return res.body;
}

/**
 * Signs up a user, opens a business for them and signs in again so the
 * access token carries the new `business` role.
 */
export async function createOwner(
  app: INestApplication,
  email: string,
  businessName: string,
): Promise<{ tokens: Tokens; businessId: string; slug: string }> {
  const { accessToken } = await signUp(app, email);
  const res = await request(app.getHttpServer())
    .post('/business/open')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      name: businessName,
      description: 'e2e',
      address: `${businessName} street 1`,
      email,
      phone_number: '000',
    })
    .expect(201);
  return {
    tokens: await signIn(app, email),
    businessId: res.body.id,
    slug: res.body.slug,
  };
}

export const bearer = (tokens: Tokens) => `Bearer ${tokens.accessToken}`;

/** A Monday far enough ahead to never be in the past. */
export const FUTURE_DAY = '2030-01-07';

export const DAILY_SCHEDULE = {
  openingHours: '09:00',
  closingHours: '12:00',
  lunchDuration: '0 min',
  timePerClient: '60 min',
  startDate: FUTURE_DAY,
};
