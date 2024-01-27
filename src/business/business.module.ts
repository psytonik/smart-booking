import { Module } from '@nestjs/common';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { Location } from './entities/location.entity';
import { Users } from '../users/entities/user.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, Users, Location]),
    ConfigModule,
  ],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
