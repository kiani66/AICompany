import { listProjects } from '@/lib/data';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json(await listProjects(), {headers:{'Cache-Control':'no-store'}}); }
