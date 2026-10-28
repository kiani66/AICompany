import { sameOrigin } from '@/lib/origin';
import { NextRequest, NextResponse } from 'next/server';
import { cookieName } from '@/lib/auth';
export async function POST(req:NextRequest) { if(!sameOrigin(req, req.headers.get('origin'))) return NextResponse.json({error:'Invalid origin'},{status:403}); const res=NextResponse.redirect(new URL('/login',req.url),303); res.cookies.set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0}); return res; }
