import { randomUUID } from 'crypto';

// Loaded before every e2e file and by the global setup. Always points at a
// dedicated database so e2e runs can never touch the development one.
process.env.NODE_ENV = 'test';
process.env.POSTGRES_DB = process.env.POSTGRES_TEST_DB ?? 'smart_booking_test';
// A separate Redis database, flushed between files (see resetDatabase).
process.env.REDIS_DB = process.env.REDIS_TEST_DB ?? '1';
// Tests sign in far more often than a real client would.
process.env.THROTTLE_LIMIT ??= '10000';
process.env.AUTH_THROTTLE_LIMIT ??= '10000';

// Placeholders for values the e2e run needs but never uses for real (Google
// and SMTP are stubbed; JWTs only have to verify within this process). They
// are generated per run so no credential-looking literal sits in the repo.
// POSTGRES_PASSWORD has no default: it must come from the environment (CI)
// or .env (local).
const placeholder = () => randomUUID();
const defaults: Record<string, string> = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'postgres',
  JWT_SECRET: placeholder(),
  JWT_AUDIENCE: 'e2e',
  JWT_TOKEN_ISSUER: 'e2e',
  GOOGLE_API_KEY: placeholder(),
  GOOGLE_OAUTH_CLIENT_ID: placeholder(),
  GOOGLE_OAUTH_CLIENT_SECRET: placeholder(),
  GOOGLE_REFRESH_TOKEN: placeholder(),
  SMTP_USER: 'e2e@example.com',
};

// Real values from the environment or .env win over these placeholders.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ quiet: true });
for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
