import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { Request } from 'express';
import { REQUEST_USER_KEY } from '../../constants/iam.constants';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Not Authenticated');
    }
    try {
      request[REQUEST_USER_KEY] = await this.jwtService.verifyAsync(
        token,
        this.jwtConfiguration,
      );
    } catch (e) {
      throw new UnauthorizedException(e.message);
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [_, token] = request.headers.authorization?.split(' ') ?? [];
    return token;
  }
}
