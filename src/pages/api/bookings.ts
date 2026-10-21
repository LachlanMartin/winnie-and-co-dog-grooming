import type { APIRoute } from 'astro';
import { bookingViews, createOrder, parseDogInput, resolveDogs } from '../../lib/orders';
import { emailRequestReceived, emailRequestToOwner } from '../../lib/email';

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const startIso = String(form.get('start') ?? '');

  const customerName = String(form.get('customer_name') ?? '').trim();
  const customerEmail = String(form.get('customer_email') ?? '').trim();
  const customerPhone = String(form.get('customer_phone') ?? '').trim();

  const submitted = parseDogInput(form.get('dogs'));
  if (!submitted) return json({ ok: false, error: 'Please add at least one dog with a service.' });
  const dogs = await resolveDogs(submitted);
  if (!dogs) return json({ ok: false, error: 'Please choose a service and size for each dog.' });

  if (!customerName) return json({ ok: false, error: 'Please fill in all required fields.' });
  if (!EMAIL_RE.test(customerEmail)) return json({ ok: false, error: 'Please enter a valid email address.' });
  if (form.get('agree') !== 'on') {
    return json({ ok: false, error: 'Please agree to the Terms & Conditions to continue.' });
  }

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    return json({ ok: false, error: 'Invalid or past appointment time.' });
  }

  const addonIds = form
    .getAll('addon')
    .map((v) => Number(v))
    .filter((n) => n > 0);

  const rows = await createOrder({
    dogs,
    start,
    customerName,
    customerEmail,
    customerPhone,
    address: String(form.get('address') ?? '').trim(),
    suburb: String(form.get('suburb') ?? '').trim(),
    notes: String(form.get('notes') ?? '').trim(),
    addonIds,
    status: 'pending',
  });
  if (!rows) {
    return json({ ok: false, error: 'Sorry, that time no longer fits all the dogs. Please pick another time.' });
  }

  const views = await bookingViews(rows);
  await emailRequestReceived(views);
  await emailRequestToOwner(views);

  return json({ ok: true, redirect: `/book/thank-you?id=${rows[0].id}` });
};
