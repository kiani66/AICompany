import { listTasks } from '@/lib/data';
export const dynamic='force-dynamic';
export default async function Page() { const rows=await listTasks(); return <><h1 className="text-3xl font-bold">Tasks</h1>{rows.length ? <ul className="mt-6 space-y-3">{rows.map(row=><li key={row.id} className="rounded border bg-white p-4"><pre className="whitespace-pre-wrap">{JSON.stringify(row,null,2)}</pre></li>)}</ul> : <p className="mt-6 text-slate-600">No tasks yet.</p>}</>; }
