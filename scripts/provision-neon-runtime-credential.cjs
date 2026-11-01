/* eslint-disable @typescript-eslint/no-require-imports -- Node-only protected Actions CLI */
'use strict';
const {TARGET,identity}=require('./neon-bootstrap-guard.cjs');

const CONFIRM='PROVISION-AICOMPANY-RUNTIME-ROLE';
function must(value) { if(!value) throw new Error('Credential preflight denied'); }
function validPassword(value) {
  // The approved workflow expects 32 bytes of entropy encoded as 64 lowercase hex chars.
  return typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
}
function inspectRoles(runtime,group,membership,legacy) {
  must(runtime && group && !legacy);
  must(runtime.rolname===TARGET.runtime && group.rolname===TARGET.group);
  must(runtime.rolcanlogin===false && group.rolcanlogin===false);
  for(const role of [runtime,group]) {
    must(!role.rolsuper && !role.rolcreatedb && !role.rolcreaterole &&
      !role.rolreplication && !role.rolbypassrls);
  }
  must(membership.length===1 && membership[0]===TARGET.group);
}
async function provision(env=process.env) {
  must(env.GITHUB_REF==='refs/heads/main');
  must(env.AICOMPANY_ROLE_CONFIRMATION===CONFIRM);
  must(env.EXPECTED_NEON_PROJECT_ID===TARGET.project &&
    env.EXPECTED_NEON_BRANCH_ID===TARGET.branch);
  must(validPassword(env.AICOMPANY_RUNTIME_ROLE_PASSWORD));
  identity(env.AICOMPANY_MIGRATION_DATABASE_URL,'owner');
  const postgres=require('postgres');
  const owner=postgres(env.AICOMPANY_MIGRATION_DATABASE_URL,{max:1,connect_timeout:10});
  let didAlter=false;
  try {
    const [who]=await owner.unsafe(
      'SELECT current_user AS role,current_database() AS db,current_setting(\'server_version_num\')::int AS version');
    must(who.role===TARGET.owner && who.db===TARGET.database && who.version>=160000);
    const roles=await owner.unsafe(
      "SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname IN ('aicompany_runtime_restricted','aicompany_app','aicompany_runtime')");
    const memberships=await owner.unsafe(
      "SELECT rolname FROM pg_roles WHERE oid <> (SELECT oid FROM pg_roles WHERE rolname='aicompany_runtime_restricted') AND pg_has_role('aicompany_runtime_restricted',oid,'MEMBER')");
    inspectRoles(roles.find(r=>r.rolname===TARGET.runtime),
      roles.find(r=>r.rolname===TARGET.group),
      memberships.map(m=>m.rolname),roles.find(r=>r.rolname==='aicompany_runtime'));
    const [ownership]=await owner.unsafe(
      "SELECT pg_get_userbyid(datdba) AS db_owner FROM pg_database WHERE datname=current_database()");
    const [owned]=await owner.unsafe(
      "SELECT (SELECT count(*) FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname='aicompany_runtime_restricted'))+(SELECT count(*) FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname='aicompany_runtime_restricted')) AS total");
    must(ownership.db_owner!==TARGET.runtime && Number(owned.total)===0);
    const [privileges]=await owner.unsafe(
      "SELECT has_database_privilege('aicompany_runtime_restricted',current_database(),'CREATE') AS db_create,has_database_privilege('aicompany_runtime_restricted',current_database(),'TEMPORARY') AS db_temp,has_schema_privilege('aicompany_runtime_restricted','public','CREATE') AS schema_create");
    // PostgreSQL grants TEMPORARY to PUBLIC on new databases by default.
    // This bootstrap explicitly removes that database-wide default as the
    // canonical app-privileges.sql already requires; no migrations are run.
    must(!privileges.db_create && !privileges.schema_create);
    await owner.begin(async tx=>{
      await tx.unsafe('REVOKE TEMPORARY ON DATABASE neondb FROM PUBLIC');
      const [after]=await tx.unsafe(
        "SELECT has_database_privilege('aicompany_runtime_restricted',current_database(),'CREATE') AS db_create,has_database_privilege('aicompany_runtime_restricted',current_database(),'TEMPORARY') AS db_temp,has_schema_privilege('aicompany_runtime_restricted','public','CREATE') AS schema_create");
      must(!after.db_create && !after.db_temp && !after.schema_create);
      // The password is validated as 64 lowercase hexadecimal chars.
      // Never log SQL, credentials, or driver errors.
      await tx.unsafe("ALTER ROLE "+TARGET.runtime+" WITH LOGIN PASSWORD '"+env.AICOMPANY_RUNTIME_ROLE_PASSWORD+"'");
    });
    didAlter=true;
    const url=new URL(env.AICOMPANY_MIGRATION_DATABASE_URL);
    url.username=TARGET.runtime;
    url.password=env.AICOMPANY_RUNTIME_ROLE_PASSWORD;
    const app=postgres(url.toString(),{max:1,connect_timeout:10});
    try {
      const [active]=await app.unsafe('SELECT current_user AS role,current_database() AS db');
      must(active.role===TARGET.runtime && active.db===TARGET.database);
      const [permissions]=await app.unsafe(
        "SELECT has_database_privilege(current_user,current_database(),'CREATE') AS db_create,has_schema_privilege(current_user,'public','CREATE') AS schema_create");
      must(!permissions.db_create && !permissions.schema_create);
    } finally { await app.end(); }
    console.log('Restricted Neon runtime credential initialized and login independently verified; no migrations or seed executed.');
  } catch (_err) {
    if(didAlter) {
      try {
        await owner.unsafe('ALTER ROLE '+TARGET.runtime+' WITH NOLOGIN');
      } catch (_rollbackError) {
        console.error('CRITICAL: Could not disable LOGIN after failed validation. Stop and inspect Neon role manually.');
      }
    }
    throw new Error('Restricted runtime credential provisioning failed; all secret-bearing details withheld');
  } finally {
    await owner.end();
  }
}
if(require.main===module) provision().catch(()=>{
  console.error('Provisioning failed: no credentials or SQL printed');
  process.exitCode=1;
});
module.exports={CONFIRM,validPassword,inspectRoles,provision};
