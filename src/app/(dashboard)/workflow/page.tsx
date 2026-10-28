import { database } from '@/db/client';
import { projects,tasks,agents,taskDependencies,approvalRequests,auditEvents } from '@/db/schema';
import { desc, asc } from 'drizzle-orm';
import Workflow from './workflow';
export const dynamic='force-dynamic';
export default async function Page(){ const db=database(); const [p,t,a,d,r,events]=await Promise.all([db.select().from(projects).orderBy(desc(projects.createdAt),desc(projects.id)),db.select().from(tasks).orderBy(desc(tasks.createdAt),desc(tasks.id)),db.select().from(agents).orderBy(asc(agents.name),asc(agents.id)),db.select().from(taskDependencies).orderBy(asc(taskDependencies.id)),db.select().from(approvalRequests).orderBy(desc(approvalRequests.createdAt),desc(approvalRequests.id)),db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt),desc(auditEvents.id))]); return <Workflow projects={p} tasks={t} agents={a} dependencies={d} approvals={r} events={events.map(e=>({...e,createdAt:e.createdAt.toISOString()}))}/>; }
