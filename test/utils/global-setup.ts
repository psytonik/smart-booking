import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

const dirName = dirname(fileURLToPath(import.meta.url));

// Jest runs globalSetup as a standalone module load, outside its normal
// ts-jest-transformed sandbox, so it can't resolve a relative import into
// test-env.ts's compiled output the way regular test files can. This
// duplicates the handful of lines global setup actually needs (test DB name,
// .env) rather than sharing that module; setupFiles (test-env.ts) still
// applies to every actual test file, in its own worker.
dotenv.config({ quiet: true });
process.env.POSTGRES_DB = process.env.POSTGRES_TEST_DB ?? 'smart_booking_test';

/** Recreates the e2e database schema from migrations before the run. */
export default async function globalSetup(): Promise<void> {
  const connection = {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD,
  };
  const database = process.env.POSTGRES_DB;

  const admin = new Client({ ...connection, database: 'postgres' });
  await admin.connect();
  const { rowCount } = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [database],
  );
  if (!rowCount) {
    await admin.query(`CREATE DATABASE "${database}"`);
  }
  await admin.end();

  // Compiled output, not the TS source: matches how migrations actually run
  // in production (npm run migration:run), and avoids loading .ts files
  // in-process, which would need its own ESM-aware TS loader here.
  // `npm run build` runs first (pretest:e2e), so dist/ is current.
  const dist = join(dirName, '..', '..', 'dist');
  const dataSource = new DataSource({
    type: 'postgres',
    ...connection,
    username: connection.user,
    database,
    entities: [join(dist, '**', '*.entity.js')],
    migrations: [join(dist, 'migrations', '*.js')],
  });
  await dataSource.initialize();
  await dataSource.dropDatabase();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
