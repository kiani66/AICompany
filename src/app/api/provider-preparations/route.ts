import { NextRequest } from 'next/server';
import { sameOrigin } from '@/lib/origin';
import { prepareCommand, prepareProviderRun, listPreparations, PreparationError } from '@/lib/provider-preparation';

export const dynamic='force-dynamic';
export async function GET(){
  try{return Response.json(await listPreparations(),{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({error:'Preparation history unavailable'},{status:503});}
}
export async function POST(req:NextRequest){
  if(!sameOrigin(req,req.headers.get('origin')))return Response.json({error:'Invalid origin'},{status:403});
  let body:unknown;
  try{body=await req.json();}catch{return Response.json({error:'Invalid JSON'},{status:400});}
  const parsed=prepareCommand.safeParse(body);
  if(!parsed.success)return Response.json({error:'Invalid preparation request'},{status:400});
  try{return Response.json(await prepareProviderRun(parsed.data),{headers:{'Cache-Control':'no-store'}});}
  catch(e){
    if(e instanceof PreparationError)return Response.json({error:e.message},{status:409});
    console.error('Provider preparation unavailable');
    return Response.json({error:'Preparation unavailable'},{status:503});
  }
}
