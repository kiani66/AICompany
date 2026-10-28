import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { companies, agents, agentCapabilities } from '../src/db/schema';
import { roles } from '../src/lib/roles';
const companyId = '00000000-0000-4000-8000-000000000001';
async function main() { if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required'); const sql=postgres(process.env.DATABASE_URL,{max:1}); const db=drizzle(sql); try { await db.transaction(async tx => { await tx.insert(companies).values({id:companyId,name:'AICompany'}).onConflictDoNothing(); for(const role of roles) { const [agent] = await tx.insert(agents).values({companyId,slug:role.slug,name:role.name,description:role.description,reportsTo:role.reportsTo,executionEnabled:false}).onConflictDoUpdate({target:agents.slug,set:{name:role.name,description:role.description,reportsTo:role.reportsTo}}).returning(); for(const capability of role.capabilities) await tx.insert(agentCapabilities).values({agentId:agent.id,capability}).onConflictDoNothing(); } }); } finally { await sql.end(); } }
main().catch(e=>{console.error(e);process.exitCode=1;});
