import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// Design-time contract. This module has NO network adapter, secret access,
// execution scheduler or activation path. All actual inference is denied.
export const providerIdentity = z.object({
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  pricingVersion: z.string().min(1).max(64),
}).strict();
export const outboundReview = z.object({
  snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
  provider: providerIdentity,
  capabilities: z.array(z.string()).max(0),
  maxInputTokens: z.number().int().min(1).max(100000),
  maxOutputTokens: z.number().int().min(1).max(100000),
  maxChargeMicroUsd: z.number().int().min(0).max(100000000),
}).strict();
export type OutboundReview = z.infer<typeof outboundReview>;

export function snapshotDigest(snapshot:string) {
  return createHash('sha256').update(snapshot,'utf8').digest('hex');
}
// Consent is bound to the entire approved envelope; the digest is a comparison
// value, NOT authentication or permission to spend money.
export function reviewDigest(input:OutboundReview) {
  const e=outboundReview.parse(input);
  return createHash('sha256').update(JSON.stringify([
    e.snapshotSha256,e.provider.provider,e.provider.model,e.provider.pricingVersion,
    e.capabilities,e.maxInputTokens,e.maxOutputTokens,e.maxChargeMicroUsd,
  ])).digest('hex');
}
export function sameApprovedReview(a:OutboundReview,b:OutboundReview) {
  const x=Buffer.from(reviewDigest(a),'hex'), y=Buffer.from(reviewDigest(b),'hex');
  return timingSafeEqual(x,y);
}
export type ProviderOutcome =
  | {kind:'COMPLETED';requestId:string;inputTokens:number;outputTokens:number;chargeMicroUsd:number}
  | {kind:'CONFIRMED_NO_CHARGE';requestId:string|null}
  | {kind:'UNKNOWN';requestId:string|null;reason:'TIMEOUT'|'CONNECTION_LOST'|'UNKNOWN_RESPONSE'};
export type AccountingInstruction =
  | {kind:'RECONCILE';inputTokens:number;outputTokens:number;chargeMicroUsd:number;requestId:string}
  | {kind:'RELEASE';requestId:string|null}
  | {kind:'HOLD_FOR_REVIEW';requestId:string|null;reason:string;automaticRetry:false};

export function classifyProviderOutcome(outcome:ProviderOutcome, reservedMicroUsd:number): AccountingInstruction {
  if (!Number.isSafeInteger(reservedMicroUsd)||reservedMicroUsd<0) throw new Error('Invalid reservation');
  if(outcome.kind==='UNKNOWN') return {kind:'HOLD_FOR_REVIEW',requestId:outcome.requestId,reason:outcome.reason,automaticRetry:false};
  if(outcome.kind==='CONFIRMED_NO_CHARGE') return {kind:'RELEASE',requestId:outcome.requestId};
  if(!outcome.requestId||![outcome.inputTokens,outcome.outputTokens,outcome.chargeMicroUsd].every(x=>Number.isSafeInteger(x)&&x>=0))
    throw new Error('Invalid provider usage');
  if(outcome.chargeMicroUsd>reservedMicroUsd)
    return {kind:'HOLD_FOR_REVIEW',requestId:outcome.requestId,reason:'OVER_RESERVATION',automaticRetry:false};
  return {kind:'RECONCILE',inputTokens:outcome.inputTokens,outputTokens:outcome.outputTokens,chargeMicroUsd:outcome.chargeMicroUsd,requestId:outcome.requestId};
}
export const realInferenceEnabled = false as const;
export function ensureRealInferenceDisabled():never {
  throw new Error('Real inference is not authorized or implemented');
}
