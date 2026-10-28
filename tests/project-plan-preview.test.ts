import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/project-plan/preview/route';

function request(body: unknown, origin = 'http://localhost:3000') {
  return new NextRequest('http://localhost:3000/api/project-plan/preview', {
    method: 'POST',
    headers: { origin, host: 'localhost:3000', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
describe('Phase 3B mock preview boundary', () => {
  it('rejects cross-origin requests', async () => {
    expect((await POST(request({ projectDescription: 'Demo', model: 'deterministic-mock-v1' }, 'http://evil.example'))).status).toBe(403);
  });
  it('rejects arbitrary providers and extra capabilities', async () => {
    expect((await POST(request({ projectDescription: 'Demo', model: 'live-provider' }))).status).toBe(400);
    expect((await POST(request({ projectDescription: 'Demo', model: 'deterministic-mock-v1', tools: ['network'] }))).status).toBe(400);
  });
  it('bounds submitted descriptions', async () => {
    expect((await POST(request({ projectDescription: 'x'.repeat(2001), model: 'deterministic-mock-v1' }))).status).toBe(400);
  });
  it('returns only an unsaved deterministic proposal with no capabilities', async () => {
    const response = await POST(request({ projectDescription: 'Demo', model: 'deterministic-mock-v1' }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.mode).toBe('MOCK_PREVIEW_ONLY');
    expect(result.persisted).toBe(false);
    expect(result.approved).toBe(false);
    expect(result.capabilities).toEqual([]);
    expect(result.estimatedChargeMicroUsd).toBe(0);
    expect(result.proposal.milestones).toHaveLength(1);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
