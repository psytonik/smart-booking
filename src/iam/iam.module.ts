import { Module } from '@nestjs/common';
import { HashingService } from './hashing/hashing.service.js';
import { AuthenticationController } from './authentication/authentication.controller.js';
import { AuthenticationService } from './authentication/authentication.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from '../users/entities/user.entity.js';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from './config/jwt.config.js';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard } from './authentication/guards/authentication.guard.js';
import { AccessTokenGuard } from './authentication/guards/access-token.guard.js';
import { RefreshTokenIdsStorage } from './authentication/storage/refresh-token-ids.storage.js';
import { RolesGuard } from './authorization/guards/roles.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users]),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(jwtConfig),
  ],
  providers: [
    HashingService,
    AuthenticationService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    AccessTokenGuard,
    RefreshTokenIdsStorage,
  ],
  controllers: [AuthenticationController],
})
export class IamModule {}
