import type { APIRoute } from 'astro';
import { createSessionToken, verifyAdminPassword } from '../../../lib/auth';
import { SESSION_COOKIE } from '../../../middleware';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  if (verifyAdminPassword(password)) {
    cookies.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      path: '/',
      maxAge: 30 * 24 * 3600,
    });
    return redirect('/admin');
  }
  return redirect('/admin/login?error=1');
};
