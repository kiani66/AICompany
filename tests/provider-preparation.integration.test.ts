import { expect,it,beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
beforeAll(()=>{for(const script of ['db:migrate','db:seed'])execFileSync('npm',['run',script],{stdio:'ignore'});},60000);
import postgres from 'postgres';
import { executeCommand } from '../src/lib/workflow';
import { saveMockProposal,decideMockProposal } from '../src/lib/project-plan-workflow';
import { prepareProviderRun, listPreparations } from '../src/lib/provider-preparation';
import { reviewDigest } from '../src/lib/provider-boundary';

it('requires exact consent, reserves budgets atomically, and holds ambiguous mock usage without AI calls',async()=>{
 const sql=postgres(process.env.DATABASE_URL!,{max:4});
 let projectId='',agentId='',proposalId='';
 const intentIds:string[]=[];
 try {
  const [company]=await sql`select id from companies limit 1`;
  const [agent]=await sql`select id,execution_enabled from agents where slug='project-manager'`;
  agentId=agent.id;
  expect(agent.execution_enabled).toBe(false);
  const project=await executeCommand({type:'project.create',name:'Provider rehearsal integration',priority:'low'}) as {id:string};
  projectId=project.id;
  const proposal=await saveMockProposal({projectId,description:'Synthetic local provider rehearsal',acknowledgement:true,model:'deterministic-mock-v1'});
  proposalId=proposal.id;
  await decideMockProposal({id:proposalId,version:1,decision:'ACCEPTED'});
  const envelope={snapshotSha256:proposal.snapshot_sha256 as string,provider:{provider:'local-deterministic-mock',model:'deterministic-mock-v1',pricingVersion:'mock-zero-v1'},capabilities:[],maxInputTokens:10,maxOutputTokens:10,maxChargeMicroUsd:0};
  const firstKey=crypto.randomUUID();
  await expect(prepareProviderRun({type:'prepare',proposalId,key:firstKey,envelope})).rejects.toThrow('Kill switch');
  await sql`insert into runtime_settings(company_id,kill_switch) values (${company.id},false) on conflict(company_id) do update set kill_switch=false`;
  const initial=await prepareProviderRun({type:'prepare',proposalId,key:firstKey,envelope});
  intentIds.push(initial.id as string);
  expect(initial.state).toBe('PREVIEWED');
  expect((await prepareProviderRun({type:'prepare',proposalId,key:firstKey,envelope})).id).toBe(initial.id);
  await expect(prepareProviderRun({type:'prepare',proposalId,key:firstKey,envelope:{...envelope,maxInputTokens:11}})).rejects.toThrow('Idempotency');
  await expect(prepareProviderRun({type:'prepare',proposalId,key:crypto.randomUUID(),envelope:{...envelope,provider:{...envelope.provider,provider:'external'}}})).rejects.toThrow('disabled');
  await expect(prepareProviderRun({type:'approve',id:initial.id as string,version:1,digest:'f'.repeat(64)})).rejects.toThrow('consent');
  const approved=await prepareProviderRun({type:'approve',id:initial.id as string,version:1,digest:reviewDigest(envelope)});
  expect(approved.state).toBe('APPROVED');
  await expect(prepareProviderRun({type:'approve',id:initial.id as string,version:1,digest:reviewDigest(envelope)})).rejects.toThrow('stale');
  const scopes=['global',`project:${projectId}`,`agent:${agentId}`];
  for(const scope of scopes)await sql`insert into runtime_budgets(scope,token_limit,micro_usd_limit) values (${scope},20,0) on conflict(scope) do update set token_limit=20,micro_usd_limit=0,reserved_tokens=0,used_tokens=0,reserved_micro_usd=0,used_micro_usd=0`;
  const queued=await prepareProviderRun({type:'reserve',id:initial.id as string,version:2});
  expect(queued.state).toBe('RESERVED');
  const other=await prepareProviderRun({type:'prepare',proposalId,key:crypto.randomUUID(),envelope});
  intentIds.push(other.id as string);
  const otherApproved=await prepareProviderRun({type:'approve',id:other.id as string,version:1,digest:reviewDigest(envelope)});
  await expect(prepareProviderRun({type:'reserve',id:other.id as string,version:otherApproved.version as number})).rejects.toThrow('Budget unavailable');
  const unknown=await prepareProviderRun({type:'resolveMock',id:initial.id as string,version:3,outcome:'timeout'});
  expect(unknown.state).toBe('UNRESOLVED');
  await expect(prepareProviderRun({type:'cancel',id:initial.id as string,version:4})).rejects.toThrow('Cannot cancel');
  const [held]=await sql`select reserved_tokens from runtime_budgets where scope='global'`;
  expect(held.reserved_tokens).toBe(20);
  const [hold]=await sql`select count(*)::int as count from provider_preparation_ledger where preparation_id=${initial.id as string} and kind='HOLD'`;
  expect(hold.count).toBe(3);
  await expect(prepareProviderRun({type:'reserve',id:other.id as string,version:2})).rejects.toThrow('Budget unavailable');
  expect((await listPreparations()).some(x=>x.id===initial.id)).toBe(true);
  const [tasks]=await sql`select count(*)::int as count from tasks where project_id=${projectId}`;
  const [executions]=await sql`select count(*)::int as count from task_executions`;
  expect(tasks.count).toBe(0);
  expect(executions.count).toBe(0);
 } finally {
  if(intentIds.length) {
    await sql`delete from provider_preparation_ledger where preparation_id in ${sql(intentIds)}`;
    await sql`delete from provider_run_preparations where id in ${sql(intentIds)}`;
    for(const id of intentIds)await sql`delete from audit_events where event like ${'%'+id+'%'}`;
  }
  if(proposalId){
    await sql`delete from project_plan_proposals where id=${proposalId}`;
    await sql`delete from audit_events where event like ${'%'+proposalId+'%'}`;
  }
  if(projectId){
    await sql`delete from projects where id=${projectId}`;
    await sql`delete from audit_events where event like ${'%'+projectId+'%'}`;
  }
  await sql`delete from runtime_budgets where scope in ('global',${'project:'+projectId},${'agent:'+agentId})`;
  await sql`delete from runtime_settings`;
  await sql.end();
 }
},45000);

it('guards provider preparation ledger as append-only for app role',async()=>{
 const sql=postgres(process.env.DATABASE_URL!,{max:1});
 try{
  const {readFileSync}=await import('node:fs');
  await sql.unsafe(readFileSync('scripts/app-privileges.sql','utf8'));
  for(const statement of [
    'update provider_preparation_ledger set kind=kind',
    'update provider_run_preparations set review_envelope=review_envelope',
    'update provider_run_preparations set review_digest=review_digest',
    'update provider_run_preparations set idempotency_key=idempotency_key',
    'delete from provider_preparation_ledger',
    'truncate provider_preparation_ledger',
    'create table provider_privilege_probe(id integer)',
  ])await expect(sql.begin(async tx=>{await tx`set local role aicompany_app`;await tx.unsafe(statement);})).rejects.toThrow();
 }finally{await sql.end();}
},30000);
