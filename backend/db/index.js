import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { DATABASE_URL } from '../src/config/constants.js';
import * as schema from './schema/index.js';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export { pool };
