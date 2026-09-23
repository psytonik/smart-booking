import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../../users/enums/role.enum.js';
import { Users } from '../../../users/entities/user.entity.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { ActiveUserData } from '../../interface/active-user-data.interface.js';
import { REQUEST_USER_KEY } from '../../constants/iam.constants.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const contextRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!contextRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const tokenUser: ActiveUserData | undefined = request[REQUEST_USER_KEY];
    if (!tokenUser) {
      // @Roles on a route that is also @Auth(AuthType.None).
      throw new UnauthorizedException('Only for Authenticated users');
    }
    // The role in the access token can be up to an hour stale (e.g. right
    // after opening a business, or after a demotion), so check the current
    // one. One primary-key lookup, only on role-restricted routes.
    const user = await this.userRepository.findOne({
      select: { id: true, role: true },
      where: { id: tokenUser.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    request[REQUEST_USER_KEY] = { ...tokenUser, role: user.role };
    return contextRoles.includes(user.role);
  }
}
