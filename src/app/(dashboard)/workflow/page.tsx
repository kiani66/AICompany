import { database } from '@/db/client';
import { projects,tasks,agents,taskDependencies,approvalRequests,auditEvents } from '@/db/schema';
import { desc } from 'drizzle-orm';
import Workflow from './workflow';
export const dynamic='force-dynamic';
export default async function Page(){ const db=database(); const [p,t,a,d,r,events]=await Promise.all([db.select().from(projects).orderBy(desc(projects.createdAt)).limit(100),db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(200),db.select().from(agents),db.select().from(taskDependencies).limit(500),db.select().from(approvalRequests).orderBy(desc(approvalRequests.createdAt)).limit(100),db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(100)]); return <Workflow projects={p} tasks={t} agents={a} dependencies={d} approvals={r} events={events.map(e=>({...e,createdAt:e.createdAt.toISOString()}))}/>; }
