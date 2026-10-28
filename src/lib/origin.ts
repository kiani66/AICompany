import type { NextRequest } from 'next/server';

// Vercel production ingress must use a single explicitly approved HTTPS origin.
// Never infer a trusted origin from client-controlled Host or forwarded headers.
export function trustedOrigin(): URL | null {
  const configured = process.env.APP_ORIGIN;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return null;
    return url;
  } catch { return null; }
}

export function validIngress(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const expected = trustedOrigin();
  if (!expected) return false;
  const host = req.headers.get('host');
  if (!host || host !== expected.host) return false;
  // Forwarding values may only narrow trust, never establish it.
  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost && forwardedHost !== expected.host) return false;
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedProto && forwardedProto !== 'https') return false;
  return true;
}

export function sameOrigin(req: NextRequest, origin: string | null): boolean {
  if (!origin || !validIngress(req)) return false;
  try {
    const actual = new URL(origin);
    if (actual.username || actual.password || actual.pathname !== '/' || actual.search || actual.hash) return false;
    if (process.env.NODE_ENV === 'production') {
      const trusted = trustedOrigin();
      return !!trusted && actual.origin === trusted.origin;
    }
    return actual.host === req.headers.get('host') && actual.protocol === req.nextUrl.protocol;
  } catch { return false; }
}
