import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SignUpDto } from './dto/sign-up.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from '../../users/entities/user.entity.js';
import { Repository } from 'typeorm';
import { HashingService } from '../hashing/hashing.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../config/jwt.config.js';
import type { ConfigType } from '@nestjs/config';
import { ActiveUserData } from '../interface/active-user-data.interface.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import {
  InvalidatedRefreshTokenError,
  RefreshTokenIdsStorage,
} from './storage/refresh-token-ids.storage.js';
import { randomUUID } from 'crypto';
import { TokenType } from './enums/token-type.enum.js';
import { errorMessage } from '../../common/error-message.js';

@Injectable()
export class AuthenticationService {
  // Hash of a random secret, compared against when the email is unknown so
  // sign-in costs the same bcrypt round either way. Assigned in the
  // constructor body, not as a field initializer: under ES2022 output
  // (required by NodeNext), field initializers run before constructor
  // parameter properties are assigned, so `this.hashingService` would still
  // be undefined at this point if declared as a field.
  private readonly dummyHash: Promise<string>;

  constructor(
    @InjectRepository(Users) private readonly userRepository: Repository<Users>,
    private readonly hashingService: HashingService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly refreshTokenIdsStorage: RefreshTokenIdsStorage,
  ) {
    this.dummyHash = this.hashingService.hash(randomUUID());
  }

  async signUp(signUpDto: SignUpDto): Promise<Users> {
    try {
      const newUser: Users = new Users();
      newUser.email = signUpDto.email;
      newUser.password = await this.hashingService.hash(signUpDto.password);
      // Response DTOs never expose the password; returning the saved entity
      // is safe.
      return await this.userRepository.save(newUser);
    } catch (e) {
      const pgUniqueViolationErrorCode = '23505';
      if ((e as { code?: string }).code === pgUniqueViolationErrorCode) {
        throw new ConflictException(
          `User with this email ${signUpDto.email} already exists`,
        );
      }
      throw e;
    }
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: signInDto.email })
      .getOne();
    // Same message and a hash comparison either way, so the response doesn't
    // reveal whether the email is registered.
    const isEqual: boolean = await this.hashingService.compare(
      signInDto.password,
      user?.password ?? (await this.dummyHash),
    );
    if (!user || !isEqual) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return await this.generateTokens(user);
  }

  private async signToken<T>(
    userId: number,
    expiresIn: number,
    payload?: T,
  ): Promise<string> {
    return await this.jwtService.signAsync(
      {
        sub: userId,
        ...payload,
      },
      {
        issuer: this.jwtConfiguration.issuer,
        audience: this.jwtConfiguration.audience,
        secret: this.jwtConfiguration.secret,
        expiresIn,
      },
    );
  }

  async generateTokens(user: Users) {
    const refreshTokenId = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken<Partial<ActiveUserData>>(
        user.id,
        this.jwtConfiguration.accessTokenTtl,
        { email: user.email, role: user.role, type: TokenType.Access },
      ),
      this.signToken(user.id, this.jwtConfiguration.refreshTokenTtl, {
        refreshTokenId,
        type: TokenType.Refresh,
      }),
    ]);
    await this.refreshTokenIdsStorage.insert(
      user.id,
      refreshTokenId,
      this.jwtConfiguration.refreshTokenTtl,
    );
    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { sub, refreshTokenId } = await this.verifyRefreshToken(
      refreshTokenDto.refreshToken,
    );
    const user = await this.userRepository.findOneBy({ id: sub });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    try {
      await this.refreshTokenIdsStorage.validate(user.id, refreshTokenId);
    } catch (e) {
      if (e instanceof InvalidatedRefreshTokenError) {
        throw new UnauthorizedException('Access denied');
      }
      throw e;
    }
    await this.refreshTokenIdsStorage.invalidate(user.id, refreshTokenId);
    return await this.generateTokens(user);
  }

  /** Ends the session the refresh token belongs to. Idempotent. */
  async logout(refreshTokenDto: RefreshTokenDto): Promise<void> {
    const { sub, refreshTokenId } = await this.verifyRefreshToken(
      refreshTokenDto.refreshToken,
    );
    await this.refreshTokenIdsStorage.invalidate(sub, refreshTokenId);
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<{ sub: number; refreshTokenId: string }> {
    let payload: Pick<ActiveUserData, 'sub' | 'type'> & {
      refreshTokenId: string;
    };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.jwtConfiguration.secret,
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
      });
    } catch (e) {
      throw new UnauthorizedException(errorMessage(e));
    }
    if (payload.type !== TokenType.Refresh) {
      throw new UnauthorizedException('Invalid token type');
    }
    return payload;
  }
}
