// Loaded before every e2e file and by the global setup. Always points at a
// dedicated database so e2e runs can never touch the development one.
process.env.NODE_ENV = 'test';
process.env.POSTGRES_DB = process.env.POSTGRES_TEST_DB ?? 'smart_booking_test';

const defaults: Record<string, string> = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASSWORD: 'postgres',
  JWT_SECRET: 'e2e-secret',
  JWT_AUDIENCE: 'e2e',
  JWT_TOKEN_ISSUER: 'e2e',
  GOOGLE_API_KEY: 'unused-in-e2e',
  GOOGLE_OAUTH_CLIENT_ID: 'unused-in-e2e',
  GOOGLE_OAUTH_CLIENT_SECRET: 'unused-in-e2e',
  GOOGLE_REFRESH_TOKEN: 'unused-in-e2e',
  SMTP_USER: 'e2e@example.com',
};

// Real values from the environment or .env win over these placeholders.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ quiet: true });
for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
