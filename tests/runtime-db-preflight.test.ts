import { describe,it,expect } from 'vitest';
import { validateRuntimePrivileges } from '../scripts/check-runtime-db';

const safe = {
  role:'aicompany_runtime',
  isSuperuser:false,canCreateDb:false,canCreateRole:false,canBypassRls:false,
  canCreateInPublic:false,ownedTables:0,truncatableTables:0,
  auditCanRead:true,auditCanInsert:true,auditCanUpdate:false,auditCanDelete:false,
};
describe('Phase 4 read-only runtime DB preflight',()=>{
 it('accepts a restricted non-owner runtime login',()=>{
   expect(validateRuntimePrivileges(safe)).toEqual([]);
 });
 it('rejects privileged roles, table ownership, truncation and mutable audit history',()=>{
   const variants=[
    {isSuperuser:true},{canCreateDb:true},{canCreateRole:true},{canBypassRls:true},
    {canCreateInPublic:true},{ownedTables:1},{truncatableTables:1},
    {auditCanUpdate:true},{auditCanDelete:true},{auditCanRead:false},{auditCanInsert:false},
   ];
   for(const patch of variants){
     expect(validateRuntimePrivileges({...safe,...patch}).length).toBeGreaterThan(0);
   }
 });
});
