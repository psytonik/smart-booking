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
import { ActiveUserData } from '../../interface/active-user-data.interface';
import { TokenType } from '../enums/token-type.enum';

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
    let payload: ActiveUserData;
    try {
      payload = await this.jwtService.verifyAsync<ActiveUserData>(token, {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
      });
    } catch (e) {
      throw new UnauthorizedException(e.message);
    }
    // Refresh tokens are signed with the same key; without this check they
    // would be accepted here and carry no email/role claims.
    if (payload.type !== TokenType.Access) {
      throw new UnauthorizedException('Invalid token type');
    }
    request[REQUEST_USER_KEY] = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [_, token] = request.headers.authorization?.split(' ') ?? [];
    return token;
  }
}
