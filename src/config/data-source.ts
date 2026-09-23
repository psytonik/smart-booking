import { DataSource, DataSourceOptions } from 'typeorm';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// ESM has no __dirname; derive the same thing from import.meta.url. This
// file always runs compiled (dist/config/data-source.js), so the path is
// the compiled location, same as __dirname was before.
const dirName = dirname(fileURLToPath(import.meta.url));

// Used by the TypeORM CLI (migrations) only; the app configures its
// connection in AppModule from the validated ConfigService.
dotenv.config({ quiet: true });
export const dataSourceOptions = {
  type: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  username: process.env.POSTGRES_USER,
  database: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  entities: [join(dirName, '..') + '/**/*.entity.js'],
  migrations: [join(dirName, '..', 'migrations', '*.js')],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
} as DataSourceOptions;

export default new DataSource(dataSourceOptions);
