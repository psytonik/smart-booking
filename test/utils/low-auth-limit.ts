// Imported first by throttling.e2e-spec.ts: ConfigModule validates the
// environment when AppModule is imported, so this has to run before that.
process.env.AUTH_THROTTLE_LIMIT = '3';
