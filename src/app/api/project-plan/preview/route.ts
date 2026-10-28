import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sameOrigin } from '@/lib/origin';
import { mockPlanProvider, validatePlan } from '@/lib/project-plan';

// Phase 3B mock-only preview. Never accepts a provider endpoint or credentials.
// The CEO session is enforced by the shared middleware.
const input = z.object({
  projectDescription: z.string().trim().min(1).max(2000),
  model: z.literal('deterministic-mock-v1'),
}).strict();

export async function POST(req: NextRequest) {
  if (!sameOrigin(req, req.headers.get('origin')))
    return Response.json({ error: 'Invalid origin' }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = input.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: 'Invalid preview input' }, { status: 400 });
  try {
    const proposal = validatePlan(await mockPlanProvider.propose({
      snapshot: parsed.data.projectDescription,
      model: parsed.data.model,
    }));
    return Response.json({
      mode: 'MOCK_PREVIEW_ONLY',
      persisted: false,
      approved: false,
      provider: 'local-deterministic-mock',
      model: parsed.data.model,
      outboundSnapshot: null,
      estimatedChargeMicroUsd: 0,
      capabilities: [],
      proposal,
      warning: 'This preview is not a saved proposal or approved execution. No real AI provider is available.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Mock preview unavailable' }, { status: 503 });
  }
}
