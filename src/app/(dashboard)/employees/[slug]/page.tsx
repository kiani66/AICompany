import { notFound } from 'next/navigation';
import { agent } from '@/lib/data';
export const dynamic='force-dynamic';
export default async function Detail({params}:{params:Promise<{slug:string}>}) { const row=await agent((await params).slug); if(!row) notFound(); return <><h1 className="text-3xl font-bold">{row.name}</h1><p className="mt-4">{row.description}</p><p className="mt-4">Reports to: {row.reportsTo ?? 'CEO'}</p><p>Execution: disabled</p><h2 className="mt-6 text-xl font-semibold">Capabilities</h2><ul className="mt-2 list-disc pl-6">{row.capabilities.map(c=><li key={c}>{c}</li>)}</ul></>; }
