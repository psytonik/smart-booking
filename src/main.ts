import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, Logger } from '@nestjs/common';
import { configureApp } from './app.setup';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const swaggerEnabled =
    configService.get<boolean>('SWAGGER_ENABLED') ?? !isProduction;

  // Swagger UI relies on inline scripts, which helmet's default CSP blocks.
  app.use(
    helmet({ contentSecurityPolicy: swaggerEnabled ? false : undefined }),
  );
  app.enableCors({ origin: corsOrigin(configService, isProduction) });
  app.use(compression());
  app.enableShutdownHooks();
  configureApp(app);

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Smart Booking Api')
      .setDescription('Api for book services')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = configService.get<number>('APP_PORT');
  await app.listen(port);
  Logger.log(`App running on port ${port}`, 'Bootstrap');
}

function corsOrigin(
  configService: ConfigService,
  isProduction: boolean,
): string[] | boolean {
  const origins = configService.get<string>('CORS_ORIGINS');
  if (origins) {
    return origins.split(',').map((origin) => origin.trim());
  }
  return !isProduction;
}

bootstrap().catch((e) => {
  console.error('Failed to start application', e);
  process.exit(1);
});
