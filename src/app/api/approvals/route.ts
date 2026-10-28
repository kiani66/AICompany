import { listApprovals } from '@/lib/data';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json(await listApprovals(), {headers:{'Cache-Control':'no-store'}}); }
