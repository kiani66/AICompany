import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { mockPlanProvider, validatePlan } from './project-plan';

const uuid = z.string().uuid();
export const createProposal = z.object({
  projectId: uuid,
  description: z.string().trim().min(1).max(2000),
  acknowledgement: z.literal(true),
  model: z.literal('deterministic-mock-v1'),
}).strict();
export const reviewProposal = z.object({
  id: uuid, version: z.number().int().positive(),
  decision: z.enum(['ACCEPTED','REJECTED']),
}).strict();
export class ProposalError extends Error {}

let connection: ReturnType<typeof postgres> | undefined;
function db() {
  if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
  return connection ??= postgres(process.env.DATABASE_URL, { max: 5, prepare: false });
}
export async function saveMockProposal(input: z.infer<typeof createProposal>) {
  const parsed = createProposal.parse(input);
  // Model output is treated only as untrusted display data. Never an instruction to execute tools.
  const proposal = validatePlan(await mockPlanProvider.propose({
    snapshot: parsed.description, model: parsed.model,
  }));
  const digest = createHash('sha256').update(parsed.description).digest('hex');
  return db().begin(async tx => {
    const [company] = await tx`select id from companies limit 1`;
    if (!company) throw new ProposalError('Company unavailable');
    const [project] = await tx`select id from projects where id=${parsed.projectId} and company_id=${company.id} and status='active' for share`;
    if (!project) throw new ProposalError('Active project required');
    const [agent] = await tx`select id from agents where company_id=${company.id} and slug='project-manager' and execution_enabled=false`;
    if (!agent) throw new ProposalError('Project Manager must remain disabled');
    const [saved] = await tx`insert into project_plan_proposals
      (company_id,project_id,snapshot,snapshot_sha256,proposal)
      values (${company.id},${project.id},${parsed.description},${digest},${JSON.stringify(proposal)})
      returning id,project_id,status,version,provider,model,snapshot_sha256,proposal,created_at`;
    await tx`insert into audit_events (company_id,event) values
      (${company.id},${JSON.stringify({actor:'CEO',mode:'mock-only',event:'plan.proposed',proposalId:saved.id,projectId:project.id,snapshotSha256:digest})})`;
    return saved;
  });
}
export async function decideMockProposal(input: z.infer<typeof reviewProposal>) {
  const parsed = reviewProposal.parse(input);
  return db().begin(async tx => {
    const [company] = await tx`select id from companies limit 1`;
    if (!company) throw new ProposalError('Company unavailable');
    const [saved] = await tx`update project_plan_proposals
      set status=${parsed.decision}, version=version+1, decided_at=now()
      where id=${parsed.id} and company_id=${company.id}
      and status='REVIEW_REQUIRED' and version=${parsed.version}
      returning id,project_id,status,version,snapshot_sha256,decided_at`;
    if (!saved) throw new ProposalError('Proposal missing, decided or stale');
    await tx`insert into audit_events (company_id,event) values
      (${company.id},${JSON.stringify({actor:'CEO',mode:'mock-only',event:'plan.reviewed',proposalId:saved.id,decision:parsed.decision,snapshotSha256:saved.snapshot_sha256})})`;
    return saved;
  });
}
export async function listMockProposals() {
  const [company] = await db()`select id from companies limit 1`;
  if (!company) return [];
  return db()`select id,project_id,status,version,provider,model,snapshot,snapshot_sha256,proposal,created_at,decided_at
    from project_plan_proposals where company_id=${company.id}
    order by created_at desc,id desc limit 50`;
}
