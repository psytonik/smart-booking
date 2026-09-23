import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';
import * as dotenv from 'dotenv';

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
  entities: [join(__dirname, '..') + '/**/*.entity.js'],
  migrations: [join(__dirname, '..', 'migrations', '*.js')],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
} as DataSourceOptions;

export default new DataSource(dataSourceOptions);
