import postgres from 'postgres';

type Status = {
  role: string;
  isSuperuser: boolean;
  canCreateDb: boolean;
  canCreateRole: boolean;
  canBypassRls: boolean;
  canCreateInPublic: boolean;
  ownedTables: number;
  truncatableTables: number;
  auditCanUpdate: boolean;
  auditCanDelete: boolean;
  auditCanInsert: boolean;
  auditCanRead: boolean;
};
export function validateRuntimePrivileges(s:Status):string[] {
  const failures:string[]=[];
  if(s.isSuperuser||s.canCreateDb||s.canCreateRole||s.canBypassRls)failures.push('Runtime role has elevated privileges');
  if(s.canCreateInPublic)failures.push('Runtime role can create objects in public schema');
  if(s.ownedTables>0)failures.push('Runtime role owns application tables');
  if(s.truncatableTables>0)failures.push('Runtime role can truncate application tables');
  if(s.auditCanUpdate||s.auditCanDelete)failures.push('Runtime role can rewrite/delete audit events');
  if(!s.auditCanInsert||!s.auditCanRead)failures.push('Runtime role lacks required audit permissions');
  return failures;
}

async function main(){
  const url=process.env.DATABASE_URL;
  if(!url)throw new Error('DATABASE_URL must be the NON-OWNER runtime login');
  const client=postgres(url,{max:1,prepare:false,connect_timeout:5});
  try {
    const [role]=await client`
      select current_user as role, r.rolsuper as superuser, r.rolcreatedb as createdb,
             r.rolcreaterole as createrole, r.rolbypassrls as bypassrls,
             has_schema_privilege(current_user,'public','CREATE') as schema_create
      from pg_roles r where r.rolname=current_user`;
    if(!role)throw new Error('Cannot inspect runtime DB role');
    const [tables]=await client`
      select count(*) filter (where c.relowner=(select oid from pg_roles where rolname=current_user))::int as owned,
             count(*) filter (where has_table_privilege(current_user,c.oid,'TRUNCATE'))::int as truncatable
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p')`;
    const [audit]=await client`
      select has_table_privilege(current_user,'public.audit_events','SELECT') as can_read,
             has_table_privilege(current_user,'public.audit_events','INSERT') as can_insert,
             has_table_privilege(current_user,'public.audit_events','UPDATE') as can_update,
             has_table_privilege(current_user,'public.audit_events','DELETE') as can_delete`;
    if(!audit)throw new Error('Audit table is unavailable');
    const state:Status={
      role:String(role.role),
      isSuperuser:Boolean(role.superuser),
      canCreateDb:Boolean(role.createdb),
      canCreateRole:Boolean(role.createrole),
      canBypassRls:Boolean(role.bypassrls),
      canCreateInPublic:Boolean(role.schema_create),
      ownedTables:Number(tables.owned),
      truncatableTables:Number(tables.truncatable),
      auditCanRead:Boolean(audit.can_read),
      auditCanInsert:Boolean(audit.can_insert),
      auditCanUpdate:Boolean(audit.can_update),
      auditCanDelete:Boolean(audit.can_delete),
    };
    const failures=validateRuntimePrivileges(state);
    if(failures.length)throw new Error('Unsafe runtime database privileges: '+failures.join('; '));
    process.stdout.write('Runtime PostgreSQL privilege check PASSED (no credentials printed).\\n');
  } finally {await client.end();}
}
if(process.argv[1]?.endsWith('check-runtime-db.ts')) main().catch(e=>{
  process.stderr.write((e instanceof Error?e.message:'Privilege check failed')+'\\n');
  process.exitCode=1;
});
