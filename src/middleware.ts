import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken } from './lib/auth';

export const SESSION_COOKIE = 'winnie_session';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const needsAuth = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isLogin = pathname === '/admin/login' || pathname === '/api/admin/login';
  if (needsAuth && !isLogin) {
    const token = context.cookies.get(SESSION_COOKIE)?.value;
    if (!verifySessionToken(token)) {
      if (pathname.startsWith('/api/')) return new Response('Unauthorized', { status: 401 });
      return context.redirect('/admin/login');
    }
  }
  return next();
});
