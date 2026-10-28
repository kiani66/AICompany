import { describe,it,expect } from 'vitest';
import postgres from 'postgres';
import { execFileSync } from 'node:child_process';
describe('fresh database',()=>{ it('migrates and seeds idempotently with six disabled agents and no activity',async()=>{ if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL required'); for(const script of ['db:migrate','db:seed','db:seed']) execFileSync('npm',['run',script],{stdio:'inherit'}); const sql=postgres(process.env.DATABASE_URL,{max:1}); try { const [a]=await sql`select count(*)::int as count, count(*) filter (where execution_enabled)::int as enabled from agents`; expect(a.count).toBe(6); expect(a.enabled).toBe(0); for(const name of ['projects','tasks','task_executions','approval_requests','agent_reports','usage_records']) { const [r]=await sql.unsafe(`select count(*)::int as count from ${name}`); expect(r.count).toBe(0); } } finally {await sql.end();} },60000); });

describe('security persistence',()=>{ it('atomically limits concurrent attempts and enforces constraints',async()=>{ const sql=postgres(process.env.DATABASE_URL!,{max:20}); try { await sql`delete from login_rate_limits`; const {consumeLoginAttempt,createStoredSession,sessionExists,revokeSession}=await import('../src/lib/security-store'); const outcomes=await Promise.all(Array.from({length:20},()=>consumeLoginAttempt())); expect(outcomes.filter(Boolean)).toHaveLength(10); const [row]=await sql`select attempts from login_rate_limits where key='ceo'`; expect(row.attempts).toBe(10); await expect(sql`insert into login_rate_limits values ('invalid',0,now())`).rejects.toThrow(); await expect(sql`update agents set execution_enabled=true`).rejects.toThrow(); const id=await createStoredSession(); expect(await sessionExists(id)).toBe(true); await revokeSession(id); expect(await sessionExists(id)).toBe(false); await sql`delete from login_rate_limits`; } finally {await sql.end();} },30000); });

describe('application database privileges',()=>{ it('prevents audit rewriting, deletion, truncation and schema changes',async()=>{ const {readFileSync}=await import('node:fs'); const db=postgres(process.env.DATABASE_URL!,{max:1}); try {await db.unsafe(readFileSync('scripts/app-privileges.sql','utf8')); for(const statement of ['update audit_events set event=event','delete from audit_events','truncate audit_events','update simulation_ledger set kind=kind','delete from simulation_ledger','truncate simulation_ledger','create table audit_privilege_test(id int)']) { await expect(db.begin(async tx=>{await tx`set local role aicompany_app`; await tx.unsafe(statement);})).rejects.toThrow(); } const [company]=await db`select id from companies limit 1`; await db.begin(async tx=>{await tx`set local role aicompany_app`; await tx`insert into audit_events (company_id,event) values (${company.id},'privilege test')`;}); await db`delete from audit_events where event='privilege test'`; } finally {await db.end();} },30000); });

it('ledger grants hold for a separate non-owner login',async()=>{ const {randomBytes}=await import('node:crypto'); const owner=postgres(process.env.DATABASE_URL!,{max:1}); const role=`runtime_test_${randomBytes(6).toString('hex')}`; const password=randomBytes(24).toString('hex'); let runtimeDb:ReturnType<typeof postgres>|undefined; try { await owner.unsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`); await owner.unsafe(`GRANT aicompany_app TO "${role}"`); const url=new URL(process.env.DATABASE_URL!); url.username=role;url.password=password;runtimeDb=postgres(url.toString(),{max:1}); const [who]=await runtimeDb`select current_user, session_user`;expect(who.current_user).toBe(role);expect(who.session_user).toBe(role); await runtimeDb`select * from simulation_ledger limit 1`; const [company]=await runtimeDb`select id from companies limit 1`; await runtimeDb`insert into runtime_denials (company_id,actor,operation,reason,policy_version,context,window_start) values (${company.id},'CEO','test','Policy denied','test','{}',date_trunc('minute',now())) on conflict (company_id,operation,reason,window_start) do update set count=runtime_denials.count+1,last_seen=now()`; await runtimeDb`insert into runtime_denials (company_id,actor,operation,reason,policy_version,context,window_start) values (${company.id},'CEO','test','Policy denied','test','{}',date_trunc('minute',now())) on conflict (company_id,operation,reason,window_start) do update set count=runtime_denials.count+1,last_seen=now()`; for(const query of ['update simulation_ledger set kind=kind','delete from simulation_ledger','truncate simulation_ledger','update runtime_denials set reason=reason','delete from runtime_denials']) await expect(runtimeDb.unsafe(query)).rejects.toThrow(); }finally{if(runtimeDb) await runtimeDb.end();await owner`delete from runtime_denials where operation='test' and policy_version='test'`;await owner.unsafe(`DROP ROLE IF EXISTS "${role}"`);await owner.end();} },30000);


it('isolates concurrent login rate limits between Vercel-origin source buckets',async()=>{
 const sql=postgres(process.env.DATABASE_URL!,{max:20});
 const {consumeLoginAttempt}=await import('../src/lib/security-store');
 const a='ceo-ip:'+'a'.repeat(64),b='ceo-ip:'+'b'.repeat(64);
 try{
   await sql`delete from login_rate_limits where key in (${a},${b})`;
   const burst=await Promise.all(Array.from({length:20},()=>consumeLoginAttempt(a)));
   expect(burst.filter(Boolean)).toHaveLength(10);
   expect(await consumeLoginAttempt(a)).toBe(false);
   expect(await consumeLoginAttempt(b)).toBe(true);
   const [other]=await sql`select attempts from login_rate_limits where key=${b}`;
   expect(other.attempts).toBe(1);
   await expect(consumeLoginAttempt('ceo-ip:192.0.2.1')).rejects.toThrow('Invalid login bucket');
 }finally{
   await sql`delete from login_rate_limits where key in (${a},${b})`;
   await sql.end();
 }
},30000);
