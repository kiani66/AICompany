import { sameOrigin } from '@/lib/origin';
import { NextRequest, NextResponse } from 'next/server';
import { cookieName, sessionId } from '@/lib/auth';
import { revokeSession } from '@/lib/security-store';
export async function POST(req:NextRequest) { if(!sameOrigin(req, req.headers.get('origin'))) return NextResponse.json({error:'Invalid origin'},{status:403}); const id=await sessionId(req.cookies.get(cookieName)?.value); try { if(id) await revokeSession(id); } catch { return NextResponse.json({error:'Logout unavailable'},{status:503}); } const res=NextResponse.redirect(new URL('/login',req.url),303); res.cookies.set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0}); return res; }
