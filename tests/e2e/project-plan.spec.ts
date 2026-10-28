import { test,expect } from '@playwright/test';
import postgres from 'postgres';

test('CEO previews, saves, and reviews mock plan without creating work or calling AI',async({page,request})=>{
  test.setTimeout(90000);
  const sql=postgres(process.env.DATABASE_URL!,{max:2});
  let projectId='';
  let proposalId='';
  try {
    expect((await request.get('/api/project-plan/proposals')).status()).toBe(401);
    expect((await request.post('/api/project-plan/proposals',{data:{}})).status()).toBe(401);
    await sql`delete from login_rate_limits`;
    const [company]=await sql`select id from companies limit 1`;
    const [project]=await sql`insert into projects (company_id,name) values (${company.id},'Plan mock browser integration') returning id`;
    projectId=project.id;
    await page.goto('/login');
    await page.getByLabel('Password').fill(process.env.TEST_CEO_PASSWORD!);
    await page.getByRole('button',{name:'Sign in'}).click();
    await expect(page.getByText('Foundation Mode')).toBeVisible();
    await page.getByRole('link',{name:'Project plan mock'}).click();
    await expect(page.getByRole('heading',{name:'Project Manager — mock project proposals'})).toBeVisible();
    await page.getByLabel('Active project').selectOption({label:'Plan mock browser integration'});
    await page.getByLabel('Synthetic project description').fill('Synthetic test: prepare a mock project plan.');
    await page.getByRole('button',{name:'Preview mock plan'}).click();
    await expect(page.getByRole('heading',{name:'Unsaved preview'})).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Save mock proposal for review'}).click();
    await expect(page.getByText('Mock proposal saved for review. No tasks were created.')).toBeVisible();
    await expect(page.getByText('Exact saved input (synthetic only)')).toBeVisible();
    await expect(page.getByText('Synthetic test: prepare a mock project plan.')).toBeVisible();
    const [row]=await sql`select id,version,status from project_plan_proposals where project_id=${projectId}`;
    proposalId=row.id;
    expect(row.status).toBe('REVIEW_REQUIRED');
    await page.getByRole('button',{name:'Accept for reference'}).click();
    await expect(page.getByText('Proposal accepted for reference only. No tasks created.')).toBeVisible();
    const [accepted]=await sql`select status,version from project_plan_proposals where id=${proposalId}`;
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.version).toBe(2);
    const [tasks]=await sql`select count(*)::int as count from tasks where project_id=${projectId}`;
    const [runs]=await sql`select count(*)::int as count from simulation_runs where project_id=${projectId}`;
    expect(tasks.count).toBe(0);
    expect(runs.count).toBe(0);
  } finally {
    if(projectId) {
      await sql`delete from project_plan_proposals where project_id=${projectId}`;
      if(proposalId) await sql`delete from audit_events where event like ${'%'+proposalId+'%'}`;
      await sql`delete from projects where id=${projectId}`;
    }
    await sql.end();
  }
});
