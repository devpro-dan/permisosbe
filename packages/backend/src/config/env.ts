import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseDatabaseUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      DB_HOST: u.hostname,
      DB_PORT: parseInt(u.port || '5432', 10),
      DB_NAME: u.pathname.replace(/^\//, ''),
      DB_USER: decodeURIComponent(u.username),
      DB_PASSWORD: decodeURIComponent(u.password),
    };
  } catch {
    return null;
  }
}

const dbUrlParsed = process.env.DATABASE_URL ? parseDatabaseUrl(process.env.DATABASE_URL) : null;

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DB_HOST: dbUrlParsed?.DB_HOST || process.env.DB_HOST || 'localhost',
  DB_PORT: dbUrlParsed?.DB_PORT || parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: dbUrlParsed?.DB_NAME || process.env.DB_NAME || 'permisosbe',
  DB_USER: dbUrlParsed?.DB_USER || process.env.DB_USER || 'postgres',
  DB_PASSWORD: dbUrlParsed?.DB_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
};
