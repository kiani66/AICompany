import { database } from '@/db/client';
import { projects } from '@/db/schema';
import { pagination } from '@/lib/pagination';
import { desc } from 'drizzle-orm';
export const dynamic='force-dynamic';
export async function GET(req:Request) { const page=pagination(req); if(!page.success) return Response.json({error:'Invalid pagination'},{status:400}); return Response.json(await database().select().from(projects).orderBy(desc(projects.createdAt),desc(projects.id)).limit(page.data.limit).offset(page.data.offset),{headers:{'Cache-Control':'no-store'}}); }
