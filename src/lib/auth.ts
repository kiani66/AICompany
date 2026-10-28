import { SignJWT, jwtVerify } from 'jose';
const cookieName = 'ceo_session';
export { cookieName };
function key() { const secret = process.env.SESSION_SECRET; if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters'); return new TextEncoder().encode(secret); }
export async function createSession(id:string) { return new SignJWT({ role:'ceo' }).setProtectedHeader({alg:'HS256'}).setJti(id).setIssuedAt().setExpirationTime('8h').sign(key()); }
export async function sessionId(token?:string) { if (!token) return null; try { const {payload} = await jwtVerify(token,key(),{algorithms:['HS256']}); return payload.role === 'ceo' && typeof payload.jti === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.jti) ? payload.jti : null; } catch { return null; } }
export async function validSession(token?:string) { return !!(await sessionId(token)); }
