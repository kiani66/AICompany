import { NextRequest } from 'next/server';
import { sameOrigin } from '@/lib/origin';
import { createProposal, reviewProposal, saveMockProposal, decideMockProposal, listMockProposals, ProposalError } from '@/lib/project-plan-workflow';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json(await listMockProposals(), { headers: {'Cache-Control':'no-store'} }); }
  catch { return Response.json({error:'Proposal history unavailable'}, {status:503}); }
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req, req.headers.get('origin'))) return Response.json({error:'Invalid origin'}, {status:403});
  let input: unknown;
  try { input=await req.json(); } catch { return Response.json({error:'Invalid JSON'}, {status:400}); }
  const shape=createProposal.safeParse(input);
  if (!shape.success) return Response.json({error:'Invalid mock proposal request'}, {status:400});
  try { return Response.json(await saveMockProposal(shape.data), {status:201,headers:{'Cache-Control':'no-store'}}); }
  catch(e) { return Response.json({error:e instanceof ProposalError?e.message:'Proposal unavailable'}, {status:e instanceof ProposalError?409:503}); }
}
export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req,req.headers.get('origin'))) return Response.json({error:'Invalid origin'}, {status:403});
  let input:unknown;
  try { input=await req.json(); } catch { return Response.json({error:'Invalid JSON'}, {status:400}); }
  const shape=reviewProposal.safeParse(input);
  if (!shape.success) return Response.json({error:'Invalid review'}, {status:400});
  try { return Response.json(await decideMockProposal(shape.data), {headers:{'Cache-Control':'no-store'}}); }
  catch(e) { return Response.json({error:e instanceof ProposalError?e.message:'Review unavailable'}, {status:e instanceof ProposalError?409:503}); }
}
