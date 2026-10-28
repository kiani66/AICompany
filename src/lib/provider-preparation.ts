import postgres from 'postgres';
import { z } from 'zod';
import { outboundReview, reviewDigest, snapshotDigest, classifyProviderOutcome, type ProviderOutcome } from './provider-boundary';

// A durable rehearsal of a future billable run. NO inference dispatch exists.
const uuid=z.string().uuid();
export const prepareCommand=z.discriminatedUnion('type',[
 z.object({type:z.literal('prepare'),proposalId:uuid,key:uuid,envelope:outboundReview}).strict(),
 z.object({type:z.literal('approve'),id:uuid,version:z.number().int().positive(),digest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({type:z.literal('reserve'),id:uuid,version:z.number().int().positive()}).strict(),
 z.object({type:z.literal('resolveMock'),id:uuid,version:z.number().int().positive(),outcome:z.enum(['success','no-charge','timeout'])}).strict(),
 z.object({type:z.literal('cancel'),id:uuid,version:z.number().int().positive()}).strict(),
]);
export type PrepareCommand=z.infer<typeof prepareCommand>;
export class PreparationError extends Error {}
let client:ReturnType<typeof postgres>|undefined;
function db(){if(!process.env.DATABASE_URL)throw new Error('Database unavailable');return client??=postgres(process.env.DATABASE_URL,{max:5,prepare:false});}
async function companyId(tx:postgres.TransactionSql){const [c]=await tx`select id from companies limit 1`;if(!c)throw new PreparationError('Company not initialized');return c.id as string;}
const safeRow=(r:Record<string,unknown>)=>({id:r.id,project_id:r.project_id,proposal_id:r.proposal_id,state:r.state,version:r.version,review_digest:r.review_digest,review_envelope:r.review_envelope,reserved_tokens:r.reserved_tokens,reserved_micro_usd:r.reserved_micro_usd,used_tokens:r.used_tokens,used_micro_usd:r.used_micro_usd,outcome_reason:r.outcome_reason});
export async function prepareProviderRun(input:PrepareCommand){
 const c=prepareCommand.parse(input);
 return db().begin(async tx=>{
   // Match the lock order of Phase 3A; this serializes global budget reservations.
   await tx`select pg_advisory_xact_lock(hashtextextended('aicompany-runtime',0))`;
   const company=await companyId(tx);
   const [settings]=await tx`select kill_switch from runtime_settings where company_id=${company}`;
   if(!settings||settings.kill_switch!==false)throw new PreparationError('Kill switch prevents preparation');
   let result:Record<string,unknown>;
   if(c.type==='prepare'){
     const digest=reviewDigest(c.envelope);
     const [prior]=await tx`select * from provider_run_preparations where idempotency_key=${c.key}`;
     if(prior){if(prior.review_digest!==digest||prior.proposal_id!==c.proposalId)throw new PreparationError('Idempotency conflict');return safeRow(prior);}
     const [p]=await tx`select p.*,pr.status project_status from project_plan_proposals p join projects pr on pr.id=p.project_id
        where p.id=${c.proposalId} and p.company_id=${company} and p.status='ACCEPTED' and pr.status='active' for share of p,pr`;
     if(!p)throw new PreparationError('Accepted project proposal required');
     if(snapshotDigest(p.snapshot)!==p.snapshot_sha256||c.envelope.snapshotSha256!==p.snapshot_sha256)
       throw new PreparationError('Snapshot mismatch');
     // Only a fixed, fake provider identity is currently permitted; no network adapter is callable.
     if(c.envelope.provider.provider!=='local-deterministic-mock'||c.envelope.provider.model!=='deterministic-mock-v1'
       ||c.envelope.provider.pricingVersion!=='mock-zero-v1'||c.envelope.maxChargeMicroUsd!==0)
       throw new PreparationError('Real providers are disabled');
     const [agent]=await tx`select id from agents where company_id=${company} and slug='project-manager' and execution_enabled=false`;
     if(!agent)throw new PreparationError('Project Manager disabled-agent policy');
     await tx`select pg_advisory_xact_lock(hashtextextended(${p.project_id},0))`;
     const [created]=await tx`insert into provider_run_preparations
        (company_id,project_id,proposal_id,agent_id,idempotency_key,review_envelope,review_digest)
        values (${company},${p.project_id},${p.id},${agent.id},${c.key},${JSON.stringify(c.envelope)},${digest}) returning *`;
     result=created;
   }else{
     const [run]=await tx`select * from provider_run_preparations where company_id=${company} and id=${c.id} for update`;
     if(!run||run.version!==c.version)throw new PreparationError('Missing or stale preparation');
     await tx`select pg_advisory_xact_lock(hashtextextended(${run.project_id},0))`;
     const [project]=await tx`select status from projects where id=${run.project_id} and company_id=${company}`;
     const [proposal]=await tx`select status,snapshot,snapshot_sha256 from project_plan_proposals where id=${run.proposal_id} and company_id=${company}`;
     const [agent]=await tx`select execution_enabled from agents where id=${run.agent_id} and company_id=${company}`;
     if(!project||project.status!=='active'||!proposal||proposal.status!=='ACCEPTED'||!agent||agent.execution_enabled)
       throw new PreparationError('Policy boundary changed');
     const envelope=outboundReview.parse(JSON.parse(run.review_envelope));
     if(snapshotDigest(proposal.snapshot)!==proposal.snapshot_sha256||reviewDigest(envelope)!==run.review_digest)
       throw new PreparationError('Consent envelope changed');
     if(c.type==='approve'){
       if(run.state!=='PREVIEWED'||run.review_digest!==c.digest)throw new PreparationError('Exact consent mismatch');
       const [updated]=await tx`update provider_run_preparations set state='APPROVED',approved_at=now(),version=version+1,updated_at=now() where id=${run.id} returning *`;
       result=updated;
     }else if(c.type==='reserve'){
       if(run.state!=='APPROVED')throw new PreparationError('Approval required');
       const scopes=['global',`project:${run.project_id}`,`agent:${run.agent_id}`];
       const rows=await tx`select * from runtime_budgets where scope in ${tx(scopes)} for update`;
       const amount=envelope.maxChargeMicroUsd,tokens=envelope.maxInputTokens+envelope.maxOutputTokens;
       if(rows.length!==3||rows.some(b=>b.token_limit-b.reserved_tokens-b.used_tokens<tokens||b.micro_usd_limit-b.reserved_micro_usd-b.used_micro_usd<amount))
          throw new PreparationError('Budget unavailable');
       for(const scope of scopes){
         await tx`update runtime_budgets set reserved_tokens=reserved_tokens+${tokens},reserved_micro_usd=reserved_micro_usd+${amount} where scope=${scope}`;
         await tx`insert into provider_preparation_ledger (preparation_id,scope,kind,tokens,micro_usd) values (${run.id},${scope},'RESERVE',${tokens},${amount})`;
       }
       const [updated]=await tx`update provider_run_preparations set state='RESERVED',reserved_tokens=${tokens},reserved_micro_usd=${amount},version=version+1,updated_at=now() where id=${run.id} returning *`;
       result=updated;
     }else if(c.type==='cancel'){
       if(!['PREVIEWED','APPROVED','RESERVED'].includes(run.state))throw new PreparationError('Cannot cancel unresolved or final preparation');
       if(run.state==='RESERVED'){
         const scopes=['global',`project:${run.project_id}`,`agent:${run.agent_id}`];
         for(const scope of scopes){
           await tx`update runtime_budgets set reserved_tokens=reserved_tokens-${run.reserved_tokens},reserved_micro_usd=reserved_micro_usd-${run.reserved_micro_usd} where scope=${scope}`;
           await tx`insert into provider_preparation_ledger(preparation_id,scope,kind,tokens,micro_usd,evidence) values (${run.id},${scope},'RELEASE',${run.reserved_tokens},${run.reserved_micro_usd},'never-dispatched')`;
         }
       }
       const [updated]=await tx`update provider_run_preparations set state='CANCELLED',version=version+1,updated_at=now() where id=${run.id} returning *`;
       result=updated;
     }else{
       if(run.state!=='RESERVED')throw new PreparationError('Reservation required');
       // Synthetic-only outcome, never transmitted to provider. No real dispatch state exists.
       const outcome:ProviderOutcome=c.outcome==='timeout'?{kind:'UNKNOWN',requestId:null,reason:'TIMEOUT'}:c.outcome==='no-charge'?{kind:'CONFIRMED_NO_CHARGE',requestId:null}:{kind:'COMPLETED',requestId:'mock-local-only',inputTokens:1,outputTokens:1,chargeMicroUsd:0};
       const instruction=classifyProviderOutcome(outcome,run.reserved_micro_usd);
       const scopes=['global',`project:${run.project_id}`,`agent:${run.agent_id}`];
       if(instruction.kind==='HOLD_FOR_REVIEW'){
         for(const scope of scopes) await tx`insert into provider_preparation_ledger(preparation_id,scope,kind,tokens,micro_usd,evidence) values (${run.id},${scope},'HOLD',${run.reserved_tokens},${run.reserved_micro_usd},${instruction.reason})`;
         const [updated]=await tx`update provider_run_preparations set state='UNRESOLVED',outcome_reason=${instruction.reason},version=version+1,updated_at=now() where id=${run.id} returning *`;
         result=updated;
       }else{
         const usedTokens=instruction.kind==='RECONCILE'?instruction.inputTokens+instruction.outputTokens:0;
         const usedCost=instruction.kind==='RECONCILE'?instruction.chargeMicroUsd:0;
         if(usedTokens>run.reserved_tokens)throw new PreparationError('Simulated usage exceeds reservation');
         for(const scope of scopes){
           await tx`update runtime_budgets set reserved_tokens=reserved_tokens-${run.reserved_tokens},reserved_micro_usd=reserved_micro_usd-${run.reserved_micro_usd},used_tokens=used_tokens+${usedTokens},used_micro_usd=used_micro_usd+${usedCost} where scope=${scope}`;
           await tx`insert into provider_preparation_ledger(preparation_id,scope,kind,tokens,micro_usd,evidence) values (${run.id},${scope},${instruction.kind},${usedTokens},${usedCost},'local-mock-only')`;
         }
         const [updated]=await tx`update provider_run_preparations set state='RECONCILED',used_tokens=${usedTokens},used_micro_usd=${usedCost},version=version+1,updated_at=now() where id=${run.id} returning *`;
         result=updated;
       }
     }
   }
   await tx`insert into audit_events(company_id,event) values(${company},${JSON.stringify({actor:'CEO',mode:'provider-preparation-only',event:`provider.${c.type}`,preparationId:result.id,status:result.state,reviewDigest:result.review_digest})})`;
   return safeRow(result);
 });
}
export async function listPreparations(){
 const [company]=await db()`select id from companies limit 1`;
 if(!company)return [];
 const rows=await db()`select * from provider_run_preparations where company_id=${company.id} order by created_at desc,id desc limit 50`;
 return rows.map(safeRow);
}
