import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';
import * as dotenv from 'dotenv';
dotenv.config();
export const dataSourceOptions = {
  type: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  username: process.env.POSTGRES_USER,
  database: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  port: +process.env.POSTGRES_PORT,
  entities: [join(__dirname, '..') + '/**/*.entity.js'],
  migrations: [join(__dirname, '..') + '/**/migrations/*.js'],
  synchronize: false,
  logging: true,
} as DataSourceOptions;

export default new DataSource(dataSourceOptions);
