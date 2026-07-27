import { Pool, types } from 'pg';
import { env } from './env';

types.setTypeParser(1082, (val: string) => val);
types.setTypeParser(1114, (val: string) => val);

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
