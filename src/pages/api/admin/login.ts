import type { APIRoute } from 'astro';
import { createSessionToken, verifyAdminPassword } from '../../../lib/auth';
import { SESSION_COOKIE } from '../../../middleware';
import { clientIp, consumeAlert, clearFailures, isRateLimited, recordFailure } from '../../../lib/rate-limit';
import { emailLoginAlert } from '../../../lib/email';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    if (consumeAlert(ip)) await emailLoginAlert(ip);
    return new Response('Too many attempts', { status: 429 });
  }
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  if (verifyAdminPassword(password)) {
    clearFailures(ip);
    cookies.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      path: '/',
      maxAge: 30 * 24 * 3600,
    });
    return redirect('/admin');
  }
  recordFailure(ip);
  return redirect('/admin/login?error=1');
};
