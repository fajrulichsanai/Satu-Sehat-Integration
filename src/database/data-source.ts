import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

const baseDir = process.cwd();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'dental_clinic',
  entities: [join(baseDir, 'dist/**/*.entity{.ts,.js}')],
  migrations: [join(baseDir, 'dist/database/migrations/*{.ts,.js}')],
  synchronize: false,
});
