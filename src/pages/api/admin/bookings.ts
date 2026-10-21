import type { APIRoute } from 'astro';
import { bookingViews, createOrder, parseDogInput, resolveDogs } from '../../../lib/orders';
import { emailBookingConfirmed } from '../../../lib/email';
import { zonedDateTime } from '../../../lib/tz';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, redirect }) => {
  const back = '/admin?tab=bookings';
  const fail = (message: string) => redirect(`${back}&error=${encodeURIComponent(message)}`);

  const form = await request.formData();
  const date = String(form.get('date') ?? '');
  const time = String(form.get('time') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return fail('Please enter a valid date and time.');
  }
  const start = zonedDateTime(date, time);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    return fail('Please choose a future appointment time.');
  }

  const customerName = String(form.get('customer_name') ?? '').trim();
  const customerEmail = String(form.get('customer_email') ?? '').trim();
  if (!customerName || !EMAIL_RE.test(customerEmail)) {
    return fail('Please enter a customer name and valid email.');
  }

  const submitted = parseDogInput(form.get('dogs'));
  if (!submitted) return fail('Please add at least one dog with a service.');
  const dogs = await resolveDogs(submitted);
  if (!dogs) return fail('Please choose a service and size for each dog.');

  const addonIds = form
    .getAll('addon')
    .map((v) => Number(v))
    .filter((n) => n > 0);

  const rows = await createOrder({
    dogs,
    start,
    customerName,
    customerEmail,
    customerPhone: String(form.get('customer_phone') ?? '').trim(),
    address: String(form.get('address') ?? '').trim(),
    suburb: String(form.get('suburb') ?? '').trim(),
    notes: String(form.get('notes') ?? '').trim(),
    addonIds,
    status: 'confirmed',
  });
  if (!rows) return fail('That time is not available for all the dogs.');

  await emailBookingConfirmed(await bookingViews(rows));
  return redirect(`${back}&saved=1`);
};
