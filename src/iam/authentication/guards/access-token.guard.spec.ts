import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard } from './access-token.guard';
import { TokenType } from '../enums/token-type.enum';
import { REQUEST_USER_KEY } from '../../constants/iam.constants';

describe('AccessTokenGuard', () => {
  const jwtConfiguration = {
    secret: 'test-secret',
    audience: 'test-aud',
    issuer: 'test-iss',
    accessTokenTtl: 3600,
    refreshTokenTtl: 86400,
  };
  const jwtService = new JwtService();
  const guard = new AccessTokenGuard(jwtService, jwtConfiguration);

  const sign = (payload: object) =>
    jwtService.signAsync(payload, {
      secret: jwtConfiguration.secret,
      audience: jwtConfiguration.audience,
      issuer: jwtConfiguration.issuer,
      expiresIn: 60,
    });

  const contextFor = (token?: string) => {
    const request = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as any,
    };
  };

  it('accepts an access token and exposes its claims', async () => {
    const token = await sign({
      sub: 7,
      email: 'a@b.c',
      role: 'client',
      type: TokenType.Access,
    });
    const { request, context } = contextFor(token);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request[REQUEST_USER_KEY]).toMatchObject({ sub: 7 });
  });

  it('rejects a refresh token used as a bearer token', async () => {
    const token = await sign({
      sub: 7,
      refreshTokenId: 'x',
      type: TokenType.Refresh,
    });

    await expect(guard.canActivate(contextFor(token).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token without a type claim (issued before the fix)', async () => {
    const token = await sign({ sub: 7, refreshTokenId: 'x' });

    await expect(guard.canActivate(contextFor(token).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const token = await jwtService.signAsync(
      { sub: 7, type: TokenType.Access },
      { secret: 'other', audience: 'test-aud', issuer: 'test-iss' },
    );

    await expect(guard.canActivate(contextFor(token).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
