import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bookings, services } from '../../../db/schema';
import { durationFor, isSlotFree, SIZES } from '../../lib/availability';
import { createDraftInvoice } from '../../lib/invoice';
import { emailRequestReceived, emailRequestToOwner } from '../../lib/email';

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const serviceId = Number(form.get('service'));
  const startIso = String(form.get('start') ?? '');

  const customerName = String(form.get('customer_name') ?? '').trim();
  const customerEmail = String(form.get('customer_email') ?? '').trim();
  const customerPhone = String(form.get('customer_phone') ?? '').trim();
  const dogName = String(form.get('dog_name') ?? '').trim();

  if (!serviceId || !customerName || !dogName) return json({ ok: false, error: 'Please fill in all required fields.' });
  if (!EMAIL_RE.test(customerEmail)) return json({ ok: false, error: 'Please enter a valid email address.' });
  if (form.get('agree') !== 'on') {
    return json({ ok: false, error: 'Please agree to the Terms & Conditions to continue.' });
  }

  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) return json({ ok: false, error: 'Unknown service.' });

  const size = service.hasSizes ? String(form.get('size') ?? '') : null;
  if (service.hasSizes && !SIZES.includes(size as (typeof SIZES)[number])) {
    return json({ ok: false, error: 'Please select a dog size.' });
  }

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    return json({ ok: false, error: 'Invalid or past appointment time.' });
  }
  const end = new Date(start.getTime() + durationFor(service, size as (typeof SIZES)[number] | null) * 60000);

  // Trust boundary: re-verify the slot server-side, never trust the client.
  if (!(await isSlotFree(start, end))) {
    return json({ ok: false, error: 'Sorry, that slot was just taken. Please pick another time.' });
  }

  const addonIds = form
    .getAll('addon')
    .map((v) => Number(v))
    .filter((n) => n > 0);

  const [booking] = await db
    .insert(bookings)
    .values({
      serviceId,
      size,
      slotStart: start,
      slotEnd: end,
      customerName,
      customerEmail,
      customerPhone,
      dogName,
      dogBreed: String(form.get('dog_breed') ?? '').trim(),
      address: String(form.get('address') ?? '').trim(),
      suburb: String(form.get('suburb') ?? '').trim(),
      notes: String(form.get('notes') ?? '').trim(),
      addonIds,
      status: 'pending',
    })
    .returning();

  await createDraftInvoice(booking, service);
  const view = { ...booking, service };
  await emailRequestReceived(view);
  await emailRequestToOwner(view);

  return json({ ok: true, redirect: `/book/thank-you?id=${booking.id}` });
};
