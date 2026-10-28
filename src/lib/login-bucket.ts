import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextRequest } from 'next/server';
import { validIngress } from './origin';

/**
 * Never derive a security bucket from an arbitrary forwarding header.
 * Vercel documents x-vercel-forwarded-for as its platform-supplied client IP.
 * This function must only be used behind verified Vercel ingress; WAF is still
 * mandatory to bound spoofing, traffic volume and abusive source rotation.
 */
export function loginAttemptBucket(req: NextRequest): string | null {
  if (process.env.NODE_ENV !== 'production') return 'ceo';
  if (process.env.VERCEL !== '1' || !validIngress(req)) return null;
  const raw = req.headers.get('x-vercel-forwarded-for');
  if (!raw || raw.length > 45 || !isIP(raw)) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  // Store a keyed digest rather than exposing the IP in the database.
  return 'ceo-ip:' + createHmac('sha256', secret).update(raw).digest('hex');
}
