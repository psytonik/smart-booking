import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';

const configService = new ConfigService();
const PORT = configService.get('APP_PORT');
async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule);
  app.enableCors();
  app.use(compression());
  app.useGlobalPipes(new ValidationPipe());
  const config = new DocumentBuilder()
    .setTitle('Smart Booking Api')
    .setDescription('Api for book services')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);
  await app.listen(PORT);
}
bootstrap().then(() => console.log(`App running on port ${PORT}`));
