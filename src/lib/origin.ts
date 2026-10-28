import type { NextRequest } from 'next/server';
export function sameOrigin(req: NextRequest, origin: string | null) { if (!origin) return false; try { const url = new URL(origin); return url.host === req.headers.get('host') && url.protocol === req.nextUrl.protocol; } catch { return false; } }
