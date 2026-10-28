import { NextResponse, type NextRequest } from 'next/server';
import { cookieName, validSession } from './lib/auth';
export async function middleware(req: NextRequest) { const path=req.nextUrl.pathname; if(path === '/login' || path === '/api/login' || path === '/api/health') return NextResponse.next(); if(await validSession(req.cookies.get(cookieName)?.value)) return NextResponse.next(); if(path.startsWith('/api/')) return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}}); return NextResponse.redirect(new URL('/login',req.url)); }
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
