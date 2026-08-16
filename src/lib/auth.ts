import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.ADMIN_SECRET ?? 'dev-secret-change-me';
const SESSION_DAYS = 30;

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  return `${exp}.${sign(String(exp))}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const exp = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export function verifyAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? 'admin';
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
