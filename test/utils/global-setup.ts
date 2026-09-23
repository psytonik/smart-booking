import { join } from 'path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import 'ts-node/register/transpile-only';
import './test-env';

/** Recreates the e2e database schema from migrations before the run. */
export default async function globalSetup(): Promise<void> {
  const connection = {
    host: process.env.POSTGRES_HOST,
    port: +process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
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

  const src = join(__dirname, '..', '..', 'src');
  const dataSource = new DataSource({
    type: 'postgres',
    ...connection,
    username: connection.user,
    database,
    entities: [join(src, '**', '*.entity.ts')],
    migrations: [join(src, 'migrations', '*.ts')],
  });
  await dataSource.initialize();
  await dataSource.dropDatabase();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
