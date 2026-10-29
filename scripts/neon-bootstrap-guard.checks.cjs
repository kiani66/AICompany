'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TARGET,TABLES,identity,validateRoles,manifest,validateHistory,validateTables}=require('./neon-bootstrap-guard.cjs');
const owner='postgresql://neondb_owner:test-only@'+TARGET.directHost+'/neondb?sslmode=require';
const runtime='postgresql://aicompany_runtime:test-only@'+TARGET.directHost+'/neondb?sslmode=require';
const clean=(name,login)=>({rolname:name,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,rolcanlogin:login});
test('pins direct owner and permits direct/pooled runtime of exact branch',()=>{
  assert.equal(identity(owner,'owner').role,'neondb_owner');
  assert.equal(identity(runtime,'runtime').role,'aicompany_runtime');
  assert.equal(identity(runtime.replace(TARGET.directHost,TARGET.pooledHost),'runtime').host,TARGET.pooledHost);
  assert.throws(()=>identity(owner.replace(TARGET.directHost,TARGET.pooledHost),'owner'));
  assert.throws(()=>identity(owner.replace('neondb','otherdb'),'owner'));
  assert.throws(()=>identity(owner.replace('sslmode=require','sslmode=disable'),'owner'));
  assert.throws(()=>identity(owner+'&options=-csearch_path%3Dpublic','owner'));
  assert.throws(()=>identity(runtime.replace(TARGET.directHost,'ep-other.us-east-1.aws.neon.tech'),'runtime'));
});
test('rejects P0 flags and inherited neon_superuser',()=>{
  const a=clean(TARGET.runtime,true), g=clean(TARGET.group,false);
  assert.doesNotThrow(()=>validateRoles(a,g,[TARGET.group],'neondb_owner',0));
  for(const flag of ['rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls']) {
    assert.throws(()=>validateRoles({...a,[flag]:true},g,[TARGET.group],'neondb_owner',0));
    assert.throws(()=>validateRoles(a,{...g,[flag]:true},[TARGET.group],'neondb_owner',0));
  }
  assert.throws(()=>validateRoles(a,g,['aicompany_app','neon_superuser'],'neondb_owner',0));
  assert.throws(()=>validateRoles(a,g,[],'neondb_owner',0));
  assert.throws(()=>validateRoles(a,g,[TARGET.group],TARGET.runtime,0));
  assert.throws(()=>validateRoles(a,g,[TARGET.group],'neondb_owner',1));
  assert.throws(()=>validateRoles({...a,rolcanlogin:false},g,[TARGET.group],'neondb_owner',0));
});
test('pins all eleven canonical hashes and Drizzle timestamps',()=>{
  const expected=manifest();
  assert.equal(expected.length,11);
  const applied=expected.map(x=>({hash:x.hash,created_at:String(x.when)}));
  assert.doesNotThrow(()=>validateHistory(applied,expected,true));
  assert.doesNotThrow(()=>validateHistory(applied.slice(0,4),expected,false));
  assert.throws(()=>validateHistory(applied.slice(0,4),expected,true));
  assert.throws(()=>validateHistory([...applied,{hash:'bad',created_at:'1'}],expected,true));
  assert.throws(()=>validateHistory([{hash:'wrong',created_at:String(expected[0].when)}],expected,false));
});
test('rejects unmanaged, unknown, or incomplete relations',()=>{
  assert.doesNotThrow(()=>validateTables([],false,false));
  assert.doesNotThrow(()=>validateTables(TABLES,true,true));
  assert.throws(()=>validateTables(['random'],false,false));
  assert.throws(()=>validateTables(['companies'],false,false));
  assert.throws(()=>validateTables(TABLES.slice(0,-1),true,true));
  assert.throws(()=>validateTables([...TABLES,'extra'],true,true));
});
