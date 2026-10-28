import { eq, sql } from 'drizzle-orm';
import { database } from '@/db/client';
import { companies, agents, agentCapabilities, projects, tasks, agentReports, approvalRequests, taskExecutions, usageRecords } from '@/db/schema';
export async function company() { const db=database(); const [row]=await db.select().from(companies).limit(1); const counts=await db.select({agents:sql<number>`(select count(*)::int from agents)`,projects:sql<number>`(select count(*)::int from projects)`,tasks:sql<number>`(select count(*)::int from tasks)`,executions:sql<number>`(select count(*)::int from task_executions)`,usageUsd:sql<string>`(select coalesce(sum(cost_usd),0)::text from usage_records)`}).from(companies).limit(1); return row ? {...row,...counts[0]} : null; }
export async function listAgents() { return database().select().from(agents).orderBy(agents.name); }
export async function agent(slug:string) { const db=database(); const [row]=await db.select().from(agents).where(eq(agents.slug,slug)); if(!row) return null; const capabilities=await db.select({capability:agentCapabilities.capability}).from(agentCapabilities).where(eq(agentCapabilities.agentId,row.id)); return {...row,capabilities:capabilities.map(x=>x.capability)}; }
export async function listProjects() { return database().select().from(projects); }
export async function listTasks() { return database().select().from(tasks); }
export async function listReports() { return database().select().from(agentReports); }
export async function listApprovals() { return database().select().from(approvalRequests); }
// Referenced by the schema and future integrations; no writes or execution are exposed.
void taskExecutions; void usageRecords;
