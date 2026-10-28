import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
async function main() { const url=process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL; if (!url) throw new Error('DATABASE_MIGRATION_URL or DATABASE_URL is required'); const sql = postgres(url, { max: 1 }); try { await migrate(drizzle(sql), { migrationsFolder: './drizzle' }); } finally { await sql.end(); } }
main().catch(e => { console.error(e); process.exitCode=1; });
