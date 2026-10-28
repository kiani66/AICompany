import { z } from 'zod';
import { validatePlan, type ProjectPlan } from './project-plan';
import { ensureRealInferenceDisabled, type ProviderOutcome, type OutboundReview } from './provider-boundary';

// A provider-neutral transport/adapter boundary for a future separately authorized pilot.
// This is NOT wired to an API route or scheduler. The first statement of propose()
// always rejects, before any credential, network or secret access.
export interface ModelTransport {
  send(request: { endpoint:string; apiKey:string; model:string; input:string; outputTokenLimit:number; timeoutMs:number }): Promise<{
    responseId:string|null;
    output:unknown;
    inputTokens:number|null;
    outputTokens:number|null;
  }>;
}
export type ModelResponse = { plan:ProjectPlan; outcome:ProviderOutcome };
const settings=z.object({
  endpoint:z.literal('https://api.openai.com/v1/responses'),
  model:z.string().trim().min(1).max(128),
  pricingVersion:z.string().trim().min(1).max(64),
}).strict();

export class DisabledRealPlanAdapter {
  private readonly identity:z.infer<typeof settings>;
  constructor(identity:unknown,private readonly transport:ModelTransport){
    this.identity=settings.parse(identity);
  }
  async propose(_input:{snapshot:string;review:OutboundReview}):Promise<ModelResponse>{
    // Do not remove without a new ADR, CEO activation, explicit provider/model and
    // spend ceilings, outbound data review, production security sign-off and tests.
    ensureRealInferenceDisabled();
    // Unreachable by design. No inference can be initiated by this deployment.
    void this.transport;
    void this.identity;
    throw new Error('Real execution disabled');
  }
}

// Structured validation utilities for future provider implementations.
// Unknown usage must never be converted to a zero-cost success.
export function validateProviderPayload(output:unknown):ProjectPlan {
  return validatePlan(output);
}
export function mapProviderUsage(input:unknown):ProviderOutcome {
  const parsed=z.object({
    requestId:z.string().min(1).max(256).nullable(),
    inputTokens:z.number().int().nonnegative().nullable(),
    outputTokens:z.number().int().nonnegative().nullable(),
    chargeMicroUsd:z.number().int().nonnegative().nullable(),
  }).strict().parse(input);
  if(parsed.requestId===null||parsed.inputTokens===null||parsed.outputTokens===null||parsed.chargeMicroUsd===null)
    return {kind:'UNKNOWN',requestId:parsed.requestId,reason:'UNKNOWN_RESPONSE'};
  return {kind:'COMPLETED',requestId:parsed.requestId,inputTokens:parsed.inputTokens,outputTokens:parsed.outputTokens,chargeMicroUsd:parsed.chargeMicroUsd};
}
