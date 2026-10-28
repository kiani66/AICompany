import { sql, eq, gt, and, lt } from 'drizzle-orm';
import { database } from '@/db/client';
import { sessions } from '@/db/schema';
import { randomUUID } from 'node:crypto';
// A single CEO account has one shared bucket. Never derive identity from client headers.
export async function consumeLoginAttempt(): Promise<boolean> {
 const db=database(); const result=await db.execute(sql`INSERT INTO login_rate_limits (key, attempts, expires_at) VALUES ('ceo', 1, now() + interval '15 minutes') ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN login_rate_limits.expires_at <= now() THEN 1 ELSE login_rate_limits.attempts + 1 END, expires_at = CASE WHEN login_rate_limits.expires_at <= now() THEN now() + interval '15 minutes' ELSE login_rate_limits.expires_at END WHERE login_rate_limits.expires_at <= now() OR login_rate_limits.attempts < 10 RETURNING attempts`); return result.length === 1;
}
export async function createStoredSession() { const db=database(); await db.delete(sessions).where(lt(sessions.expiresAt,sql`now()`)); const id=randomUUID(); await db.insert(sessions).values({id,expiresAt:new Date(Date.now()+8*60*60*1000)}); return id; }
export async function sessionExists(id:string) { const [row]=await database().select({id:sessions.id}).from(sessions).where(and(eq(sessions.id,id),gt(sessions.expiresAt,sql`now()`))).limit(1); return !!row; }
export async function revokeSession(id:string) { await database().delete(sessions).where(eq(sessions.id,id)); }
