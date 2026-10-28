import Link from 'next/link';
import { listAgents } from '@/lib/data';
export const dynamic='force-dynamic';
export default async function Employees() { const rows=await listAgents(); return <><h1 className="text-3xl font-bold">AI Employees</h1><p className="mt-2 text-slate-600">Definitions only. Execution is disabled.</p><div className="mt-6 grid gap-4 md:grid-cols-2">{rows.map(a=><article key={a.id} className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold"><Link href={`/employees/${a.slug}`}>{a.name}</Link></h2><p className="mt-2">{a.description}</p><p className="mt-3 text-sm text-slate-600">Execution disabled</p></article>)}</div>{!rows.length && <p className="mt-4">No employees have been seeded.</p>}</>; }
