import { registerAs } from '@nestjs/config';
import * as process from 'process';

export default registerAs('jwt', () => {
  return {
    secret: process.env.JWT_SECRET,
    audience: process.env.JWT_AUDIENCE,
    issuer: process.env.JWT_TOKEN_ISSUER,
    accessTokenTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '360000', 10),
    refreshTokenTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '86400', 10),
  };
});
