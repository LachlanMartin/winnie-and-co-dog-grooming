import type { APIRoute } from 'astro';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../../lib/db';
import { bookings, invoiceItems, invoices } from '../../../../../db/schema';
import { bookingViews, loadOrder, moveOrder } from '../../../../lib/orders';
import { emailBookingChanged, emailBookingConfirmed, emailBookingDeclined } from '../../../../lib/email';
import { zonedDateTime } from '../../../../lib/tz';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function deleteInvoicesFor(bookingIds: number[]) {
  if (!bookingIds.length) return;
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(inArray(invoices.bookingId, bookingIds));
  const ids = rows.map((r) => r.id);
  if (!ids.length) return;
  await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, ids));
  await db.delete(invoices).where(inArray(invoices.id, ids));
}

export const POST: APIRoute = async ({ request, redirect, params }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const action = String(form.getAll('action').pop() ?? '');
  const requested = String(form.get('return_to') ?? '');
  const back = requested === '/admin?tab=calendar' ? requested : '/admin?tab=bookings';
  const fail = (message: string) => redirect(`${back}&error=${encodeURIComponent(message)}`);

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return redirect(back);

  const order = await loadOrder(booking);

  if (action === 'approve') {
    const pending = order.filter((b) => b.status === 'pending');
    if (pending.length) {
      await db
        .update(bookings)
        .set({ status: 'confirmed' })
        .where(inArray(bookings.id, pending.map((b) => b.id)));
      const views = await bookingViews(pending.map((b) => ({ ...b, status: 'confirmed' })));
      await emailBookingConfirmed(views);
    }
    return redirect(back);
  }

  if (action === 'decline') {
    const pending = order.filter((b) => b.status === 'pending');
    if (pending.length) {
      await db
        .update(bookings)
        .set({ status: 'declined' })
        .where(inArray(bookings.id, pending.map((b) => b.id)));
      await deleteInvoicesFor(pending.map((b) => b.id));
      const views = await bookingViews(pending);
      await emailBookingDeclined(views);
    }
    return redirect(back);
  }

  if (action === 'cancel') {
    const live = order.filter((b) => b.status === 'confirmed');
    if (live.length) {
      await db
        .update(bookings)
        .set({ status: 'cancelled' })
        .where(inArray(bookings.id, live.map((b) => b.id)));
      await deleteInvoicesFor(live.map((b) => b.id));
    }
    return redirect(back);
  }

  if (action === 'delete') {
    if (!order.length || order.some((b) => b.status !== 'cancelled')) {
      return fail('Only cancelled appointments can be deleted.');
    }
    const ids = order.map((b) => b.id);
    await db.transaction(async (tx) => {
      const invRows = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(inArray(invoices.bookingId, ids));
      const invoiceIds = invRows.map((r) => r.id);
      if (invoiceIds.length) {
        await tx.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
        await tx.delete(invoices).where(inArray(invoices.id, invoiceIds));
      }
      await tx.delete(bookings).where(inArray(bookings.id, ids));
    });
    return redirect(`${back}&deleted=1`);
  }

  if (action === 'edit') {
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

    const ids = order.map((b) => b.id);
    const dogIds = form.getAll('dog_id').map(Number);
    const dogNames = form.getAll('dog_name');
    const dogBreeds = form.getAll('dog_breed');
    const known = new Set(ids);
    const dogUpdates: { id: number; name: string; breed: string }[] = [];
    for (let i = 0; i < dogIds.length; i++) {
      const dogId = dogIds[i];
      const name = String(dogNames[i] ?? '').trim();
      if (!known.has(dogId) || !name) return fail('Each dog needs a name.');
      dogUpdates.push({ id: dogId, name, breed: String(dogBreeds[i] ?? '').trim() });
    }
    if (dogUpdates.length !== order.length) return fail('Please fill in every dog.');

    const moved = await moveOrder(booking, start);
    if (!moved) return fail('That time is not available for all the dogs.');

    await db
      .update(bookings)
      .set({
        customerName,
        customerEmail,
        customerPhone: String(form.get('customer_phone') ?? '').trim(),
        address: String(form.get('address') ?? '').trim(),
        suburb: String(form.get('suburb') ?? '').trim(),
        notes: String(form.get('notes') ?? '').trim(),
      })
      .where(inArray(bookings.id, ids));

    for (const dog of dogUpdates) {
      await db
        .update(bookings)
        .set({ dogName: dog.name, dogBreed: dog.breed })
        .where(eq(bookings.id, dog.id));
    }

    const updated = await loadOrder(booking);
    await emailBookingChanged(await bookingViews(updated));
    return redirect(`${back}&saved=1`);
  }

  return redirect(back);
};
