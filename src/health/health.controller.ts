import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { Auth } from '../iam/authentication/decorator/auth.decorator.js';
import { AuthType } from '../iam/authentication/enums/auth-type.enum.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { errorMessage } from '../common/error-message.js';

@ApiTags('Health')
@Auth(AuthType.None)
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.checkRedis(),
    ]);
  }

  private async checkRedis() {
    const indicator = this.healthIndicatorService.check('redis');
    try {
      await this.redis.ping();
      return indicator.up();
    } catch (e) {
      return indicator.down({ message: errorMessage(e) });
    }
  }
}
