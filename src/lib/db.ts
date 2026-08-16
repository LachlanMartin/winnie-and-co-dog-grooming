import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof createDb> };

function createDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  // max:1 keeps serverless functions from exhausting connections; use Neon's
  // pooled (-pooler) URL on Vercel with this and you stay under PgBouncer limits.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
  });
  return drizzle(pool, { schema });
}

// Lazy init via Proxy: importing this module never throws, so the SSR build
// succeeds without DATABASE_URL set (the app only touches the DB at request
// time). The first real query still throws if DATABASE_URL is missing.
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_t, prop) {
    if (!globalForDb.__db) globalForDb.__db = createDb();
    return Reflect.get(globalForDb.__db, prop, globalForDb.__db);
  },
});
