import { NextResponse, type NextRequest } from 'next/server';
import { cookieName, sessionId } from './lib/auth';
import { sessionExists } from './lib/security-store';
import { validIngress } from './lib/origin';
export async function middleware(req: NextRequest) { if(!validIngress(req)) return NextResponse.json({error:'Invalid request host'},{status:403,headers:{'Cache-Control':'no-store'}}); const path=req.nextUrl.pathname; if(path === '/login' || path === '/api/login' || path === '/api/health') return NextResponse.next(); const id=await sessionId(req.cookies.get(cookieName)?.value); if(id) { try { if(await sessionExists(id)) return NextResponse.next(); } catch { return new NextResponse('Service unavailable',{status:503,headers:{'Cache-Control':'no-store'}}); } } if(path.startsWith('/api/')) return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}}); return NextResponse.redirect(new URL('/login',req.url)); }
export const config = { runtime:'nodejs', matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
