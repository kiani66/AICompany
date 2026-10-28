import { database } from '@/db/client';
import { agents,projects,tasks,runtimeSettings,runtimeBudgets,simulationRuns,simulationLedger } from '@/db/schema';
import { desc } from 'drizzle-orm';
import Controls from './runtime-controls';
export const dynamic='force-dynamic';
export default async function Page(){const db=database(); const [a,p,t,s,b,r,l]=await Promise.all([db.select().from(agents),db.select().from(projects),db.select().from(tasks),db.select().from(runtimeSettings),db.select().from(runtimeBudgets),db.select().from(simulationRuns).orderBy(desc(simulationRuns.createdAt),desc(simulationRuns.id)).limit(100),db.select().from(simulationLedger).orderBy(desc(simulationLedger.createdAt),desc(simulationLedger.id)).limit(100)]); return <Controls agents={a} projects={p} tasks={t} settings={s} budgets={b} runs={r} ledger={l}/>; }
