import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Share one small pool for Drizzle and raw SQL commands per warm function
// instance. This is NOT a replacement for a managed serverless PG pooler.
let rawClient:ReturnType<typeof postgres>|undefined;
let client:ReturnType<typeof drizzle>|undefined;
export function sqlClient(){
  const url=process.env.DATABASE_URL;
  if(!url)throw new Error('DATABASE_URL is required');
  if(process.env.NODE_ENV==='production' && process.env.DATABASE_MIGRATION_URL)
    throw new Error('Migration-owner credentials must not be present in application runtime');
  return rawClient ??= postgres(url,{
    max:process.env.VERCEL==='1'?2:5,
    prepare:false,
    connect_timeout:5,
    idle_timeout:20,
  });
}
export function database(){
  return client ??= drizzle(sqlClient());
}
