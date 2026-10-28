import { expect, it } from 'vitest';
import postgres from 'postgres';
import { executeCommand } from '../src/lib/workflow';
import { saveMockProposal, decideMockProposal, listMockProposals } from '../src/lib/project-plan-workflow';

it('persists immutable mock snapshots and accepts or rejects without creating tasks or AI runs', async () => {
  const sql=postgres(process.env.DATABASE_URL!,{max:3});
  let projectId='';
  const proposalIds:string[]=[];
  const original='Synthetic test scope; no secrets.';
  try {
    const created=await executeCommand({type:'project.create',name:'Mock planning integration',priority:'low'}) as {id:string};
    projectId=created.id;
    const first=await saveMockProposal({projectId,description:original,acknowledgement:true,model:'deterministic-mock-v1'});
    proposalIds.push(first.id);
    expect(first.status).toBe('REVIEW_REQUIRED');
    expect(first.model).toBe('deterministic-mock-v1');
    const [stored]=await sql`select * from project_plan_proposals where id=${first.id}`;
    expect(stored.snapshot).toBe(original);
    expect(stored.snapshot_sha256).toMatch(/^[a-f0-9]{64}$/);
    const [tasksBefore]=await sql`select count(*)::int as count from tasks where project_id=${projectId}`;
    expect(tasksBefore.count).toBe(0);
    const racing=await Promise.allSettled([
      decideMockProposal({id:first.id,version:1,decision:'ACCEPTED'}),
      decideMockProposal({id:first.id,version:1,decision:'REJECTED'}),
    ]);
    expect(racing.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(racing.filter(x=>x.status==='rejected')).toHaveLength(1);
    const [after]=await sql`select snapshot,snapshot_sha256,version,status from project_plan_proposals where id=${first.id}`;
    expect(after.snapshot).toBe(original);
    expect(after.snapshot_sha256).toBe(stored.snapshot_sha256);
    expect(after.version).toBe(2);
    expect(['ACCEPTED','REJECTED']).toContain(after.status);
    const second=await saveMockProposal({projectId,description:'Second synthetic input',acknowledgement:true,model:'deterministic-mock-v1'});
    proposalIds.push(second.id);
    await decideMockProposal({id:second.id,version:1,decision:'REJECTED'});
    const history=await listMockProposals();
    expect(history.some(x=>x.id===first.id)).toBe(true);
    const [tasksAfter]=await sql`select count(*)::int as count from tasks where project_id=${projectId}`;
    const [runs]=await sql`select count(*)::int as count from simulation_runs where project_id=${projectId}`;
    expect(tasksAfter.count).toBe(0);
    expect(runs.count).toBe(0);
    const [agent]=await sql`select execution_enabled from agents where slug='project-manager'`;
    expect(agent.execution_enabled).toBe(false);
    const [audit]=await sql`select count(*)::int as count from audit_events where event like ${'%' + first.id + '%'}`;
    expect(audit.count).toBe(2);
  } finally {
    if(projectId) {
      for(const id of proposalIds) await sql`delete from audit_events where event like ${'%' + id + '%'}`;
      await sql`delete from project_plan_proposals where project_id=${projectId}`;
      await sql`delete from projects where id=${projectId}`;
    }
    await sql.end();
  }
},30000);

it('disallows mutating stored snapshots under the application database role',async()=>{
  const sql=postgres(process.env.DATABASE_URL!,{max:1});
  try {
    const {readFileSync}=await import('node:fs');
    await sql.unsafe(readFileSync('scripts/app-privileges.sql','utf8'));
    for(const query of [
      "update project_plan_proposals set snapshot=snapshot",
      "update project_plan_proposals set snapshot_sha256=snapshot_sha256",
      "update project_plan_proposals set proposal=proposal",
      "delete from project_plan_proposals",
      "truncate project_plan_proposals",
    ]) {
      await expect(sql.begin(async tx=>{await tx`set local role aicompany_app`;await tx.unsafe(query);})).rejects.toThrow();
    }
  } finally {await sql.end();}
},30000);
