import { z } from 'zod';
const query=z.object({limit:z.coerce.number().int().min(1).max(100).default(25),offset:z.coerce.number().int().min(0).max(100000).default(0)});
export function pagination(request:Request) { const params=new URL(request.url).searchParams; return query.safeParse({limit:params.get('limit') ?? undefined,offset:params.get('offset') ?? undefined}); }
