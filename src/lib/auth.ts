import { SignJWT, jwtVerify } from 'jose';
const cookieName = 'ceo_session';
export { cookieName };
function key() { const secret = process.env.SESSION_SECRET; if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters'); return new TextEncoder().encode(secret); }
export async function createSession() { return new SignJWT({ role:'ceo' }).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(key()); }
export async function validSession(token?:string) { if (!token) return false; try { const {payload} = await jwtVerify(token,key(),{algorithms:['HS256']}); return payload.role === 'ceo'; } catch { return false; } }
