import { test,expect } from '@playwright/test';
import postgres from 'postgres';
import { createHash } from 'node:crypto';

test('CEO rehearses exact provider consent, atomic reserve and unresolved timeout without inference',async({page,request})=>{
 test.setTimeout(90000);
 const sql=postgres(process.env.DATABASE_URL!,{max:2});
 let projectId='',proposalId='',agentId='';
 try {
  expect((await request.get('/api/provider-preparations')).status()).toBe(401);
  expect((await request.post('/api/provider-preparations',{data:{type:'reserve'}})).status()).toBe(401);
  await sql`delete from login_rate_limits`;
  const [company]=await sql`select id from companies limit 1`;
  const [agent]=await sql`select id from agents where slug='project-manager'`;
  agentId=agent.id;
  const [project]=await sql`insert into projects(company_id,name) values (${company.id},'Provider rehearsal browser') returning id`;
  projectId=project.id;
  const snapshot='Synthetic browser-only provider plan';
  const digest=createHash('sha256').update(snapshot).digest('hex');
  const [proposal]=await sql`insert into project_plan_proposals(company_id,project_id,snapshot,snapshot_sha256,proposal,status)
    values (${company.id},${projectId},${snapshot},${digest},'{"summary":"Mock","milestones":[{"title":"Scope","acceptanceCriteria":"Reviewed"}]}','ACCEPTED') returning id`;
  proposalId=proposal.id;
  await sql`insert into runtime_settings(company_id,kill_switch) values (${company.id},false) on conflict(company_id) do update set kill_switch=false`;
  for(const scope of ['global',`project:${projectId}`,`agent:${agentId}`]){
   await sql`insert into runtime_budgets(scope,token_limit,micro_usd_limit) values(${scope},50,0)
     on conflict(scope) do update set token_limit=50,micro_usd_limit=0,reserved_tokens=0,used_tokens=0,reserved_micro_usd=0,used_micro_usd=0`;
  }
  await page.goto('/login');
  await page.getByLabel('Password').fill(process.env.TEST_CEO_PASSWORD!);
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page.getByText('Foundation Mode')).toBeVisible();
  await page.getByRole('link',{name:'Provider rehearsal'}).click();
  await expect(page.getByRole('heading',{name:'Provider preparation — non-executing rehearsal'})).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Create mock preparation'}).click();
  await expect(page.getByText('PREVIEWED',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Approve exact mock envelope'}).click();
  await expect(page.getByText('APPROVED',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reserve simulated budget'}).click();
  await expect(page.getByText('RESERVED',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Simulate unknown timeout'}).click();
  await expect(page.getByText('UNRESOLVED',{exact:true})).toBeVisible();
  const [hold]=await sql`select count(*)::int as count from provider_preparation_ledger where kind='HOLD' and preparation_id in
    (select id from provider_run_preparations where proposal_id=${proposalId})`;
  expect(hold.count).toBe(3);
  const [budget]=await sql`select reserved_tokens from runtime_budgets where scope='global'`;
  expect(budget.reserved_tokens).toBe(20);
  await page.getByRole('button',{name:'Verify mock no charge and release reservation'}).click();
  await expect(page.getByText('RECONCILED',{exact:true})).toBeVisible();
  const [reconciledBudget]=await sql`select reserved_tokens from runtime_budgets where scope='global'`;
  expect(reconciledBudget.reserved_tokens).toBe(0);
  expect((await sql`select count(*)::int as count from task_executions`)[0].count).toBe(0);
 }finally{
  if(proposalId){
   const intents=await sql`select id from provider_run_preparations where proposal_id=${proposalId}`;
   for(const p of intents){
    await sql`delete from provider_preparation_ledger where preparation_id=${p.id}`;
    await sql`delete from audit_events where event like ${'%'+p.id+'%'}`;
   }
   await sql`delete from provider_run_preparations where proposal_id=${proposalId}`;
   await sql`delete from project_plan_proposals where id=${proposalId}`;
  }
  if(projectId)await sql`delete from projects where id=${projectId}`;
  await sql`delete from runtime_budgets where scope in ('global',${'project:'+projectId},${'agent:'+agentId})`;
  await sql`delete from runtime_settings`;
  await sql.end();
 }
});
