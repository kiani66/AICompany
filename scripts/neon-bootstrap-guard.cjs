/* eslint-disable @typescript-eslint/no-require-imports -- Node-only CommonJS CLI and node:test */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const TARGET = Object.freeze({
  project:'jolly-paper-27220159', branch:'br-quiet-feather-b7ew3f2r',
  database:'neondb', owner:'neondb_owner', runtime:'aicompany_runtime_restricted', group:'aicompany_app',
  directHost:'ep-quiet-rice-b7flg3cr.c-13.us-east-1.aws.neon.tech',
  pooledHost:'ep-quiet-rice-b7flg3cr-pooler.c-13.us-east-1.aws.neon.tech'
});
const TABLES = 'companies agents agent_capabilities agent_reports usage_records task_executions execution_checkpoints projects approval_requests tasks task_dependencies sessions login_rate_limits audit_events runtime_settings runtime_budgets simulation_runs simulation_ledger runtime_denials pm_handoffs pm_artifacts'.split(' ');
const SAFE_SCHEMAS = new Set(['public','drizzle','neon_auth']);
const ACL = Object.freeze({
  companies:'S', agents:'S', agent_capabilities:'S', agent_reports:'S',
  usage_records:'S', task_executions:'S', execution_checkpoints:'S',
  projects:'SIU', approval_requests:'SIU',
  tasks:'SIUD', task_dependencies:'SIUD', sessions:'SIUD', login_rate_limits:'SIUD',
  audit_events:'SI', runtime_settings:'SIU', runtime_budgets:'SIU',
  simulation_runs:'SIU', simulation_ledger:'SI', runtime_denials:'SI',
  pm_handoffs:'SI', pm_artifacts:'SI'
      });

function must(ok,msg) { if(!ok) throw new Error(msg); }
function identity(raw,kind) {
  must(typeof raw === 'string' && raw.length > 0,'Missing database credential');
  let u; try { u = new URL(raw); } catch { throw new Error('Malformed database URL'); }
  must(['postgres:','postgresql:'].includes(u.protocol) && !!u.password,'Invalid database URL');
  must(!u.port || u.port==='5432','Unexpected port');
  must(u.pathname==='/'+TARGET.database,'Wrong database');
  must(['require','verify-full'].includes(u.searchParams.get('sslmode')),'TLS required');
  must([...u.searchParams.keys()].every(k=>['sslmode','channel_binding'].includes(k)),'Unexpected connection parameters');
  const role=decodeURIComponent(u.username);
  must(role===(kind==='owner'?TARGET.owner:TARGET.runtime),'Wrong login');
  must((kind==='owner'?[TARGET.directHost]:[TARGET.directHost,TARGET.pooledHost]).includes(u.hostname),'Wrong Neon endpoint');
  return {role,host:u.hostname};
}
function validateRoles(runtime,group,members,dbOwner,objectCount) {
  must(runtime && group,'Missing required roles');
  must(runtime.rolname===TARGET.runtime && group.rolname===TARGET.group,'Role mismatch');
  must(runtime.rolcanlogin===true && group.rolcanlogin===false,'LOGIN policy violated');
  for (const r of [runtime,group]) {
    must(!r.rolsuper && !r.rolcreatedb && !r.rolcreaterole &&
      !r.rolreplication && !r.rolbypassrls,'Elevated role flags: '+r.rolname);
  }
  must(members.length===1 && members[0]===TARGET.group,'Unexpected inherited role membership');
  must(dbOwner!==TARGET.runtime && Number(objectCount)===0,'Runtime owns database objects');
}
function manifest(root=process.cwd()) {
  const journal=JSON.parse(fs.readFileSync(path.join(root,'drizzle/meta/_journal.json'),'utf8'));
  must(journal.entries.length===11,'Expected 11 migrations');
  return journal.entries.map((e,i)=>{
    must(e.idx===i && /^00\d\d_[a-z0-9_]+$/.test(e.tag),'Unexpected migration journal');
    const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'drizzle',e.tag+'.sql'))).digest('hex');
    return {hash,when:e.when};
  });
}
function validateHistory(history,expected,complete) {
  must(history.length<=expected.length,'Unexpected migration count');
  history.forEach((row,i)=>must(row.hash===expected[i].hash && Number(row.created_at)===expected[i].when,
    'Migration hash/timestamp mismatch at '+i));
  if(complete) must(history.length===11,'Missing migrations');
}
function validateTables(actual,complete,hasHistory) {
  must(actual.every(t=>TABLES.includes(t)),'Unexpected public schema relation');
  if(!hasHistory) must(actual.length===0,'Unmanaged public schema');
  if(complete) must(actual.length===TABLES.length && TABLES.every(t=>actual.includes(t)),'Incomplete schema');
}
async function check(phase,env=process.env) {
  must(['pre','post'].includes(phase),'Invalid phase');
  must(env.EXPECTED_NEON_PROJECT_ID===TARGET.project && env.EXPECTED_NEON_BRANCH_ID===TARGET.branch,'Wrong project or branch');
  identity(env.DATABASE_MIGRATION_URL,'owner'); identity(env.DATABASE_URL,'runtime');
  must(env.DATABASE_MIGRATION_URL!==env.DATABASE_URL,'Credentials must be separated');
  const postgres=require('postgres');
  const owner=postgres(env.DATABASE_MIGRATION_URL,{max:1,connect_timeout:10});
  const app=postgres(env.DATABASE_URL,{max:1,connect_timeout:10});
  try {
    const o=(await owner.unsafe("SELECT current_database() db,current_user role,current_setting('server_version_num')::int ver"))[0];
    const a=(await app.unsafe('SELECT current_database() db,current_user role'))[0];
    must(o.db===TARGET.database && a.db===TARGET.database && o.role===TARGET.owner && a.role===TARGET.runtime,
      'Effective database or role mismatch');
    must(o.ver>=160000,'Unsupported PostgreSQL');
    const roles=await owner.unsafe("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN ('aicompany_runtime_restricted','aicompany_app')");
    const members=await owner.unsafe("SELECT rolname FROM pg_roles WHERE oid <> (SELECT oid FROM pg_roles WHERE rolname='aicompany_runtime_restricted') AND pg_has_role('aicompany_runtime_restricted',oid,'MEMBER')");
    const ownership=(await owner.unsafe("SELECT (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) db_owner,(SELECT count(*) FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname='aicompany_runtime_restricted'))+(SELECT count(*) FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname='aicompany_runtime_restricted')) objects"))[0];
    validateRoles(roles.find(x=>x.rolname===TARGET.runtime),roles.find(x=>x.rolname===TARGET.group),
      members.map(x=>x.rolname).sort(),ownership.db_owner,ownership.objects);
    const schemas=await owner.unsafe("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema'");
    must(schemas.every(s=>SAFE_SCHEMAS.has(s.nspname)),'Unexpected database schema');
    const rel=await owner.unsafe("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')");
    const present=(await owner.unsafe("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS ok"))[0].ok;
    const history=present ? await owner.unsafe('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at,id') : [];
    validateHistory(history,manifest(),phase==='post');
    validateTables(rel.map(x=>x.relname),phase==='post',present);
    if(phase==='post') {
      const counts=(await app.unsafe('SELECT count(*)::int total,count(*) FILTER(WHERE execution_enabled)::int enabled FROM public.agents'))[0];
      must(counts.total===6 && counts.enabled===0,'Expected six disabled agents');
      // Exact table-level allowlist from scripts/app-privileges.sql: fail on
      // missing required privileges AND on any surplus (incl. TRUNCATE/DDL).
      const flags = {SELECT:'S',INSERT:'I',UPDATE:'U',DELETE:'D',TRUNCATE:'T',REFERENCES:'R',TRIGGER:'G'};
      for (const [table, policy] of Object.entries(ACL)) {
        for (const [priv, code] of Object.entries(flags)) {
          const result=(await app.unsafe('SELECT has_table_privilege(current_user,$1,$2) ok',['public.'+table,priv]))[0];
          must(result.ok===policy.includes(code),'Wrong table privilege: '+table+'/'+priv);
        }
      }
      for(const [t,c,expected] of [['pm_handoffs','version',true],['pm_handoffs','brief',false],
        ['runtime_denials','count',true],['runtime_denials','reason',false]]) {
        const result=(await app.unsafe("SELECT has_column_privilege(current_user,$1,$2,'UPDATE') ok",['public.'+t,c]))[0];
        must(result.ok===expected,'Wrong column privilege: '+t+'/'+c);
      }
      const create=(await app.unsafe("SELECT has_schema_privilege(current_user,'public','CREATE') ok"))[0];
      must(!create.ok,'Runtime can create schema objects');
      const dbPriv=(await app.unsafe("SELECT has_database_privilege(current_user,current_database(),'CREATE') db_create,has_database_privilege(current_user,current_database(),'TEMPORARY') db_temp"))[0];
      must(!dbPriv.db_create && !dbPriv.db_temp,'Runtime has database CREATE/TEMP');
      // All probes are inside rollback-only transactions. A successful command
      // triggers an exception and rollback, never a persistent state change.
      const probes=[
        'UPDATE public.audit_events SET event=event WHERE false',
        'DELETE FROM public.audit_events WHERE false',
        'TRUNCATE public.audit_events',
        'UPDATE public.pm_artifacts SET content=content WHERE false',
        'DELETE FROM public.pm_artifacts WHERE false',
        'TRUNCATE public.pm_artifacts',
        'UPDATE public.agents SET execution_enabled=true WHERE false',
        'CREATE TABLE public.aicompany_permission_probe(id integer)',
        'CREATE SCHEMA aicompany_permission_probe',
        'CREATE ROLE aicompany_permission_probe NOLOGIN',
        'CREATE TEMP TABLE aicompany_permission_probe(id integer)',
        'UPDATE public.runtime_denials SET reason=reason WHERE false',
        'UPDATE public.pm_handoffs SET brief=brief WHERE false',
        'DELETE FROM public.companies WHERE false',
        'ALTER TABLE public.audit_events ADD COLUMN aicompany_permission_probe integer',
        'DROP TABLE public.audit_events',
        'GRANT ALL ON TABLE public.audit_events TO PUBLIC'
      ];
      for(const sql of probes) {
        let wasDenied=false;
        try { await app.begin(async tx=>{
          try { await tx.unsafe(sql); } catch(e) { if(e.code==='42501'){wasDenied=true;throw e;} throw e; }
          throw new Error('Forbidden operation succeeded');
        }); } catch(e) { if(!wasDenied) throw e; }
        must(wasDenied,'Forbidden operation not denied');
      }
      console.log('Postflight verified: 11 migrations, 6 disabled agents, 17 denied operations');
    } else console.log('Preflight verified: target, unprivileged runtime and managed schema');
  } finally { await Promise.allSettled([owner.end(),app.end()]); }
}
if(require.main===module) check(process.argv[2]).catch(e=>{
  // Never print driver exception strings: they can contain connection material.
  console.error('Bootstrap guard failed ('+(e.code||'policy')+')');
  process.exitCode=1;
});
module.exports={TARGET,TABLES,ACL,identity,validateRoles,manifest,validateHistory,validateTables,check};
