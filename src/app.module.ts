import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import Joi from 'joi';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { ServicesModule } from './services/services.module.js';
import { UsersModule } from './users/users.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { IamModule } from './iam/iam.module.js';
import { BusinessModule } from './business/business.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthModule } from './health/health.module.js';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './redis/redis-throttler-storage.service.js';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis/redis.constants.js';
import { AuthenticationController } from './iam/authentication/authentication.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        APP_PORT: Joi.number().default(3000),
        // Comma-separated list of allowed browser origins. Unset: any origin
        // in development, none (same-origin only) in production.
        CORS_ORIGINS: Joi.string().optional(),
        // Swagger UI at /docs; defaults to on outside production.
        SWAGGER_ENABLED: Joi.boolean().optional(),

        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),

        JWT_SECRET: Joi.string().required(),
        JWT_AUDIENCE: Joi.string().required(),
        JWT_TOKEN_ISSUER: Joi.string().required(),
        JWT_ACCESS_TTL: Joi.number().default(3600),
        JWT_REFRESH_TTL: Joi.number().default(86400),

        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        REDIS_DB: Joi.number().integer().min(0).default(0),

        // Rate limiting, per client IP, over a sliding window.
        THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
        THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
        // Stricter limit for /authentication/* (sign-in brute force).
        AUTH_THROTTLE_LIMIT: Joi.number().integer().min(1).default(10),
        // Express "trust proxy" (e.g. 1 behind one load balancer), so rate
        // limits key on the real client IP instead of the proxy's.
        TRUST_PROXY: Joi.alternatives(Joi.number(), Joi.boolean()).optional(),

        GOOGLE_API_KEY: Joi.string().required(),
        GOOGLE_OAUTH_CLIENT_ID: Joi.string().required(),
        GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_REFRESH_TOKEN: Joi.string().required(),
        SMTP_USER: Joi.string().required(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: configService.get('POSTGRES_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        // Entities come from each module's TypeOrmModule.forFeature();
        // src/config/data-source.ts is only for the migration CLI.
        autoLoadEntities: true,
        synchronize: false,
        logging:
          configService.get('NODE_ENV') === 'development' ||
          !!process.env.DEBUG_SQL,
      }),
    }),
    RedisModule,
    HealthModule,
    ThrottlerModule.forRootAsync({
      // Explicit empty array: @nestjs/throttler@6.7's .d.ts imports
      // ModuleMetadata via the `@nestjs/common/interfaces` subpath, which
      // @nestjs/common@12's exports map no longer exposes under `nodenext`
      // resolution — TS can't resolve that type and falls back to treating
      // `imports` as required. Harmless either way: we don't need it here.
      imports: [],
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (configService: ConfigService, redis: Redis) => {
        const ttl =
          configService.getOrThrow<number>('THROTTLE_TTL_SECONDS') * 1000;
        return {
          throttlers: [
            {
              name: 'default',
              ttl,
              limit: configService.getOrThrow<number>('THROTTLE_LIMIT'),
            },
            {
              name: 'auth',
              ttl,
              limit: configService.getOrThrow<number>('AUTH_THROTTLE_LIMIT'),
              skipIf: (context) =>
                context.getClass() !== AuthenticationController,
            },
          ],
          storage: new RedisThrottlerStorage(redis),
        };
      },
    }),
    ServicesModule,
    SchedulingModule,
    UsersModule,
    NotificationsModule,
    IamModule,
    BusinessModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
