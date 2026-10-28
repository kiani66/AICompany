import { listAgents } from '@/lib/data';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json(await listAgents(), {headers:{'Cache-Control':'no-store'}}); }
