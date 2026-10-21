import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../lib/db';
import { services } from '../../../../db/schema';

const cents = (value: FormDataEntryValue | null): number | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
};

const minutes = (value: FormDataEntryValue | null): number | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return amount;
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'service';

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  while ((await db.select({ id: services.id }).from(services).where(eq(services.slug, candidate)).limit(1)).length) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const back = '/admin?tab=services';
  const fail = (message: string) => redirect(`${back}&error=${encodeURIComponent(message)}`);

  const action = String(form.get('action') ?? '');
  const name = String(form.get('name') ?? '').trim();
  if (!name) return fail('Please enter a service name.');

  const hasSizes = form.get('hasSizes') === 'on';
  const description = String(form.get('description') ?? '').trim();
  const active = form.get('active') === 'on';
  const sortOrder = Math.max(0, Math.trunc(Number(form.get('sort_order') ?? 0)) || 0);

  let values: {
    priceFlat: number | null;
    durationFlat: number | null;
    priceS: number | null;
    priceM: number | null;
    priceL: number | null;
    priceXl: number | null;
    durationS: number | null;
    durationM: number | null;
    durationL: number | null;
    durationXl: number | null;
  };

  if (hasSizes) {
    const priceS = cents(form.get('price_s'));
    const priceM = cents(form.get('price_m'));
    const priceL = cents(form.get('price_l'));
    const priceXl = cents(form.get('price_xl'));
    const durationS = minutes(form.get('duration_s'));
    const durationM = minutes(form.get('duration_m'));
    const durationL = minutes(form.get('duration_l'));
    const durationXl = minutes(form.get('duration_xl'));
    if ([priceS, priceM, priceL, priceXl, durationS, durationM, durationL, durationXl].some((v) => v == null)) {
      return fail('Please enter a price and duration for every size.');
    }
    values = {
      priceFlat: null,
      durationFlat: null,
      priceS,
      priceM,
      priceL,
      priceXl,
      durationS,
      durationM,
      durationL,
      durationXl,
    };
  } else {
    const priceFlat = cents(form.get('price_flat'));
    const durationFlat = minutes(form.get('duration_flat'));
    if (priceFlat == null || durationFlat == null) {
      return fail('Please enter a price and duration.');
    }
    values = {
      priceFlat,
      durationFlat,
      priceS: null,
      priceM: null,
      priceL: null,
      priceXl: null,
      durationS: null,
      durationM: null,
      durationL: null,
      durationXl: null,
    };
  }

  if (action === 'create') {
    await db.insert(services).values({
      name,
      slug: await uniqueSlug(name),
      description,
      active,
      hasSizes,
      sortOrder,
      ...values,
    });
    return redirect(`${back}&saved=1`);
  }

  if (action === 'save') {
    const id = Number(form.get('id'));
    if (!Number.isInteger(id) || id <= 0) return fail('Unknown service.');
    const existing = await db.select({ id: services.id }).from(services).where(eq(services.id, id)).limit(1);
    if (!existing.length) return fail('Unknown service.');
    await db
      .update(services)
      .set({
        name,
        description,
        active,
        hasSizes,
        sortOrder,
        ...values,
      })
      .where(eq(services.id, id));
    return redirect(`${back}&saved=1`);
  }

  return redirect(back);
};
