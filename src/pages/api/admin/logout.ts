import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../../../middleware';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/admin/login');
};
