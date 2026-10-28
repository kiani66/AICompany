import { sameOrigin } from '@/lib/origin';
import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { cookieName, createSession } from '@/lib/auth';
import { consumeLoginAttempt, createStoredSession } from '@/lib/security-store';
const input=z.object({password:z.string().min(1).max(256)});
export async function POST(req:NextRequest) { if (!sameOrigin(req,req.headers.get('origin'))) return NextResponse.json({error:'Invalid origin'},{status:403}); try { if(!await consumeLoginAttempt()) return NextResponse.json({error:'Try again later'},{status:429,headers:{'Cache-Control':'no-store'}}); let body:unknown; try { body=await req.json(); } catch { return NextResponse.json({error:'Invalid request'},{status:400}); } const parsed=input.safeParse(body); const hash=process.env.CEO_PASSWORD_HASH; if (!hash || !/^\$2[aby]\$/.test(hash) || !parsed.success || !(await compare(parsed.data.password,hash))) return NextResponse.json({error:'Invalid credentials'},{status:401}); const token=await createSession(await createStoredSession()); const response=NextResponse.json({ok:true}); response.cookies.set(cookieName,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*60*60}); response.headers.set('Cache-Control','no-store'); return response; } catch { return NextResponse.json({error:'Authentication unavailable'},{status:503,headers:{'Cache-Control':'no-store'}}); } }
