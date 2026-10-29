import { database } from '@/db/client';
import { tasks,agents,pmHandoffs,pmArtifacts,approvalRequests } from '@/db/schema';
import { eq,desc } from 'drizzle-orm';
import Handoffs from './controls';
export const dynamic='force-dynamic';
export default async function Page(){const db=database();const [t,h,a]=await Promise.all([db.select({id:tasks.id,title:tasks.title,projectId:tasks.projectId,version:tasks.version}).from(tasks).innerJoin(agents,eq(tasks.ownerId,agents.id)).where(eq(agents.slug,'project-manager')),db.select().from(pmHandoffs),db.select({id:pmArtifacts.id,handoffId:pmArtifacts.handoffId,revision:pmArtifacts.revision,content:pmArtifacts.content,provenance:pmArtifacts.provenance,approvalId:approvalRequests.id,status:approvalRequests.status,version:approvalRequests.version,reason:approvalRequests.reason}).from(pmArtifacts).innerJoin(approvalRequests,eq(pmArtifacts.approvalId,approvalRequests.id)).orderBy(desc(pmArtifacts.revision))]);return <Handoffs tasks={t} handoffs={h} artifacts={a}/>;}
