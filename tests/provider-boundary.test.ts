import { describe,it,expect } from 'vitest';
import { snapshotDigest,reviewDigest,sameApprovedReview,classifyProviderOutcome,realInferenceEnabled,ensureRealInferenceDisabled } from '../src/lib/provider-boundary';

const review = {
  snapshotSha256:snapshotDigest('synthetic approved payload'),
  provider:{provider:'example-unconfigured',model:'model-not-enabled',pricingVersion:'not-configured'},
  capabilities:[],
  maxInputTokens:100,
  maxOutputTokens:200,
  maxChargeMicroUsd:5000,
};
describe('inert provider boundary',()=>{
  it('binds approval to snapshot, model, pricing, limits, and capabilities',()=>{
    expect(reviewDigest(review)).toMatch(/^[a-f0-9]{64}$/);
    expect(sameApprovedReview(review,{...review})).toBe(true);
    expect(sameApprovedReview(review,{...review,snapshotSha256:snapshotDigest('revised')})).toBe(false);
    expect(sameApprovedReview(review,{...review,maxChargeMicroUsd:5001})).toBe(false);
    expect(sameApprovedReview(review,{...review,provider:{...review.provider,model:'changed'}})).toBe(false);
    expect(()=>reviewDigest({...review,capabilities:['network']})).toThrow();
  });
  it('never releases or retries ambiguous charges',()=>{
    expect(classifyProviderOutcome({kind:'UNKNOWN',requestId:'req-1',reason:'TIMEOUT'},5000)).toEqual({
      kind:'HOLD_FOR_REVIEW',requestId:'req-1',reason:'TIMEOUT',automaticRetry:false,
    });
    expect(classifyProviderOutcome({kind:'UNKNOWN',requestId:null,reason:'CONNECTION_LOST'},5000).kind).toBe('HOLD_FOR_REVIEW');
    expect(classifyProviderOutcome({kind:'COMPLETED',requestId:'req-2',inputTokens:5,outputTokens:5,chargeMicroUsd:5001},5000).kind).toBe('HOLD_FOR_REVIEW');
  });
  it('releases only proven no-charge outcomes and validates usage',()=>{
    expect(classifyProviderOutcome({kind:'CONFIRMED_NO_CHARGE',requestId:null},1000).kind).toBe('RELEASE');
    expect(classifyProviderOutcome({kind:'COMPLETED',requestId:'req-3',inputTokens:1,outputTokens:2,chargeMicroUsd:300},1000)).toEqual({
      kind:'RECONCILE',requestId:'req-3',inputTokens:1,outputTokens:2,chargeMicroUsd:300,
    });
    expect(()=>classifyProviderOutcome({kind:'COMPLETED',requestId:'',inputTokens:1,outputTokens:2,chargeMicroUsd:3},1000)).toThrow();
  });
  it('is always disabled even when unrelated environment variables are present',()=>{
    expect(realInferenceEnabled).toBe(false);
    expect(ensureRealInferenceDisabled).toThrow('not authorized');
  });
});
