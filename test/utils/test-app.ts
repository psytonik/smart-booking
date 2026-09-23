import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../src/redis/redis.constants.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { GeocodingService } from '../../src/business/geocoding.service.js';
import { NotificationsService } from '../../src/notifications/notifications.service.js';

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
      geocode: async (address: string) => {
        if (address.includes('nowhere')) {
          throw new Error('address not found');
        }
        return { lat: 32.08, lng: 34.78, formattedAddress: address };
      },
    })
    .overrideProvider(NotificationsService)
    .useValue({ send: jest.fn() })
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  // Listen up front: supertest otherwise starts the server per request,
  // which races when tests fire requests in parallel.
  await app.listen(0);
  return app;
}

export async function resetDatabase(app: INestApplication): Promise<void> {
  await app.get<Redis>(REDIS_CLIENT).flushdb();
  await app
    .get(DataSource)
    .query(
      'TRUNCATE users, business, location, service, staff_service, working_hours, schedule_override, time_block, booking RESTART IDENTITY CASCADE',
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
  timezone = 'Europe/Berlin',
  currency = 'EUR',
): Promise<{
  tokens: Tokens;
  businessId: string;
  slug: string;
  userId: number;
}> {
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
      timezone,
      currency,
    })
    .expect(201);
  return {
    tokens: await signIn(app, email),
    businessId: res.body.id,
    slug: res.body.slug,
    userId: res.body.owner.id,
  };
}

/**
 * Makes an existing user an employee of a business. There is no API for this
 * yet (roadmap E1), so it goes straight to the database.
 */
export async function makeEmployee(
  app: INestApplication,
  email: string,
  businessId: string,
): Promise<{ tokens: Tokens; userId: number }> {
  await signUp(app, email);
  // For UPDATE ... RETURNING, TypeORM's postgres driver returns [rows, count].
  const [rows] = await app
    .get(DataSource)
    .query(
      `UPDATE users SET role = 'employee', "workplaceId" = $1 WHERE email = $2 RETURNING id`,
      [businessId, email],
    );
  // Sign in again so the access token carries the employee role.
  return { tokens: await signIn(app, email), userId: rows[0].id };
}

export const bearer = (tokens: Tokens) => `Bearer ${tokens.accessToken}`;

/** A Monday far enough ahead to never be in the past. */
export const FUTURE_DAY = '2030-01-07';

/** Mon–Fri 09:00–17:00. */
export const WEEKDAY_HOURS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
].map((weekday) => ({
  weekday,
  intervals: [{ start: '09:00', end: '17:00' }],
}));

export async function setWorkingHours(
  app: INestApplication,
  tokens: Tokens,
  days: unknown[] = WEEKDAY_HOURS,
  staffId?: number,
): Promise<void> {
  await request(app.getHttpServer())
    .put('/schedule/working-hours')
    .set('Authorization', bearer(tokens))
    .send({ days, staffId })
    .expect(200);
}

/** Creates a service and assigns it to the given staff members. */
export async function createService(
  app: INestApplication,
  owner: Tokens,
  staff: { staffId: number; [override: string]: number }[],
  service: Record<string, unknown> = {},
): Promise<string> {
  const created = await request(app.getHttpServer())
    .post('/services')
    .set('Authorization', bearer(owner))
    .send({
      name: 'Haircut',
      duration_minutes: 30,
      buffer_minutes: 0,
      price_minor: 8000,
      ...service,
    })
    .expect(201);
  await request(app.getHttpServer())
    .put(`/services/${created.body.id}/staff`)
    .set('Authorization', bearer(owner))
    .send({ staff })
    .expect(200);
  return created.body.id;
}

export async function availability(
  app: INestApplication,
  businessId: string,
  query: Record<string, string | number>,
): Promise<
  { start: string; end: string; staffId: number; price_minor: number }[]
> {
  const res = await request(app.getHttpServer())
    .get(`/booking/business/${businessId}/availability`)
    .query(query)
    .expect(200);
  return res.body;
}

/** "HH:mm" in UTC, for compact assertions. */
export const utcTimes = (items: { start: string }[]) =>
  items.map((i) => i.start.slice(11, 16));
