import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { loginAttemptBucket } from '../src/lib/login-bucket';

afterEach(()=>vi.unstubAllEnvs());
function request(source:string | null, forwardedFor?:string) {
  const headers:Record<string,string>={host:'aicompany.example'};
  if(source!==null)headers['x-vercel-forwarded-for']=source;
  if(forwardedFor!==undefined)headers['x-forwarded-for']=forwardedFor;
  return new NextRequest('https://aicompany.example/api/login',{method:'POST',headers});
}
describe('Phase 4 isolated CEO login rate limiting',()=>{
  it('in production requires verified Vercel ingress and single validated edge IP',()=>{
    vi.stubEnv('NODE_ENV','production');
    vi.stubEnv('APP_ORIGIN','https://aicompany.example');
    vi.stubEnv('SESSION_SECRET','test-secret-with-at-least-32-characters');
    vi.stubEnv('VERCEL','1');
    const a=loginAttemptBucket(request('192.0.2.1'));
    const b=loginAttemptBucket(request('192.0.2.2'));
    expect(a).toMatch(/^ceo-ip:[0-9a-f]{64}$/);
    expect(b).toMatch(/^ceo-ip:[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(a).toBe(loginAttemptBucket(request('192.0.2.1','203.0.113.200')));
    expect(a).not.toContain('192.0.2.1');
    expect(loginAttemptBucket(request('2001:db8::1'))).toMatch(/^ceo-ip:/);
    expect(loginAttemptBucket(request(null))).toBeNull();
    expect(loginAttemptBucket(request('invalid-ip'))).toBeNull();
    expect(loginAttemptBucket(request('192.0.2.1,203.0.113.1'))).toBeNull();
  });
  it('fails closed without verified Vercel or secure origin',()=>{
    vi.stubEnv('NODE_ENV','production');
    vi.stubEnv('APP_ORIGIN','https://aicompany.example');
    vi.stubEnv('SESSION_SECRET','test-secret-with-at-least-32-characters');
    vi.stubEnv('VERCEL','');
    expect(loginAttemptBucket(request('192.0.2.1'))).toBeNull();
    vi.stubEnv('VERCEL','1');
    vi.stubEnv('APP_ORIGIN','https://wrong.example');
    expect(loginAttemptBucket(request('192.0.2.1'))).toBeNull();
    vi.stubEnv('APP_ORIGIN','https://aicompany.example');
    vi.stubEnv('SESSION_SECRET','short');
    expect(loginAttemptBucket(request('192.0.2.1'))).toBeNull();
  });
  it('ignores forwarded headers when developing locally',()=>{
    vi.stubEnv('NODE_ENV','test');
    vi.stubEnv('VERCEL','');
    expect(loginAttemptBucket(request('192.0.2.1'))).toBe('ceo');
    expect(loginAttemptBucket(request('192.0.2.2'))).toBe('ceo');
  });
});
