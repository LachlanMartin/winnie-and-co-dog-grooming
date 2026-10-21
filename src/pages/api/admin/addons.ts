import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../lib/db';
import { addons } from '../../../../db/schema';

const cents = (value: FormDataEntryValue | null): number | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const back = '/admin?tab=services';
  const fail = (message: string) => redirect(`${back}&error=${encodeURIComponent(message)}`);

  const action = String(form.get('action') ?? '');
  const name = String(form.get('name') ?? '').trim();
  if (!name) return fail('Please enter an add-on name.');

  const priceCents = cents(form.get('price'));
  if (priceCents == null) return fail('Please enter a valid add-on price.');

  const active = form.get('active') === 'on';
  const sortOrder = Math.max(0, Math.trunc(Number(form.get('sort_order') ?? 0)) || 0);

  if (action === 'create') {
    await db.insert(addons).values({ name, priceCents, active, sortOrder });
    return redirect(`${back}&saved=1`);
  }

  if (action === 'save') {
    const id = Number(form.get('id'));
    if (!Number.isInteger(id) || id <= 0) return fail('Unknown add-on.');
    const existing = await db.select({ id: addons.id }).from(addons).where(eq(addons.id, id)).limit(1);
    if (!existing.length) return fail('Unknown add-on.');
    await db.update(addons).set({ name, priceCents, active, sortOrder }).where(eq(addons.id, id));
    return redirect(`${back}&saved=1`);
  }

  return redirect(back);
};
