import { describe,it,expect,vi } from 'vitest';
import { DisabledRealPlanAdapter,validateProviderPayload,mapProviderUsage } from '../src/lib/real-provider-adapter';
import { snapshotDigest } from '../src/lib/provider-boundary';

describe('real model integration is impossible without separate activation',()=>{
 it('hard rejects before any transport invocation',async()=>{
  const send=vi.fn(async()=>({responseId:'fake',output:{},inputTokens:1,outputTokens:1}));
  const adapter=new DisabledRealPlanAdapter({
    endpoint:'https://api.openai.com/v1/responses',model:'model-disabled',pricingVersion:'draft',
  },{send});
  await expect(adapter.propose({snapshot:'synthetic',review:{
    snapshotSha256:snapshotDigest('synthetic'),
    provider:{provider:'OpenAI',model:'model-disabled',pricingVersion:'draft'},
    capabilities:[],maxInputTokens:10,maxOutputTokens:10,maxChargeMicroUsd:500,
  }})).rejects.toThrow('not authorized');
  expect(send).not.toHaveBeenCalled();
 });
 it('validates untrusted output and preserves unknown usage',()=>{
  expect(()=>validateProviderPayload({summary:'bad',milestones:[],tools:['shell']})).toThrow();
  expect(mapProviderUsage({requestId:null,inputTokens:null,outputTokens:null,chargeMicroUsd:null}).kind).toBe('UNKNOWN');
  expect(mapProviderUsage({requestId:'r1',inputTokens:1,outputTokens:2,chargeMicroUsd:3})).toEqual({
    kind:'COMPLETED',requestId:'r1',inputTokens:1,outputTokens:2,chargeMicroUsd:3,
  });
 });
});
