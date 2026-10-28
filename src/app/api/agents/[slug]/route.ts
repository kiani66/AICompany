import { agent } from '@/lib/data';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{slug:string}>}) { const data=await agent((await params).slug); return Response.json(data ?? {error:'Not found'},{status:data?200:404,headers:{'Cache-Control':'no-store'}}); }
