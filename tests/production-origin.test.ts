import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sameOrigin, trustedOrigin, validIngress } from '../src/lib/origin';

afterEach(() => vi.unstubAllEnvs());
function req(host:string, extras:Record<string,string>={}) {
 return new NextRequest('https://aicompany.example/api/login',{
  method:'POST',headers:{host,...extras},
 });
}
describe('Phase 4 production ingress fail-closed policy',()=>{
 it('requires an explicit canonical HTTPS origin',()=>{
  vi.stubEnv('NODE_ENV','production');
  vi.stubEnv('APP_ORIGIN','');
  expect(trustedOrigin()).toBeNull();
  expect(validIngress(req('aicompany.example'))).toBe(false);
  vi.stubEnv('APP_ORIGIN','http://aicompany.example');
  expect(validIngress(req('aicompany.example'))).toBe(false);
  vi.stubEnv('APP_ORIGIN','https://aicompany.example/path');
  expect(validIngress(req('aicompany.example'))).toBe(false);
 });
 it('rejects spoofed Host, forwarded host, insecure forwarded proto, and cross-origin forms',()=>{
  vi.stubEnv('NODE_ENV','production');
  vi.stubEnv('APP_ORIGIN','https://aicompany.example');
  expect(validIngress(req('aicompany.example'))).toBe(true);
  expect(sameOrigin(req('aicompany.example'),'https://aicompany.example')).toBe(true);
  expect(validIngress(req('evil.example'))).toBe(false);
  expect(validIngress(req('aicompany.example',{'x-forwarded-host':'evil.example'}))).toBe(false);
  expect(validIngress(req('aicompany.example',{'x-forwarded-proto':'http'}))).toBe(false);
  expect(validIngress(req('aicompany.example',{'x-forwarded-host':'aicompany.example,evil.example'}))).toBe(false);
  expect(sameOrigin(req('aicompany.example'),'http://aicompany.example')).toBe(false);
  expect(sameOrigin(req('aicompany.example'),'https://evil.example')).toBe(false);
  expect(sameOrigin(req('aicompany.example'),null)).toBe(false);
  expect(sameOrigin(req('aicompany.example'),'https://aicompany.example.attacker.test')).toBe(false);
 });
 it('preserves independent localhost development without an APP_ORIGIN',()=>{
  vi.stubEnv('NODE_ENV','test');
  vi.stubEnv('APP_ORIGIN','');
  const local = new NextRequest('http://localhost:3000/api/login',{headers:{host:'localhost:3000'}});
  expect(validIngress(local)).toBe(true);
  expect(sameOrigin(local,'http://localhost:3000')).toBe(true);
  expect(sameOrigin(local,'http://evil.example')).toBe(false);
 });
});
