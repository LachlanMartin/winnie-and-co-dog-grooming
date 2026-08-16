// ponytail: in-memory per-instance on serverless — soft throttle, not a hard
// guarantee; add DB-backed counters or Vercel Firewall if you need hard limits.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const failures = new Map<string, number[]>();
const lastAlert = new Map<string, number>();

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function recent(ip: string): number[] {
  const now = Date.now();
  const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(ip, list);
  return list;
}

export function isRateLimited(ip: string): boolean {
  return recent(ip).length >= MAX_ATTEMPTS;
}

export function recordFailure(ip: string): void {
  recent(ip).push(Date.now());
}

export function clearFailures(ip: string): void {
  failures.delete(ip);
  lastAlert.delete(ip);
}

// Returns true once per block event (per IP per window) so the alert email
// can't be spammed by an attacker keeping the limiter tripped.
export function consumeAlert(ip: string): boolean {
  const now = Date.now();
  if ((lastAlert.get(ip) ?? 0) > now - WINDOW_MS) return false;
  lastAlert.set(ip, now);
  return true;
}

// Self-check: npx tsx src/lib/rate-limit.ts
if (process.argv[1]?.endsWith('rate-limit.ts')) {
  const assert = (c: boolean, m: string) => {
    if (!c) {
      console.error('FAIL:', m);
      process.exit(1);
    }
  };
  const ip = '127.0.0.1';
  for (let i = 0; i < 5; i++) recordFailure(ip);
  assert(isRateLimited(ip), 'block after 5 failures');
  assert(consumeAlert(ip), 'first alert fires');
  assert(!consumeAlert(ip), 'no second alert in same window');
  clearFailures(ip);
  assert(!isRateLimited(ip), 'cleared after success');
  console.log('rate-limit OK');
}

