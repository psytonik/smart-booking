import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { SlotManagementModule } from './slot-management/slot-management.module';
import { BookingModule } from './booking/booking.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IamModule } from './iam/iam.module';
import { BusinessModule } from './business/business.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';

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
    SlotManagementModule,
    BookingModule,
    UsersModule,
    NotificationsModule,
    IamModule,
    BusinessModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
