import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
let client: ReturnType<typeof drizzle> | undefined;
export function database() { const url = process.env.DATABASE_URL; if (!url) throw new Error('DATABASE_URL is required'); client ??= drizzle(postgres(url, { max: 5, prepare: false })); return client; }
